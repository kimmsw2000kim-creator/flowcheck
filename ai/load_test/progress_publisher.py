import logging
import os
from typing import Optional

import httpx

from .models import LoadTestProgressUpdate

logger = logging.getLogger(__name__)


async def publish_progress(
    request_id: Optional[str],
    payload: LoadTestProgressUpdate,
) -> None:
    if not request_id:
        return

    callback_token = os.getenv("LOAD_TEST_CALLBACK_TOKEN")
    if not callback_token:
        logger.error(
            "LOAD_TEST_CALLBACK_TOKEN is not configured; progress callback skipped"
        )
        return

    backend_url = os.getenv("BACKEND_URL", "http://localhost:8080")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{backend_url}/api/load-tests/{request_id}/progress",
                headers={"X-Internal-Api-Key": callback_token},
                json=payload.model_dump(),
            )
            response.raise_for_status()
            logger.info(
                "Progress callback delivered: request_id=%s phase=%s progress=%s",
                request_id,
                payload.phase,
                payload.progress,
            )
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Progress callback rejected: request_id=%s phase=%s status=%s body=%s",
            request_id,
            payload.phase,
            exc.response.status_code,
            exc.response.text[:500],
        )
    except httpx.RequestError:
        logger.exception(
            "Progress callback failed: request_id=%s phase=%s",
            request_id,
            payload.phase,
        )
