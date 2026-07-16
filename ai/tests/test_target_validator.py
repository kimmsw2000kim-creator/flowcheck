import os
import socket
import sys
import types
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    import httpx
except ModuleNotFoundError:
    httpx = types.ModuleType("httpx")

    class RequestError(Exception):
        def __init__(self, message, request=None):
            super().__init__(message)
            self.request = request

    class ConnectError(RequestError):
        pass

    class ReadTimeout(RequestError):
        pass

    httpx.RequestError = RequestError
    httpx.ConnectError = ConnectError
    httpx.ReadTimeout = ReadTimeout
    httpx.AsyncClient = object
    sys.modules["httpx"] = httpx

from load_test.exceptions import TargetUnavailableError
from load_test.target_validator import (
    TARGET_CHECK_TIMEOUT_SECONDS,
    TARGET_CHECK_USER_AGENT,
    validate_target_server,
)


PUBLIC_DNS_RESULT = [
    (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
]


def async_client_for_status(status_code):
    client = AsyncMock()
    client.head.return_value = MagicMock(status_code=status_code)
    context_manager = MagicMock()
    context_manager.__aenter__ = AsyncMock(return_value=client)
    context_manager.__aexit__ = AsyncMock(return_value=None)
    return client, context_manager


class TargetValidatorTest(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_invalid_scheme_or_missing_host(self):
        for target_url in ("ftp://example.com", "https://", "not-a-url"):
            with self.subTest(target_url=target_url):
                with self.assertRaises(TargetUnavailableError):
                    await validate_target_server(target_url)

    async def test_rejects_non_public_addresses(self):
        addresses = [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.1.1",
            "192.0.2.1",
            "224.0.0.1",
        ]
        for address in addresses:
            with self.subTest(address=address), patch(
                "load_test.target_validator.socket.getaddrinfo",
                return_value=[
                    (socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 80))
                ],
            ):
                with self.assertRaisesRegex(TargetUnavailableError, "공개 인터넷 주소"):
                    await validate_target_server("http://example.com")

    async def test_rejects_dns_failure(self):
        with patch(
            "load_test.target_validator.socket.getaddrinfo",
            side_effect=socket.gaierror("not found"),
        ):
            with self.assertRaisesRegex(TargetUnavailableError, "주소를 확인"):
                await validate_target_server("https://missing.example.com")

    async def test_accepts_2xx_through_4xx_without_following_redirects(self):
        for status_code in (200, 301, 401, 404):
            with self.subTest(status_code=status_code):
                client, context_manager = async_client_for_status(status_code)
                with patch(
                    "load_test.target_validator.socket.getaddrinfo",
                    return_value=PUBLIC_DNS_RESULT,
                ), patch(
                    "load_test.target_validator.httpx.AsyncClient",
                    return_value=context_manager,
                ) as client_factory:
                    await validate_target_server("https://example.com/path")

                client_factory.assert_called_once_with(
                    timeout=TARGET_CHECK_TIMEOUT_SECONDS,
                    follow_redirects=False,
                )
                client.head.assert_awaited_once_with(
                    "https://example.com/path",
                    headers={"User-Agent": TARGET_CHECK_USER_AGENT},
                )

    async def test_rejects_5xx_responses(self):
        for status_code in (500, 502, 503):
            with self.subTest(status_code=status_code):
                _client, context_manager = async_client_for_status(status_code)
                with patch(
                    "load_test.target_validator.socket.getaddrinfo",
                    return_value=PUBLIC_DNS_RESULT,
                ), patch(
                    "load_test.target_validator.httpx.AsyncClient",
                    return_value=context_manager,
                ):
                    with self.assertRaises(TargetUnavailableError):
                        await validate_target_server("https://example.com")

    async def test_converts_connection_tls_and_timeout_failures(self):
        request = MagicMock()
        errors = [
            httpx.ConnectError("connection refused", request=request),
            httpx.ConnectError("certificate verify failed", request=request),
            httpx.ReadTimeout("timed out", request=request),
        ]
        for error in errors:
            with self.subTest(error=str(error)):
                client, context_manager = async_client_for_status(200)
                client.head.side_effect = error
                with patch(
                    "load_test.target_validator.socket.getaddrinfo",
                    return_value=PUBLIC_DNS_RESULT,
                ), patch(
                    "load_test.target_validator.httpx.AsyncClient",
                    return_value=context_manager,
                ):
                    with self.assertRaises(TargetUnavailableError):
                        await validate_target_server("https://example.com")


if __name__ == "__main__":
    unittest.main()
