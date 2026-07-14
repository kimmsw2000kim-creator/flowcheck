import os
import json
import httpx
import time
import uuid
import boto3
from typing import Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")

try:
    ECS_CLUSTER = os.environ["ECS_CLUSTER"]
    ECS_TASK_FAMILY = os.environ["ECS_TASK_FAMILY"]
    ECS_SUBNET_ID = os.environ["ECS_SUBNET_ID"]
    ECS_SECURITY_GROUP_ID = os.environ["ECS_SECURITY_GROUP_ID"]
except KeyError as e:
    # Not critical to fail at import time if they run locally, but for fargate it is.
    pass

ecs_client = boto3.client('ecs', region_name=AWS_REGION)
ec2_client = boto3.client('ec2', region_name=AWS_REGION)

def report_step(request_id: str, step: int, url: str, action: str, selector: str = None, text: str = None, reason: str = None, error: str = None, vnc_url: str = None):
    payload = {
        "step": step,
        "url": url,
        "action": action,
        "selector": selector,
        "text": text,
        "reason": reason,
        "error": error
    }
    if vnc_url:
        payload["vncUrl"] = vnc_url
        
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/steps"
        print(f"Reporting step {step} to backend: {url_dest}")
        r = httpx.post(url_dest, json=payload, timeout=5.0)
    except Exception as e:
        print(f"Failed to send step: {e}")

def report_failure(request_id: str, reason: str):
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/fail"
        print(f"Reporting fail to backend: {url_dest}, Reason: {reason}")
        r = httpx.post(url_dest, params={"reason": reason}, timeout=5.0)
    except Exception as e:
        print(f"Failed to send failure: {e}")


def run_uiux_test_service(request_id: str, target_url: str):
    use_fargate = os.getenv("USE_FARGATE", "false").lower() == "true"
    
    if use_fargate:
        run_fargate_task(request_id, target_url)
    else:
        run_local_docker_task(request_id, target_url)

def run_local_docker_task(request_id: str, target_url: str):
    import subprocess
    print(f"[LOCAL DOCKER] Triggering UI Agent for requestId: {request_id}, targetUrl: {target_url}")
    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        ai_dir = os.path.abspath(os.path.dirname(__file__))
        container_backend_url = BACKEND_URL.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
        vnc_url = "http://127.0.0.1:6080/vnc.html?autoconnect=true&resize=scale"
        
        # 6080 포트는 호스트의 비어있는 포트로 매핑하거나, 고정 6080 사용 (로컬 테스트용이므로 하나만 돈다고 가정)
        cmd = [
            "docker", "run", "-d", "--rm",
            "-v", f"{ai_dir}:/app",
            "-p", "6080:6080",
            "--env-file", env_path,
            "-e", f"REQUEST_ID={request_id}",
            "-e", f"TARGET_URL={target_url}",
            "-e", f"BACKEND_URL={container_backend_url}",
            "-e", f"VNC_URL={vnc_url}",
            "-e", "PLAYWRIGHT_HEADLESS=false",
            "flowcheck-ai",
            "python", "run_playwright_job.py"
        ]
        
        subprocess.run(cmd, check=True)
        print("Local Docker container started successfully.")
        
        # 로컬 환경이므로 Public IP 대신 localhost 사용
        report_step(request_id, 0, target_url, "STARTING_VNC", reason="로컬 도커 브라우저 할당 완료 및 VNC 접속 대기 중", vnc_url=vnc_url)
        
    except Exception as e:
        err = f"Local Docker 시작 중 오류 발생: {str(e)}"
        print(err)
        report_failure(request_id, err)

def run_fargate_task(request_id: str, target_url: str):
    print(f"[FARGATE] Triggering UI Agent for requestId: {request_id}, targetUrl: {target_url}")
    
    # UIUX 전용 Task Family 환경변수가 없다면 기존 것을 쓰되, 실제 배포 시에는 분리 필수!
    task_family = os.environ.get("ECS_UIUX_TASK_FAMILY", ECS_TASK_FAMILY)
    container_name = os.environ.get("ECS_UIUX_CONTAINER_NAME", "flowcheck-ai")
    
    try:
        response = ecs_client.run_task(
            cluster=ECS_CLUSTER,
            launchType='FARGATE',
            taskDefinition=task_family,
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': [ECS_SUBNET_ID],
                    'securityGroups': [ECS_SECURITY_GROUP_ID],
                    'assignPublicIp': 'ENABLED'
                }
            },
            overrides={
                'containerOverrides': [
                    {
                        'name': container_name,
                        'command': ['python', 'run_playwright_job.py'],
                        'environment': [
                            {'name': 'REQUEST_ID', 'value': request_id},
                            {'name': 'TARGET_URL', 'value': target_url},
                            {'name': 'PLAYWRIGHT_HEADLESS', 'value': 'false'}
                        ]
                    }
                ]
            }
        )
        
        task_arn = response['tasks'][0]['taskArn']
        print(f"Started Fargate Task: {task_arn}")
        
        waiter = ecs_client.get_waiter('tasks_running')
        waiter.wait(
            cluster=ECS_CLUSTER,
            tasks=[task_arn],
            WaiterConfig={'Delay': 3, 'MaxAttempts': 40}
        )
        
        task_desc = ecs_client.describe_tasks(cluster=ECS_CLUSTER, tasks=[task_arn])['tasks'][0]
        eni_id = None
        for attachment in task_desc.get('attachments', []):
            if attachment.get('type') == 'ElasticNetworkInterface':
                for detail in attachment.get('details', []):
                    if detail.get('name') == 'networkInterfaceId':
                        eni_id = detail.get('value')
                        break
        
        if not eni_id:
            raise Exception("ENI ID를 찾을 수 없습니다.")
            
        eni_info = ec2_client.describe_network_interfaces(NetworkInterfaceIds=[eni_id])
        public_ip = eni_info['NetworkInterfaces'][0].get('Association', {}).get('PublicIp')
        
        if not public_ip:
            raise Exception("Public IP가 할당되지 않았습니다.")
            
        print(f"Fargate Task is RUNNING. Public IP: {public_ip}")
        vnc_url = f"http://{public_ip}:6080/vnc.html?autoconnect=true&resize=scale"
        report_step(request_id, 0, target_url, "STARTING_VNC", reason="클라우드 브라우저 할당 완료 및 VNC 접속 대기 중", vnc_url=vnc_url)
        
    except Exception as e:
        err = f"Fargate Task 시작 중 오류 발생: {str(e)}"
        print(err)
        report_failure(request_id, err)
