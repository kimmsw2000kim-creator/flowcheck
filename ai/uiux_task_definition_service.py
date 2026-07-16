import os

import boto3
from dotenv import load_dotenv

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

try:
    source = client.describe_task_definition(taskDefinition=SOURCE_TASK_FAMILY)["taskDefinition"]
    execution_role_arn = source.get("executionRoleArn")
    task_role_arn = source.get("taskRoleArn")
except Exception as exc:
    raise SystemExit(f"Failed to fetch source task definition {SOURCE_TASK_FAMILY}: {exc}") from exc

container_definition = {
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
