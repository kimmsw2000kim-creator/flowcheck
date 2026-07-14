import boto3
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
ECS_TASK_FAMILY = os.environ.get("ECS_TASK_FAMILY") # "k6-loadtest-task"

client = boto3.client('ecs', region_name=AWS_REGION)

# 1. k6 태스크 정의를 조회하여 Role ARN 등 설정 복사
try:
    response = client.describe_task_definition(taskDefinition=ECS_TASK_FAMILY)
    k6_task_def = response['taskDefinition']
    execution_role_arn = k6_task_def.get('executionRoleArn')
    task_role_arn = k6_task_def.get('taskRoleArn')
except Exception as e:
    print(f"Error fetching existing task def: {e}")
    exit(1)

# 2. 새로운 UI/UX 태스크 정의 등록
new_family = "flowcheck-uiux-task"

container_definition = {
    'name': 'flowcheck-ai',
    'image': 'docker.io/library/flowcheck-ai:latest', # 사용자의 Docker Hub 이미지 주소로 변경 필요. 현재 로컬 테스트이므로 기본값 부여.
    'cpu': 1024, # 1 vCPU
    'memory': 2048, # 2GB RAM
    'essential': True,
    'portMappings': [
        {
            'containerPort': 6080,
            'hostPort': 6080,
            'protocol': 'tcp'
        }
    ],
    'logConfiguration': {
        'logDriver': 'awslogs',
        'options': {
            'awslogs-group': '/ecs/flowcheck-uiux',
            'awslogs-region': AWS_REGION,
            'awslogs-stream-prefix': 'ecs',
            'awslogs-create-group': 'true'
        }
    }
}

try:
    response = client.register_task_definition(
        family=new_family,
        taskRoleArn=task_role_arn,
        executionRoleArn=execution_role_arn,
        networkMode='awsvpc',
        containerDefinitions=[container_definition],
        requiresCompatibilities=['FARGATE'],
        cpu='1024',
        memory='2048'
    )
    print(f"Successfully registered task definition: {new_family}")
except Exception as e:
    print(f"Failed to register task definition: {e}")
