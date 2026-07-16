import asyncio
import ipaddress
import socket
from typing import List, Union
from urllib.parse import urlsplit

import httpx

from .exceptions import TargetUnavailableError

TARGET_CHECK_TIMEOUT_SECONDS = 5.0
TARGET_CHECK_USER_AGENT = "FlowCheck-Target-Check/1.0"

IpAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]


def _parse_target(target_url: str) -> tuple[str, int]:
    try:
        parsed = urlsplit(target_url)
        port = parsed.port
    except (TypeError, ValueError) as exc:
        raise TargetUnavailableError(
            "타겟 URL이 유효한 공개 HTTP(S) 주소가 아닙니다."
        ) from exc

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise TargetUnavailableError(
            "타겟 URL이 유효한 공개 HTTP(S) 주소가 아닙니다."
        )

    return parsed.hostname, port or (443 if parsed.scheme == "https" else 80)


def _resolve_target_addresses(hostname: str, port: int) -> List[IpAddress]:
    address_info = socket.getaddrinfo(
        hostname,
        port,
        type=socket.SOCK_STREAM,
    )
    return list(
        {
            ipaddress.ip_address(sockaddr[0].split("%", 1)[0])
            for _family, _type, _protocol, _canonical_name, sockaddr in address_info
        }
    )


def _is_public_address(address: IpAddress) -> bool:
    return (
        address.is_global
        and not address.is_multicast
        and not address.is_reserved
        and not address.is_unspecified
    )


async def validate_target_server(target_url: str) -> None:
    hostname, port = _parse_target(target_url)

    try:
        addresses = await asyncio.to_thread(_resolve_target_addresses, hostname, port)
    except (OSError, ValueError) as exc:
        raise TargetUnavailableError(
            "타겟 서버의 주소를 확인할 수 없습니다."
        ) from exc

    if not addresses or any(not _is_public_address(address) for address in addresses):
        raise TargetUnavailableError(
            "공개 인터넷 주소가 아닌 타겟에는 부하 테스트를 실행할 수 없습니다."
        )

    try:
        async with httpx.AsyncClient(
            timeout=TARGET_CHECK_TIMEOUT_SECONDS,
            follow_redirects=False,
        ) as client:
            response = await client.head(
                target_url,
                headers={"User-Agent": TARGET_CHECK_USER_AGENT},
            )
    except httpx.RequestError as exc:
        raise TargetUnavailableError(
            "타겟 서버에 연결할 수 없거나 현재 정상 응답하지 않습니다."
        ) from exc

    if not 200 <= response.status_code < 500:
        raise TargetUnavailableError(
            "타겟 서버에 연결할 수 없거나 현재 정상 응답하지 않습니다."
        )
