import os
import subprocess
import time
from typing import Dict, List, Optional

import boto3
import httpx
from botocore.config import Config
from dotenv import load_dotenv

# UI/UX 테스트 요청을 실제 실행 환경으로 넘기는 오케스트레이터입니다.
# 개발 환경에서는 로컬 Docker 컨테이너를 띄우고, 배포/공개 URL 환경에서는 ECS Fargate 태스크를 실행합니다.
# 두 경로 모두 워커가 접근할 BACKEND_URL, REQUEST_ID, TARGET_URL을 주입한 뒤 백엔드에 VNC 주소와 진행 상태를 콜백합니다.
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")

load_dotenv(ENV_PATH, override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
UIUX_CALLBACK_TOKEN = os.getenv("UIUX_TEST_CALLBACK_TOKEN") or os.getenv("LOAD_TEST_CALLBACK_TOKEN")
AWS_CLIENT_CONFIG = Config(
    connect_timeout=5,
    read_timeout=20,
    retries={"max_attempts": 2, "mode": "standard"},
)


def _reload_runtime_env() -> None:
    """요청 실행 직전에 .env를 다시 읽어 런타임 설정 변경을 반영합니다.

    이 서비스는 프로세스가 떠 있는 동안 여러 테스트 요청을 처리할 수 있으므로, BACKEND_URL이나 AWS_REGION이
    실행 중 바뀌어도 다음 요청에서 최신 값을 쓰도록 전역 설정을 다시 동기화합니다.
    """
    global BACKEND_URL, AWS_REGION, UIUX_CALLBACK_TOKEN
    load_dotenv(ENV_PATH, override=True)
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
    AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
    UIUX_CALLBACK_TOKEN = os.getenv("UIUX_TEST_CALLBACK_TOKEN") or os.getenv("LOAD_TEST_CALLBACK_TOKEN")


def _is_local_backend() -> bool:
    """BACKEND_URL이 컨테이너 바깥의 로컬 개발 서버를 가리키는지 판단합니다."""
    return any(host in BACKEND_URL for host in ("localhost", "127.0.0.1", "host.docker.internal"))


def _use_fargate() -> bool:
    """테스트 실행 방식을 결정합니다.

    USE_FARGATE가 명시되어 있으면 그 값을 최우선으로 사용하고, 없으면 로컬 백엔드가 아닐 때 Fargate를 선택합니다.
    즉 로컬 개발자는 Docker로 빠르게 확인하고, 배포된 서버는 클라우드 브라우저 태스크를 띄우는 기본 정책입니다.
    """
    raw = os.getenv("USE_FARGATE")
    if raw is not None:
        return raw.lower() == "true"
    return not _is_local_backend()


def _post_backend(path: str, *, json_body: Optional[dict] = None, params: Optional[dict] = None) -> None:
    """백엔드 상태 업데이트 API를 호출합니다.

    콜백 실패가 테스트 실행 자체를 즉시 중단시키면 사용자가 VNC 주소나 실패 원인을 전혀 못 볼 수 있으므로,
    여기서는 예외를 삼키고 로그만 남깁니다.
    """
    url = f"{BACKEND_URL}{path}"
    try:
        headers = {"X-Internal-Api-Key": UIUX_CALLBACK_TOKEN} if UIUX_CALLBACK_TOKEN else None
        response = httpx.post(url, json=json_body, params=params, headers=headers, timeout=8.0)
        response.raise_for_status()
    except Exception as exc:
        print(f"Backend callback failed: {url} ({exc})")


def report_step(
    request_id: str,
    step: int,
    url: str,
    action: str,
    *,
    reason: Optional[str] = None,
    error: Optional[str] = None,
    vnc_url: Optional[str] = None,
) -> None:
    """프론트 타임라인에 표시할 테스트 진행 단계를 백엔드에 기록합니다.

    step/action/reason은 사람이 읽는 진행 로그이고, vnc_url은 브라우저 화면을 직접 볼 수 있게 해주는 noVNC 주소입니다.
    """
    payload = {
        "step": step,
        "url": url,
        "action": action,
        "selector": None,
        "text": None,
        "reason": reason,
        "error": error,
    }
    if vnc_url:
        payload["vncUrl"] = vnc_url
    _post_backend(f"/api/uiux-tests/{request_id}/steps", json_body=payload)


def report_failure(request_id: str, reason: str) -> None:
    """테스트 시작 단계에서 실패한 사유를 백엔드에 보고합니다."""
    _post_backend(f"/api/uiux-tests/{request_id}/fail", params={"reason": reason})


def run_uiux_test_service(request_id: str, target_url: str) -> None:
    """UI/UX 테스트 요청의 진입점입니다.

    요청마다 환경 변수를 최신화한 뒤, 현재 환경에 맞는 실행기(Local Docker 또는 Fargate)로 위임합니다.
    실제 브라우저 자동화는 이 파일이 아니라 컨테이너 내부의 `uiux_worker_service.py`가 수행합니다.
    """
    _reload_runtime_env()
    mode = "FARGATE" if _use_fargate() else "LOCAL_DOCKER"
    print(f"[UIUX ORCHESTRATOR] mode={mode}, USE_FARGATE={os.getenv('USE_FARGATE')}, BACKEND_URL={BACKEND_URL}", flush=True)
    if _use_fargate():
        run_fargate_task(request_id, target_url)
    else:
        run_local_docker_task(request_id, target_url)


def _container_backend_url() -> str:
    """로컬 Docker 컨테이너 안에서 호스트 백엔드에 접근 가능한 URL로 변환합니다."""
    return BACKEND_URL.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")


def _fargate_backend_url() -> str:
    """Fargate 워커가 인터넷 또는 VPC 안에서 호출할 백엔드 URL을 결정합니다.

    BACKEND_PUBLIC_URL이 있으면 가장 명확한 공개 콜백 주소로 사용하고, 없으면 DOMAIN 기반 HTTPS 주소를 조합합니다.
    둘 다 없을 때만 현재 BACKEND_URL을 그대로 쓰므로, 운영 환경에서는 공개 접근 가능한 주소 설정이 중요합니다.
    """
    public_url = os.getenv("BACKEND_PUBLIC_URL", "").strip()
    if public_url:
        return public_url.rstrip("/")

    domain = os.getenv("DOMAIN", "").strip()
    if domain:
        return f"https://{domain}".rstrip("/")

    return BACKEND_URL.rstrip("/")


def _docker_image_name() -> str:
    """로컬 Docker 실행에 사용할 UI/UX 워커 이미지명을 반환합니다."""
    return os.getenv("LOCAL_UIUX_IMAGE", "flowcheck-ai")


def _local_callback_env_args() -> List[str]:
    """로컬 워커 컨테이너가 백엔드 콜백 인증을 통과하도록 토큰을 명시적으로 주입합니다.

    개발 환경에서는 FastAPI 프로세스가 OS 환경 변수로 토큰을 받고, `.env` 파일에는 없거나 다른 값이 들어 있는 경우가 있습니다.
    Docker `--env-file`만 믿으면 워커가 401을 받아 steps/report/fail 저장이 모두 실패할 수 있으므로,
    현재 오케스트레이터가 실제로 사용하는 토큰을 컨테이너 환경 변수로 다시 넘깁니다.
    """
    if not UIUX_CALLBACK_TOKEN:
        return []
    return [
        "-e",
        f"UIUX_TEST_CALLBACK_TOKEN={UIUX_CALLBACK_TOKEN}",
        "-e",
        f"LOAD_TEST_CALLBACK_TOKEN={UIUX_CALLBACK_TOKEN}",
    ]


def run_local_docker_task(request_id: str, target_url: str) -> None:
    """로컬 개발용 UI/UX 워커 컨테이너를 실행합니다.

    컨테이너는 noVNC 포트 6080을 임의 호스트 포트에 매핑하고, REQUEST_ID/TARGET_URL/BACKEND_URL을 환경 변수로 받아
    `uiux_worker_service.py`를 실행합니다. 포트가 확인되면 프론트에서 바로 접속할 수 있는 VNC URL을 백엔드에 보고합니다.
    """
    print(f"[LOCAL DOCKER] Starting UIUX task requestId={request_id}, targetUrl={target_url}", flush=True)
    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        container_name = f"flowcheck-uiux-{request_id[:8]}"
        _remove_existing_container(container_name)
        command = [
            "docker",
            "run",
            "-d",
            "--name",
            container_name,
            "--label",
            f"flowcheck.uiux.request_id={request_id}",
            "-p",
            "127.0.0.1::6080",
            "--env-file",
            env_path,
            "-e",
            f"REQUEST_ID={request_id}",
            "-e",
            f"TARGET_URL={target_url}",
            "-e",
            f"BACKEND_URL={_container_backend_url()}",
            "-e",
            "PLAYWRIGHT_HEADLESS=false",
            "-e",
            f"VNC_KEEPALIVE_SECONDS={os.getenv('VNC_KEEPALIVE_SECONDS', '180')}",
            *_local_callback_env_args(),
            _docker_image_name(),
            "python",
            "uiux_worker_service.py",
        ]

        result = subprocess.run(command, check=True, capture_output=True, text=True, env=_docker_cli_env())
        container_id = result.stdout.strip()
        print(f"[LOCAL DOCKER] Container started id={container_id}, name={container_name}", flush=True)
        host_port = None
        for _ in range(10):
            host_port = _published_vnc_port(container_id)
            if host_port:
                break
            time.sleep(0.5)
        if not host_port:
            logs = _docker_logs(container_id)
            raise RuntimeError(f"VNC port was not published. Container logs: {logs}")
        vnc_url = f"http://127.0.0.1:{host_port}/vnc.html?autoconnect=true&resize=scale"
        print(f"[LOCAL DOCKER] VNC URL ready: {vnc_url}", flush=True)
        report_step(
            request_id,
            0,
            target_url,
            "STARTING_VNC",
            reason="Local browser container is ready and waiting for VNC connection.",
            vnc_url=vnc_url,
        )
    except Exception as exc:
        print(f"[LOCAL DOCKER] Failed: {exc}", flush=True)
        report_failure(request_id, f"Local Docker start failed: {exc}")


def _docker_cli_env() -> dict:
    """Docker CLI가 사용할 별도 설정 디렉터리를 준비합니다.

    프로젝트 내부 `.docker-cli`를 DOCKER_CONFIG로 지정해 사용자 전역 Docker 설정에 불필요한 파일을 쓰지 않도록 합니다.
    """
    env = os.environ.copy()
    docker_config = os.path.join(os.path.dirname(__file__), ".docker-cli")
    os.makedirs(docker_config, exist_ok=True)
    env["DOCKER_CONFIG"] = docker_config
    return env


def _remove_existing_container(container_name: str) -> None:
    """같은 request_id prefix로 남아 있는 이전 컨테이너를 정리합니다.

    실패한 테스트가 같은 이름을 점유하면 새 컨테이너 생성이 막히므로, 시작 전에 강제 제거를 시도합니다.
    """
    subprocess.run(
        ["docker", "rm", "-f", container_name],
        capture_output=True,
        text=True,
        env=_docker_cli_env(),
    )


def _docker_logs(container_id: str) -> str:
    """컨테이너 시작 실패 시 원인 파악용 최근 로그를 짧게 반환합니다."""
    try:
        result = subprocess.run(
            ["docker", "logs", "--tail", "80", container_id],
            capture_output=True,
            text=True,
            timeout=5,
            env=_docker_cli_env(),
        )
        output = (result.stdout + "\n" + result.stderr).strip()
        return output[-3000:] if output else "No container logs available."
    except Exception as exc:
        return f"Could not read container logs: {exc}"


def _published_vnc_port(container_id: str) -> Optional[str]:
    """Docker가 6080/tcp에 할당한 호스트 포트를 찾습니다.

    `docker port`가 가장 정확하지만 환경에 따라 비어 있을 수 있어, `docker ps --format {{.Ports}}` 출력도 보조로 파싱합니다.
    """
    port_result = subprocess.run(
        ["docker", "port", container_id, "6080/tcp"],
        capture_output=True,
        text=True,
        env=_docker_cli_env(),
    )
    if port_result.returncode == 0 and port_result.stdout.strip():
        return port_result.stdout.strip().rsplit(":", 1)[-1]

    ps_result = subprocess.run(
        ["docker", "ps", "--filter", f"id={container_id}", "--format", "{{.Ports}}"],
        capture_output=True,
        text=True,
        env=_docker_cli_env(),
    )
    if ps_result.returncode != 0:
        return None

    ports_text = ps_result.stdout.strip()
    for part in ports_text.split(","):
        part = part.strip()
        if "->6080/tcp" in part and ":" in part:
            return part.split("->", 1)[0].rsplit(":", 1)[-1]
    return None


def _required_env(names: List[str]) -> Dict[str, str]:
    """Fargate 실행에 반드시 필요한 환경 변수가 모두 있는지 검증합니다."""
    values = {name: os.getenv(name) for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required env for UIUX Fargate: {', '.join(missing)}")
    return {name: value or "" for name, value in values.items()}


def _optional_task_env() -> List[dict]:
    """워커 컨테이너에 선택적으로 전달할 환경 변수 목록을 ECS override 형식으로 만듭니다.

    Supabase 업로드 정보와 UI/UX 타임아웃 값처럼 없어도 실행 가능한 값만 포함합니다.
    """
    names = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "VNC_KEEPALIVE_SECONDS",
        "UIUX_INITIAL_PAGE_LOAD_TIMEOUT_MS",
        "UIUX_INITIAL_SETTLE_TIMEOUT_MS",
        "UIUX_LIGHTHOUSE_TIMEOUT_SECONDS",
        "UIUX_TEST_CALLBACK_TOKEN",
        "LOAD_TEST_CALLBACK_TOKEN",
    ]
    return [{"name": name, "value": value} for name in names if (value := os.getenv(name))]


def _wait_for_task_vnc_host(ecs_client, ec2_client, cluster: str, task_arn: str, request_id: str) -> str:
    """Fargate 태스크의 ENI에 IP가 붙을 때까지 폴링하고 VNC 접속 호스트를 반환합니다.

    ECS task description에서 ENI ID를 찾고 EC2 API로 private/public IP를 조회합니다. 보안 그룹과 네트워크 구조상
    사설 IP를 우선할지 여부는 ECS_UIUX_VNC_USE_PRIVATE_IP로 조정합니다.
    """
    max_attempts = int(os.getenv("ECS_UIUX_VNC_URL_MAX_ATTEMPTS", "45"))
    delay_seconds = float(os.getenv("ECS_UIUX_VNC_URL_POLL_SECONDS", "2"))
    prefer_private_ip = os.getenv("ECS_UIUX_VNC_USE_PRIVATE_IP", "true").lower() == "true"
    last_status = None

    for attempt in range(1, max_attempts + 1):
        task_desc = ecs_client.describe_tasks(cluster=cluster, tasks=[task_arn]).get("tasks", [{}])[0]
        last_status = task_desc.get("lastStatus")
        stopped_reason = task_desc.get("stoppedReason")
        print(
            f"[FARGATE] VNC network poll requestId={request_id}, attempt={attempt}/{max_attempts}, "
            f"lastStatus={last_status}, stoppedReason={stopped_reason}",
            flush=True,
        )

        if last_status == "STOPPED":
            raise RuntimeError(f"Fargate task stopped before VNC URL was assigned. {_describe_task_failure(ecs_client, cluster, task_arn)}")

        private_ip = None
        public_ip = None
        eni_id = _extract_eni_id(task_desc)
        if eni_id:
            eni_info = ec2_client.describe_network_interfaces(NetworkInterfaceIds=[eni_id])
            network_interface = eni_info["NetworkInterfaces"][0]
            private_ip = network_interface.get("PrivateIpAddress")
            public_ip = network_interface.get("Association", {}).get("PublicIp")

        selected_ip = private_ip if prefer_private_ip and private_ip else public_ip
        print(
            f"[FARGATE] VNC network address requestId={request_id}, eni={eni_id}, "
            f"privateIp={private_ip}, publicIp={public_ip}, selectedIp={selected_ip}, preferPrivate={prefer_private_ip}",
            flush=True,
        )

        if selected_ip:
            return selected_ip

        time.sleep(delay_seconds)

    raise RuntimeError(f"Timed out waiting for Fargate VNC network address. lastStatus={last_status}")


def run_fargate_task(request_id: str, target_url: str) -> None:
    """ECS Fargate에서 UI/UX 워커 태스크를 시작합니다.

    백엔드 콜백 URL과 테스트 대상 URL을 컨테이너 override로 주입하고, 태스크가 네트워크 주소를 받을 때까지 기다린 뒤
    noVNC 접속 URL을 진행 로그로 보고합니다. 시작 중 실패하면 가능한 한 ECS 태스크 상세까지 붙여 백엔드에 실패 처리합니다.
    """
    print(f"[FARGATE] Starting UIUX task requestId={request_id}, targetUrl={target_url}", flush=True)
    ecs_client = None
    task_arn = None
    cluster = None
    try:
        env = _required_env([
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "ECS_CLUSTER",
            "ECS_SUBNET_ID",
            "ECS_SECURITY_GROUP_ID",
        ])
        cluster = env["ECS_CLUSTER"]
        task_family = os.getenv("ECS_UIUX_TASK_FAMILY") or os.getenv("ECS_TASK_FAMILY")
        if not task_family:
            raise RuntimeError("Missing ECS_UIUX_TASK_FAMILY or ECS_TASK_FAMILY")

        container_name = os.getenv("ECS_UIUX_CONTAINER_NAME", "flowcheck-ai")
        fargate_backend_url = _fargate_backend_url()
        print(
            f"[FARGATE] run_task cluster={env['ECS_CLUSTER']}, taskFamily={task_family}, "
            f"container={container_name}, subnet={env['ECS_SUBNET_ID']}, sg={env['ECS_SECURITY_GROUP_ID']}, "
            f"region={AWS_REGION}, callback={fargate_backend_url}",
            flush=True,
        )
        ecs_client = boto3.client("ecs", region_name=AWS_REGION, config=AWS_CLIENT_CONFIG)
        ec2_client = boto3.client("ec2", region_name=AWS_REGION, config=AWS_CLIENT_CONFIG)

        response = ecs_client.run_task(
            cluster=cluster,
            launchType="FARGATE",
            taskDefinition=task_family,
            networkConfiguration={
                "awsvpcConfiguration": {
                    "subnets": [env["ECS_SUBNET_ID"]],
                    "securityGroups": [env["ECS_SECURITY_GROUP_ID"]],
                    "assignPublicIp": "ENABLED",
                }
            },
            overrides={
                "containerOverrides": [
                    {
                        "name": container_name,
                        "command": ["python", "uiux_worker_service.py"],
                        "environment": [
                            {"name": "REQUEST_ID", "value": request_id},
                            {"name": "TARGET_URL", "value": target_url},
                            {"name": "BACKEND_URL", "value": fargate_backend_url},
                            {"name": "PLAYWRIGHT_HEADLESS", "value": "false"},
                            *_optional_task_env(),
                        ],
                    }
                ]
            },
        )

        failures = response.get("failures") or []
        if failures:
            raise RuntimeError(f"ECS run_task failures: {failures}")

        task_arn = response["tasks"][0]["taskArn"]
        print(f"[FARGATE] Started taskArn={task_arn}", flush=True)
        report_step(
            request_id,
            0,
            target_url,
            "PROVISIONING_VNC",
            reason="Cloud browser task was submitted. Waiting for VNC network address.",
        )

        print("[FARGATE] Waiting for task VNC network address...", flush=True)
        vnc_host = _wait_for_task_vnc_host(ecs_client, ec2_client, cluster, task_arn, request_id)

        vnc_url = f"http://{vnc_host}:6080/vnc.html?autoconnect=true&resize=scale"
        print(f"[FARGATE] VNC URL ready: {vnc_url}", flush=True)
        report_step(
            request_id,
            0,
            target_url,
            "STARTING_VNC",
            reason="Cloud browser task is ready and waiting for VNC connection.",
            vnc_url=vnc_url,
        )
    except Exception as exc:
        failure_detail = str(exc)
        if ecs_client is not None and cluster and task_arn and "Task detail:" not in failure_detail:
            failure_detail = f"{failure_detail}. {_describe_task_failure(ecs_client, cluster, task_arn)}"
        print(f"[FARGATE] Failed: {failure_detail}", flush=True)
        report_failure(request_id, f"Fargate UIUX start failed: {failure_detail}")


def _describe_task_failure(ecs_client, cluster: str, task_arn: str) -> str:
    """Fargate 시작 실패 원인을 사람이 읽기 쉬운 문자열로 요약합니다.

    ECS는 실패 시 stoppedReason, stopCode, 컨테이너별 exitCode/reason을 나눠 제공하므로,
    이 정보를 한 줄로 합쳐 프론트와 로그에서 바로 확인할 수 있게 합니다.
    """
    try:
        tasks = ecs_client.describe_tasks(cluster=cluster, tasks=[task_arn]).get("tasks", [])
        if not tasks:
            return "Task detail: ECS returned no task description."

        task = tasks[0]
        parts = [
            f"lastStatus={task.get('lastStatus')}",
            f"desiredStatus={task.get('desiredStatus')}",
        ]
        if stopped_reason := task.get("stoppedReason"):
            parts.append(f"stoppedReason={stopped_reason}")
        if stop_code := task.get("stopCode"):
            parts.append(f"stopCode={stop_code}")

        for container in task.get("containers", []):
            container_parts = [
                f"name={container.get('name')}",
                f"lastStatus={container.get('lastStatus')}",
            ]
            if "exitCode" in container:
                container_parts.append(f"exitCode={container.get('exitCode')}")
            if reason := container.get("reason"):
                container_parts.append(f"reason={reason}")
            parts.append("container(" + ", ".join(container_parts) + ")")

        return "Task detail: " + "; ".join(parts)
    except Exception as detail_exc:
        return f"Task detail unavailable: {detail_exc}"


def _extract_eni_id(task_desc: dict) -> Optional[str]:
    """ECS task description의 attachments에서 Elastic Network Interface ID를 추출합니다."""
    for attachment in task_desc.get("attachments", []):
        if attachment.get("type") != "ElasticNetworkInterface":
            continue
        for detail in attachment.get("details", []):
            if detail.get("name") == "networkInterfaceId":
                return detail.get("value")
    return None
