import os
import subprocess
import time
from typing import Dict, List, Optional

import boto3
import httpx
from botocore.config import Config
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")

load_dotenv(ENV_PATH, override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
AWS_CLIENT_CONFIG = Config(
    connect_timeout=5,
    read_timeout=20,
    retries={"max_attempts": 2, "mode": "standard"},
)


def _reload_runtime_env() -> None:
    global BACKEND_URL, AWS_REGION
    load_dotenv(ENV_PATH, override=True)
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
    AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")


def _is_local_backend() -> bool:
    return any(host in BACKEND_URL for host in ("localhost", "127.0.0.1", "host.docker.internal"))


def _use_fargate() -> bool:
    raw = os.getenv("USE_FARGATE")
    if raw is not None:
        return raw.lower() == "true"
    return not _is_local_backend()


def _post_backend(path: str, *, json_body: Optional[dict] = None, params: Optional[dict] = None) -> None:
    url = f"{BACKEND_URL}{path}"
    try:
        response = httpx.post(url, json=json_body, params=params, timeout=8.0)
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
    _post_backend(f"/api/uiux-tests/{request_id}/fail", params={"reason": reason})


def run_uiux_test_service(request_id: str, target_url: str) -> None:
    _reload_runtime_env()
    mode = "FARGATE" if _use_fargate() else "LOCAL_DOCKER"
    print(f"[UIUX ORCHESTRATOR] mode={mode}, USE_FARGATE={os.getenv('USE_FARGATE')}, BACKEND_URL={BACKEND_URL}", flush=True)
    if _use_fargate():
        run_fargate_task(request_id, target_url)
    else:
        run_local_docker_task(request_id, target_url)


def _container_backend_url() -> str:
    return BACKEND_URL.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")


def _fargate_backend_url() -> str:
    public_url = os.getenv("BACKEND_PUBLIC_URL", "").strip()
    if public_url:
        return public_url.rstrip("/")

    domain = os.getenv("DOMAIN", "").strip()
    if domain:
        return f"https://{domain}".rstrip("/")

    return BACKEND_URL.rstrip("/")


def _docker_image_name() -> str:
    return os.getenv("LOCAL_UIUX_IMAGE", "flowcheck-ai")


def run_local_docker_task(request_id: str, target_url: str) -> None:
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
    env = os.environ.copy()
    docker_config = os.path.join(os.path.dirname(__file__), ".docker-cli")
    os.makedirs(docker_config, exist_ok=True)
    env["DOCKER_CONFIG"] = docker_config
    return env


def _remove_existing_container(container_name: str) -> None:
    subprocess.run(
        ["docker", "rm", "-f", container_name],
        capture_output=True,
        text=True,
        env=_docker_cli_env(),
    )


def _docker_logs(container_id: str) -> str:
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
    values = {name: os.getenv(name) for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required env for UIUX Fargate: {', '.join(missing)}")
    return {name: value or "" for name, value in values.items()}


def _optional_task_env() -> List[dict]:
    names = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "VNC_KEEPALIVE_SECONDS",
        "UIUX_INITIAL_PAGE_LOAD_TIMEOUT_MS",
        "UIUX_INITIAL_SETTLE_TIMEOUT_MS",
        "UIUX_LIGHTHOUSE_TIMEOUT_SECONDS",
    ]
    return [{"name": name, "value": value} for name in names if (value := os.getenv(name))]


def _wait_for_task_vnc_host(ecs_client, ec2_client, cluster: str, task_arn: str, request_id: str) -> str:
    max_attempts = int(os.getenv("ECS_UIUX_VNC_URL_MAX_ATTEMPTS", "90"))
    delay_seconds = float(os.getenv("ECS_UIUX_VNC_URL_POLL_SECONDS", "1"))
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
    for attachment in task_desc.get("attachments", []):
        if attachment.get("type") != "ElasticNetworkInterface":
            continue
        for detail in attachment.get("details", []):
            if detail.get("name") == "networkInterfaceId":
                return detail.get("value")
    return None
