class LoadTestGenerationError(RuntimeError):
    """Raised when a k6 script cannot be generated."""


class LoadTestExecutionError(RuntimeError):
    """Raised when the cloud load test cannot be executed."""


class TargetUnavailableError(LoadTestExecutionError):
    """Raised when the target cannot be safely reached before a load test."""
