import json
from functools import lru_cache
from pathlib import Path
from string import Template
from typing import Any

from .exceptions import LoadTestGenerationError

DEFAULT_K6_TEMPLATE_PATH = (
    Path(__file__).resolve().parent / "templates" / "default_k6.js.template"
)


@lru_cache(maxsize=1)
def load_default_k6_template() -> Template:
    return Template(DEFAULT_K6_TEMPLATE_PATH.read_text(encoding="utf-8"))


def render_default_k6_script(
    target_url: str,
    vusers: int,
    duration: int,
) -> str:
    return load_default_k6_template().substitute(
        target_url=json.dumps(target_url),
        vusers=str(int(vusers)),
        duration=json.dumps(f"{int(duration)}s"),
    )


def build_k6_system_prompt(
    target_url: str,
    vusers: int,
    duration: int,
    load_prompt: str,
) -> str:
    return f"""
    너는 시니어 성능 테스트 엔지니어이자 k6 전문가야.
    다음 요구사항을 바탕으로 완벽하게 동작하는 k6 자바스크립트 코드를 작성해줘.

    [요구사항]
    - Target URL: {target_url}
    - 기본 가상 유저(VUs): {vusers}명
    - 테스트 지속 시간: {duration}초
    - 추가 시나리오 요건: {load_prompt}

    [조건]
    1. '추가 시나리오 요건'에 점진적 증가(Ramp-up)나 특정 부하 패턴이 명시되어 있다면, k6의 `stages` 옵션을 우선 고려하여 시나리오를 구성할 것.
    2. 특별한 시나리오 요건이 없다면 기본 `vus`와 `duration` 옵션을 사용할 것.
    3. 시나리오 요건에 맞는 HTTP 메서드와 대기 시간(Think time)을 구성할 것.
    3. 마크다운 기호(```javascript ... ```)를 절대 사용하지 말고, 순수한 자바스크립트 코드 텍스트만 반환할 것.
    4. 주석은 달지 말고, 코드만 반환할 것.
    """


def clean_k6_script(script_text: str) -> str:
    return (
        script_text.replace("```javascript", "")
        .replace("```js", "")
        .replace("```", "")
        .strip()
    )


async def generate_k6_script(
    client: Any,
    target_url: str,
    vusers: int,
    duration: int,
    load_prompt: str,
) -> str:
    if not (load_prompt or "").strip():
        try:
            return render_default_k6_script(target_url, vusers, duration)
        except Exception as exc:
            raise LoadTestGenerationError(
                "기본 k6 스크립트를 생성하지 못했습니다."
            ) from exc

    try:
        system_prompt = build_k6_system_prompt(
            target_url,
            vusers,
            duration,
            load_prompt,
        )
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=system_prompt,
        )
        generated_script = response.text.strip() if response.text is not None else ""
        return clean_k6_script(generated_script)
    except Exception as exc:
        raise LoadTestGenerationError(
            "LLM으로부터 k6 스크립트를 생성하지 못했습니다."
        ) from exc
