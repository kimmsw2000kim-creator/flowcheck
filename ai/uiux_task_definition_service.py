import os

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# UI/UX 브라우저 테스트를 ECS Fargate에서 실행하기 위한 태스크 정의 등록 스크립트입니다.
# 기존 백엔드 태스크 정의에서 IAM role을 재사용하고, UI/UX 워커 컨테이너 이미지/CPU/메모리/로그 설정만
# 별도로 구성해 `flowcheck-uiux-task` 계열의 ECS task definition revision을 새로 만듭니다.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
SOURCE_TASK_FAMILY = os.getenv("ECS_TASK_FAMILY")
UIUX_TASK_FAMILY = os.getenv("ECS_UIUX_TASK_FAMILY", "flowcheck-uiux-task")
CONTAINER_NAME = os.getenv("ECS_UIUX_CONTAINER_NAME", "flowcheck-ai")
DOCKER_USERNAME = os.getenv("DOCKER_USERNAME")
AI_IMAGE = os.getenv("AI_IMAGE", "flowcheck-ai")
ENABLE_AWSLOGS = os.getenv("ECS_UIUX_ENABLE_AWSLOGS", "true").lower() == "true"
AWSLOGS_GROUP = os.getenv("ECS_UIUX_AWSLOGS_GROUP", "/ecs/flowcheck-uiux")
UIUX_TASK_CPU = os.getenv("ECS_UIUX_TASK_CPU", "2048")
UIUX_TASK_MEMORY = os.getenv("ECS_UIUX_TASK_MEMORY", "4096")

if not SOURCE_TASK_FAMILY:
    raise SystemExit("ECS_TASK_FAMILY is required so the UIUX task can reuse its IAM roles.")

if not DOCKER_USERNAME:
    raise SystemExit("DOCKER_USERNAME is required to build the flowcheck-ai image URI.")

client = boto3.client("ecs", region_name=AWS_REGION)
logs_client = boto3.client("logs", region_name=AWS_REGION)


def ensure_log_group_exists(log_group_name: str) -> None:
    """UI/UX 태스크 로그를 받을 CloudWatch Logs 그룹을 보장합니다.

    ECS awslogs 드라이버는 지정된 로그 그룹이 없으면 태스크 시작 시 실패할 수 있으므로,
    태스크 정의를 등록하기 전에 미리 생성합니다. 이미 존재하는 경우는 정상 상태로 보고 넘어가고,
    그 외 AWS 오류는 설정 문제일 가능성이 높아 스크립트를 중단합니다.
    """
    try:
        logs_client.create_log_group(logGroupName=log_group_name)
        print(f"Created CloudWatch log group {log_group_name}")
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code == "ResourceAlreadyExistsException":
            print(f"CloudWatch log group already exists: {log_group_name}")
            return
        raise SystemExit(f"Failed to create CloudWatch log group {log_group_name}: {exc}") from exc

try:
    # UI/UX 워커도 동일한 AWS 리소스 접근 권한이 필요하므로, 기존 서비스 태스크 정의의 role ARN을 복사합니다.
    # 이렇게 하면 별도 IAM role을 만들지 않아도 Supabase/AWS/로그 권한 체계를 기존 배포와 맞출 수 있습니다.
    source = client.describe_task_definition(taskDefinition=SOURCE_TASK_FAMILY)["taskDefinition"]
    execution_role_arn = source.get("executionRoleArn")
    task_role_arn = source.get("taskRoleArn")
except Exception as exc:
    raise SystemExit(f"Failed to fetch source task definition {SOURCE_TASK_FAMILY}: {exc}") from exc

container_definition = {
    # VNC/noVNC 서버와 Playwright 워커가 함께 들어 있는 AI 이미지입니다.
    # 6080 포트는 테스트 실행 중 브라우저 화면을 사용자가 확인할 수 있도록 noVNC 웹 UI로 노출됩니다.
    "name": CONTAINER_NAME,
    "image": f"{DOCKER_USERNAME}/{AI_IMAGE}:latest",
    "cpu": int(UIUX_TASK_CPU),
    "memory": int(UIUX_TASK_MEMORY),
    "essential": True,
    "portMappings": [
        {
            "containerPort": 6080,
            "hostPort": 6080,
            "protocol": "tcp",
        }
    ],
}

if ENABLE_AWSLOGS:
    ensure_log_group_exists(AWSLOGS_GROUP)

    # Fargate 컨테이너 stdout/stderr를 CloudWatch Logs로 보내 장애 원인과 브라우저 워커 로그를 추적합니다.
    # `awslogs-create-group`은 IAM 권한이 더 필요할 수 있어 기본값은 false이고, 위에서 직접 생성하는 방식을 우선합니다.
    log_options = {
        "awslogs-group": AWSLOGS_GROUP,
        "awslogs-region": AWS_REGION,
        "awslogs-stream-prefix": "ecs",
    }
    if os.getenv("ECS_UIUX_AWSLOGS_CREATE_GROUP", "false").lower() == "true":
        log_options["awslogs-create-group"] = "true"

    container_definition["logConfiguration"] = {
        "logDriver": "awslogs",
        "options": log_options,
    }

try:
    # Fargate용 태스크 정의를 등록합니다. 네트워크는 awsvpc 모드가 필수이며,
    # CPU/메모리는 문자열 값 그대로 ECS API에 전달하고 컨테이너 제한에는 정수로 변환해 넣습니다.
    response = client.register_task_definition(
        family=UIUX_TASK_FAMILY,
        taskRoleArn=task_role_arn,
        executionRoleArn=execution_role_arn,
        networkMode="awsvpc",
        containerDefinitions=[container_definition],
        requiresCompatibilities=["FARGATE"],
        cpu=UIUX_TASK_CPU,
        memory=UIUX_TASK_MEMORY,
    )
    revision = response["taskDefinition"]["revision"]
    print(f"Registered {UIUX_TASK_FAMILY}:{revision} using image {DOCKER_USERNAME}/{AI_IMAGE}:latest")
except Exception as exc:
    raise SystemExit(f"Failed to register UIUX task definition: {exc}") from exc
