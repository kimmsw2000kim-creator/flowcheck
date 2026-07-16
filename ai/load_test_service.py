"""Backward-compatible facade for the load-test service."""

from load_test.exceptions import LoadTestExecutionError, LoadTestGenerationError
from load_test.models import TestResultsResponse
from load_test.pipeline import run_load_test_pipeline

__all__ = [
    "LoadTestExecutionError",
    "LoadTestGenerationError",
    "TestResultsResponse",
    "run_load_test_pipeline",
]
