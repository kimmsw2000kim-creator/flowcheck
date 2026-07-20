import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

from .exceptions import LoadTestExecutionError
from .models import DiagnosticMetrics
from .result_processor import LoadTestSummary, parse_k6_summary
from .time_series_aggregator import (
    MetricAggregationResult,
    MetricStreamParseError,
    aggregate_k6_metric_stream,
)
from .time_series_validator import validate_time_series_consistency

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AwsSettings:
    region: str
    s3_bucket: str
    ecs_cluster: str
    ecs_task_family: str
    ecs_subnet_id: str
    ecs_security_group_id: str

    @classmethod
    def from_env(cls) -> "AwsSettings":
        try:
            return cls(
                region=os.environ.get("AWS_REGION", "ap-northeast-2"),
                s3_bucket=os.environ["S3_BUCKET"],
                ecs_cluster=os.environ["ECS_CLUSTER"],
                ecs_task_family=os.environ["ECS_TASK_FAMILY"],
                ecs_subnet_id=os.environ["ECS_SUBNET_ID"],
                ecs_security_group_id=os.environ["ECS_SECURITY_GROUP_ID"],
            )
        except KeyError as exc:
            raise RuntimeError(f"필수 환경 변수가 설정되지 않았습니다: {exc}") from exc


def run_k6_aws_fargate(
    script_text: str,
    duration: int,
    request_id: Optional[str],
) -> LoadTestSummary:
    settings = AwsSettings.from_env()
    test_id = request_id if request_id else str(uuid.uuid4())
    script_s3_key = f"tasks/{test_id}/script.js"
    result_s3_key = f"tasks/{test_id}/summary.json"
    metrics_s3_key = f"tasks/{test_id}/metrics.json.gz"
    execution_s3_key = f"tasks/{test_id}/execution.json"

    try:
        s3_client = boto3.client("s3", region_name=settings.region)
        ecs_client = boto3.client("ecs", region_name=settings.region)

        s3_client.put_object(
            Bucket=settings.s3_bucket,
            Key=script_s3_key,
            Body=script_text.encode("utf-8"),
        )

        response = ecs_client.run_task(
            cluster=settings.ecs_cluster,
            launchType="FARGATE",
            taskDefinition=settings.ecs_task_family,
            networkConfiguration={
                "awsvpcConfiguration": {
                    "subnets": [settings.ecs_subnet_id],
                    "securityGroups": [settings.ecs_security_group_id],
                    "assignPublicIp": "ENABLED",
                }
            },
            overrides={
                "containerOverrides": [
                    {
                        "name": "k6-container",
                        "environment": [
                            {"name": "S3_BUCKET", "value": settings.s3_bucket},
                            {"name": "TEST_ID", "value": test_id},
                        ],
                    }
                ]
            },
        )

        task_arn = response["tasks"][0]["taskArn"]
        waiter = ecs_client.get_waiter("tasks_stopped")
        waiter.wait(
            cluster=settings.ecs_cluster,
            tasks=[task_arn],
            WaiterConfig={"Delay": 10, "MaxAttempts": 60},
        )

        result_obj = s3_client.get_object(
            Bucket=settings.s3_bucket,
            Key=result_s3_key,
        )
        summary_data: Dict[str, Any] = json.loads(
            result_obj["Body"].read().decode("utf-8")
        )
    except ClientError as exc:
        raise LoadTestExecutionError(
            f"AWS 리소스(S3, ECS) 접근 중 오류가 발생했습니다: {exc}"
        ) from exc
    except Exception as exc:
        raise LoadTestExecutionError(
            f"클라우드 부하 테스트 실행 중 알 수 없는 오류가 발생했습니다: {exc}"
        ) from exc

    summary = parse_k6_summary(summary_data, duration)
    execution_metadata = _load_execution_metadata(
        s3_client,
        settings.s3_bucket,
        execution_s3_key,
    )
    aggregation = _load_metric_aggregation(
        s3_client=s3_client,
        bucket=settings.s3_bucket,
        key=metrics_s3_key,
        duration=duration,
    )
    aggregation = validate_time_series_consistency(summary, aggregation, duration)
    diagnostics = aggregation.diagnostics or DiagnosticMetrics()
    diagnostics.executionExitCode = _optional_int(execution_metadata.get("exitCode"))
    diagnostics.thresholdFailures = summary.get("threshold_failures", [])
    summary.update(
        {
            "chart_points": aggregation.points,
            "max_tps": aggregation.max_tps,
            "p95_response": aggregation.p95_response,
            "metrics_status": aggregation.status,
            "metrics_warning": aggregation.warning,
            "data_origin": aggregation.data_origin,
            "diagnostic_metrics": diagnostics,
        }
    )
    return summary


def _load_execution_metadata(s3_client: Any, bucket: str, key: str) -> Dict[str, Any]:
    try:
        execution_obj = s3_client.get_object(Bucket=bucket, Key=key)
        return json.loads(execution_obj["Body"].read().decode("utf-8"))
    except (ClientError, KeyError, OSError, UnicodeError, json.JSONDecodeError):
        logger.warning("k6 execution metadata is unavailable: key=%s", key)
        return {}


def _optional_int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _load_metric_aggregation(
    s3_client: Any,
    bucket: str,
    key: str,
    duration: int,
) -> MetricAggregationResult:
    try:
        metrics_obj = s3_client.get_object(Bucket=bucket, Key=key)
        return aggregate_k6_metric_stream(metrics_obj["Body"], duration)
    except (ClientError, MetricStreamParseError, KeyError, OSError) as exc:
        logger.warning("Measured k6 time-series is unavailable: key=%s error=%s", key, exc)
        return MetricAggregationResult(
            points=[],
            request_count=0.0,
            avg_response=None,
            error_rate=None,
            max_tps=None,
            p95_response=None,
            status="UNAVAILABLE",
            warning="k6 실측 시계열을 읽지 못해 전체 요약 지표만 제공합니다.",
            data_origin="NOT_COLLECTED",
        )
