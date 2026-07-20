import gzip
import io
import json
import os
import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, Mock, call, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    import httpx
except ModuleNotFoundError:
    httpx = types.ModuleType("httpx")

    class Request:
        def __init__(self, method, url):
            self.method = method
            self.url = url

    class Response:
        def __init__(self, status_code, request=None, text=""):
            self.status_code = status_code
            self.request = request
            self.text = text

    class RequestError(Exception):
        def __init__(self, message, request=None):
            super().__init__(message)
            self.request = request

    class HTTPStatusError(RequestError):
        def __init__(self, message, request, response):
            super().__init__(message, request=request)
            self.response = response

    class ConnectError(RequestError):
        pass

    class ReadTimeout(RequestError):
        pass

    httpx.Request = Request
    httpx.Response = Response
    httpx.RequestError = RequestError
    httpx.HTTPStatusError = HTTPStatusError
    httpx.ConnectError = ConnectError
    httpx.ReadTimeout = ReadTimeout
    httpx.AsyncClient = object
    sys.modules["httpx"] = httpx

try:
    import boto3
except ModuleNotFoundError:
    boto3 = types.ModuleType("boto3")
    boto3.client = Mock()
    sys.modules["boto3"] = boto3

try:
    from botocore.exceptions import ClientError
except ModuleNotFoundError:
    botocore = types.ModuleType("botocore")
    botocore_exceptions = types.ModuleType("botocore.exceptions")

    class ClientError(Exception):
        def __init__(self, error_response, operation_name):
            self.response = error_response
            self.operation_name = operation_name
            super().__init__(str(error_response))

    botocore_exceptions.ClientError = ClientError
    botocore.exceptions = botocore_exceptions
    sys.modules["botocore"] = botocore
    sys.modules["botocore.exceptions"] = botocore_exceptions

from load_test.aws_executor import AwsSettings, run_k6_aws_fargate
from load_test.exceptions import LoadTestExecutionError, TargetUnavailableError
from load_test.models import LoadTestProgressUpdate, TestResultsResponse
from load_test.progress_publisher import publish_progress


AWS_ENV = {
    "S3_BUCKET": "bucket",
    "ECS_CLUSTER": "cluster",
    "ECS_TASK_FAMILY": "family",
    "ECS_SUBNET_ID": "subnet",
    "ECS_SECURITY_GROUP_ID": "security-group",
}


def progress_payload():
    return LoadTestProgressUpdate(
        status="RUNNING",
        phase="TEST",
        progress=10,
        message="testing",
    )


class AwsExecutorTest(unittest.TestCase):
    def build_clients(self):
        s3 = MagicMock()
        ecs = MagicMock()
        waiter = MagicMock()
        ecs.get_waiter.return_value = waiter
        ecs.run_task.return_value = {"tasks": [{"taskArn": "task-arn"}]}
        summary = {
            "metrics": {
                "http_reqs": {"count": 10, "rate": 5},
                "http_req_duration": {"avg": 120},
                "http_req_failed": {"value": 0.1},
            }
        }
        metric_lines = [
            {
                "type": "Point",
                "metric": "http_reqs",
                "data": {"time": "2026-01-01T00:00:00Z", "value": 10},
            },
            {
                "type": "Point",
                "metric": "http_req_duration",
                "data": {"time": "2026-01-01T00:00:00Z", "value": 120},
            },
            {
                "type": "Point",
                "metric": "http_req_failed",
                "data": {"time": "2026-01-01T00:00:00Z", "value": 0.1},
            },
        ]
        compressed_metrics = gzip.compress(
            "\n".join(json.dumps(item) for item in metric_lines).encode("utf-8")
        )

        def get_object(*, Bucket, Key):
            self.assertEqual("bucket", Bucket)
            if Key.endswith("summary.json"):
                return {"Body": io.BytesIO(json.dumps(summary).encode("utf-8"))}
            if Key.endswith("metrics.json.gz"):
                return {"Body": io.BytesIO(compressed_metrics)}
            raise AssertionError(f"unexpected S3 key: {Key}")

        s3.get_object.side_effect = get_object
        return s3, ecs, waiter

    def test_settings_require_all_environment_variables(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                AwsSettings.from_env()

    def test_executes_fargate_and_parses_result(self):
        s3, ecs, waiter = self.build_clients()
        with patch.dict(os.environ, AWS_ENV, clear=True), patch(
            "load_test.aws_executor.boto3.client", side_effect=[s3, ecs]
        ) as client_factory:
            result = run_k6_aws_fargate("script", 20, "request-1")

        self.assertEqual(
            [call("s3", region_name="ap-northeast-2"), call("ecs", region_name="ap-northeast-2")],
            client_factory.call_args_list,
        )
        s3.put_object.assert_called_once_with(
            Bucket="bucket",
            Key="tasks/request-1/script.js",
            Body=b"script",
        )
        ecs.run_task.assert_called_once()
        waiter.wait.assert_called_once_with(
            cluster="cluster",
            tasks=["task-arn"],
            WaiterConfig={"Delay": 10, "MaxAttempts": 60},
        )
        self.assertEqual(
            [
                call(Bucket="bucket", Key="tasks/request-1/summary.json"),
                call(Bucket="bucket", Key="tasks/request-1/metrics.json.gz"),
            ],
            s3.get_object.call_args_list,
        )
        self.assertEqual(5, result["real_tps"])
        self.assertEqual(10.0, result["real_error_rate"])
        self.assertEqual("COMPLETE", result["metrics_status"])
        self.assertEqual("MEASURED_K6", result["data_origin"])
        self.assertEqual(10, result["max_tps"])
        self.assertEqual(1, len(result["chart_points"]))

    def test_client_error_is_converted(self):
        s3, ecs, _waiter = self.build_clients()
        s3.put_object.side_effect = ClientError(
            {"Error": {"Code": "Denied", "Message": "denied"}},
            "PutObject",
        )
        with patch.dict(os.environ, AWS_ENV, clear=True), patch(
            "load_test.aws_executor.boto3.client", side_effect=[s3, ecs]
        ):
            with self.assertRaisesRegex(LoadTestExecutionError, "AWS 리소스"):
                run_k6_aws_fargate("script", 20, "request-1")

    def test_missing_metric_file_keeps_summary_available(self):
        s3, ecs, _waiter = self.build_clients()
        original_get_object = s3.get_object.side_effect

        def get_object(*, Bucket, Key):
            if Key.endswith("metrics.json.gz"):
                raise ClientError(
                    {"Error": {"Code": "NoSuchKey", "Message": "missing"}},
                    "GetObject",
                )
            return original_get_object(Bucket=Bucket, Key=Key)

        s3.get_object.side_effect = get_object
        with patch.dict(os.environ, AWS_ENV, clear=True), patch(
            "load_test.aws_executor.boto3.client", side_effect=[s3, ecs]
        ):
            result = run_k6_aws_fargate("script", 20, "request-1")

        self.assertEqual(5, result["real_tps"])
        self.assertEqual("UNAVAILABLE", result["metrics_status"])
        self.assertEqual("NOT_COLLECTED", result["data_origin"])
        self.assertEqual([], result["chart_points"])

    def test_unknown_error_is_converted(self):
        s3, ecs, _waiter = self.build_clients()
        ecs.run_task.return_value = {"tasks": []}
        with patch.dict(os.environ, AWS_ENV, clear=True), patch(
            "load_test.aws_executor.boto3.client", side_effect=[s3, ecs]
        ):
            with self.assertRaisesRegex(LoadTestExecutionError, "알 수 없는 오류"):
                run_k6_aws_fargate("script", 20, "request-1")


class ProgressPublisherTest(unittest.IsolatedAsyncioTestCase):
    async def test_skips_without_request_id_or_token(self):
        with patch("load_test.progress_publisher.httpx.AsyncClient") as client:
            await publish_progress(None, progress_payload())
            with patch.dict(os.environ, {}, clear=True):
                await publish_progress("request-1", progress_payload())
        client.assert_not_called()

    async def test_posts_progress(self):
        response = MagicMock()
        context_client = AsyncMock()
        context_client.post.return_value = response
        context_manager = MagicMock()
        context_manager.__aenter__ = AsyncMock(return_value=context_client)
        context_manager.__aexit__ = AsyncMock(return_value=None)

        with patch.dict(
            os.environ,
            {"LOAD_TEST_CALLBACK_TOKEN": "token", "BACKEND_URL": "http://backend"},
            clear=True,
        ), patch(
            "load_test.progress_publisher.httpx.AsyncClient",
            return_value=context_manager,
        ):
            await publish_progress("request-1", progress_payload())

        context_client.post.assert_awaited_once_with(
            "http://backend/api/load-tests/request-1/progress",
            headers={"X-Internal-Api-Key": "token"},
            json=progress_payload().model_dump(),
        )
        response.raise_for_status.assert_called_once()

    async def test_swallows_http_and_network_errors(self):
        request = httpx.Request("POST", "http://backend")
        response = httpx.Response(500, request=request, text="failed")
        errors = [
            httpx.HTTPStatusError("failed", request=request, response=response),
            httpx.ConnectError("failed", request=request),
        ]
        for error in errors:
            with self.subTest(error=type(error).__name__):
                context_client = AsyncMock()
                context_client.post.side_effect = error
                context_manager = MagicMock()
                context_manager.__aenter__ = AsyncMock(return_value=context_client)
                context_manager.__aexit__ = AsyncMock(return_value=None)
                with patch.dict(
                    os.environ,
                    {"LOAD_TEST_CALLBACK_TOKEN": "token"},
                    clear=True,
                ), patch(
                    "load_test.progress_publisher.httpx.AsyncClient",
                    return_value=context_manager,
                ):
                    await publish_progress("request-1", progress_payload())


class PipelineTest(unittest.IsolatedAsyncioTestCase):
    @patch("load_test.pipeline.build_markdown_report", return_value="report")
    @patch("load_test.pipeline.generate_analysis_report", new_callable=AsyncMock, return_value="analysis")
    @patch("load_test.pipeline.run_k6_aws_fargate")
    @patch("load_test.pipeline.generate_k6_script", new_callable=AsyncMock, return_value="script")
    @patch("load_test.pipeline.publish_progress", new_callable=AsyncMock)
    @patch("load_test.pipeline.validate_target_server", new_callable=AsyncMock)
    async def test_pipeline_orchestrates_phases_and_response(
        self,
        validate_target,
        publish,
        _generate_script,
        execute,
        generate_analysis,
        _build_report,
    ):
        from load_test.pipeline import run_load_test_pipeline

        execute.return_value = {
            "real_request_count": 129,
            "real_tps": 12.9,
            "real_avg_response": 120.456,
            "real_error_rate": 1.234,
            "is_server_dead": False,
            "duration": 10,
            "chart_points": [
                {
                    "time": "00:00",
                    "elapsedSeconds": 0,
                    "tps": 13,
                    "avgResponse": 120.46,
                    "p95Response": 180.0,
                    "errorRate": 1.23,
                    "vus": 2,
                }
            ],
            "max_tps": 13,
            "p95_response": 180.0,
            "metrics_status": "COMPLETE",
            "metrics_warning": None,
            "data_origin": "MEASURED_K6",
        }
        request = SimpleNamespace(
            requestId="request-1",
            targetUrl="https://example.com",
            vusers=2,
            duration=10,
            loadPrompt="",
        )

        result = await run_load_test_pipeline(Mock(), request)

        validate_target.assert_awaited_once_with("https://example.com")
        generate_analysis.assert_awaited_once()
        self.assertIsInstance(result, TestResultsResponse)
        self.assertEqual(129, result.totalRequests)
        self.assertEqual(12.9, result.avgTps)
        self.assertEqual(13, result.maxTps)
        self.assertEqual(120.46, result.avgResponse)
        self.assertEqual(180.0, result.p95Response)
        self.assertEqual(1.23, result.errorRate)
        self.assertEqual(1, len(result.points))
        self.assertEqual("COMPLETE", result.metricsStatus)
        self.assertEqual("MEASURED_K6", result.dataOrigin)
        self.assertEqual(1, result.bucketSeconds)
        self.assertEqual(
            ["GENERATING_SCRIPT", "PROVISIONING_INFRA", "PROCESSING_RESULTS", "RESULT_READY"],
            [item.args[1].phase for item in publish.await_args_list],
        )

    @patch("load_test.pipeline.generate_analysis_report", new_callable=AsyncMock)
    @patch("load_test.pipeline.run_k6_aws_fargate")
    @patch("load_test.pipeline.generate_k6_script", new_callable=AsyncMock)
    @patch("load_test.pipeline.publish_progress", new_callable=AsyncMock)
    @patch(
        "load_test.pipeline.validate_target_server",
        new_callable=AsyncMock,
        side_effect=TargetUnavailableError("unavailable"),
    )
    async def test_pipeline_stops_before_external_work_when_target_is_unavailable(
        self,
        validate_target,
        publish,
        generate_script,
        execute,
        generate_analysis,
    ):
        from load_test.pipeline import run_load_test_pipeline

        request = SimpleNamespace(
            requestId="request-1",
            targetUrl="https://unavailable.example.com",
            vusers=2,
            duration=10,
            loadPrompt="",
        )

        with self.assertRaises(TargetUnavailableError):
            await run_load_test_pipeline(Mock(), request)

        validate_target.assert_awaited_once_with(request.targetUrl)
        publish.assert_not_awaited()
        generate_script.assert_not_awaited()
        execute.assert_not_called()
        generate_analysis.assert_not_awaited()


class CompatibilityFacadeTest(unittest.TestCase):
    def test_facade_exports_existing_public_symbols(self):
        import load_test_service

        self.assertEqual(
            {
                "LoadTestExecutionError",
                "LoadTestGenerationError",
                "TargetUnavailableError",
                "TestResultsResponse",
                "run_load_test_pipeline",
            },
            set(load_test_service.__all__),
        )


if __name__ == "__main__":
    unittest.main()
