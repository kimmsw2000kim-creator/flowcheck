import os
import sys
import json
import httpx
import time
import base64
import subprocess
import tempfile
import math
from urllib.parse import urljoin, urlparse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

# 실제 UI/UX 테스트를 수행하는 워커입니다.
# 컨테이너 안에서 Playwright 브라우저를 띄워 대상 URL을 탐색하고, Lighthouse/axe-core/자체 DOM 규칙을 함께 실행합니다.
# 진행 상황은 백엔드 step API로 계속 보내고, 마지막에는 점수/결함/영상 URL을 하나의 리포트로 저장합니다.
# .env 로드
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://host.docker.internal:8080")
UIUX_CALLBACK_TOKEN = os.getenv("UIUX_TEST_CALLBACK_TOKEN") or os.getenv("LOAD_TEST_CALLBACK_TOKEN")
INITIAL_PAGE_LOAD_TIMEOUT_MS = int(os.getenv("UIUX_INITIAL_PAGE_LOAD_TIMEOUT_MS", "7000"))
INITIAL_SETTLE_TIMEOUT_MS = int(os.getenv("UIUX_INITIAL_SETTLE_TIMEOUT_MS", "250"))
LIGHTHOUSE_TIMEOUT_SECONDS = int(os.getenv("UIUX_LIGHTHOUSE_TIMEOUT_SECONDS", "60"))
LIGHTHOUSE_PRECHECK_TIMEOUT_SECONDS = float(os.getenv("UIUX_LIGHTHOUSE_PRECHECK_TIMEOUT_SECONDS", "10"))

UNIVERSAL_UIUX_AGENT_PROMPT = """
너는 범용 UI/UX 테스트 에이전트다.
목표는 특정 버튼을 무작정 누르는 것이 아니라, 현재 서비스의 핵심 사용자 과업을 발견하고 검증하는 것이다.

진행 원칙:
1. 화면의 제목, 본문, 내비게이션, 버튼, 링크, 입력창, URL을 보고 서비스 유형을 분류한다.
2. 분류는 업종명이 아니라 사용자가 수행할 수 있는 핵심 행동 기준으로 한다.
3. 가능한 유형은 commerce, content_workspace, community, media_content, game_interactive,
   saas_dashboard, booking_service, auth_portal, marketing_landing, unknown_mixed 이다.
4. 로그인/회원가입/결제/삭제/OAuth/개인정보 제출은 임의로 진행하지 않는다.
5. 클릭 자체는 성공이 아니다. 실행 후 결과를 success, auth_required, no_effect,
   skipped_no_candidate, failed_click 등으로 분류한다.
6. 인증 장벽이 발견되면 성공으로 처리하지 않고, 가능한 경우 닫거나 돌아간 뒤 다른 공개 과업을 탐색한다.
7. 최종 보고서는 성공한 과업, 인증에 막힌 과업, 후보가 없던 과업, 실제 UX 문제를 분리한다.
""".strip()

class UIUXTestScores(BaseModel):
    """최종 리포트의 항목별 점수 모델입니다.

    프론트와 백엔드가 같은 필드명을 기대하므로 `bestPractices`처럼 camelCase 필드는 그대로 유지합니다.
    """
    usability: int
    accessibility: int
    efficiency: int
    performance: int
    bestPractices: int
    overall: int

class UIUXTestDefect(BaseModel):
    """테스트 중 발견한 개별 결함을 표현합니다.

    source/rule_id/evidence는 결함이 어떤 엔진 또는 자체 규칙에서 왔는지 추적하기 위한 메타데이터이고,
    screenshot_url은 필요할 때 해당 시점의 화면 증거를 연결하기 위한 선택 필드입니다.
    """
    category: str
    selector: str
    severity: str
    description: str
    timestamp_offset: int
    source: Optional[str] = None
    rule_id: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    recommendation: Optional[str] = None
    screenshot_url: Optional[str] = None

class UIUXTestReportData(BaseModel):
    """백엔드에 저장할 UI/UX 테스트 리포트의 기본 데이터 구조입니다."""
    request_id: str
    scores: UIUXTestScores
    device_info: Dict[str, Any]
    video_url: Optional[str] = None
    defects: List[UIUXTestDefect]

def capture_live_frame(page) -> Optional[str]:
    """현재 브라우저 뷰포트를 JPEG data URL로 캡처합니다.

    단계별 진행 로그에 작은 스크린샷을 붙이기 위한 용도라 품질을 낮춰 전송 크기를 줄입니다.
    캡처 실패는 테스트 실패로 보지 않고 None을 반환해 다음 단계가 계속 진행되게 합니다.
    """
    try:
        screenshot = page.screenshot(type="jpeg", quality=45, full_page=False)
        encoded = base64.b64encode(screenshot).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception as e:
        print(f"Failed to capture live frame: {e}")
        return None


def report_step(request_id: str, step: int, url: str, action: str, selector: str = None, text: str = None, reason: str = None, error: str = None, vnc_url: str = None, screenshot_url: str = None):
    # UI에 표시되는 STEP은 여기서 백엔드로 보내는 "진행 로그"입니다.
    # 즉, 이 함수 자체가 브라우저를 조작하는 것은 아니고,
    # 이미 실행된 작업의 결과를 /api/uiux-tests/{requestId}/steps 에 저장하도록 요청합니다.
    # 프론트는 이 rawLogs 목록을 받아 타임라인처럼 보여줍니다.
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
    if screenshot_url:
        payload["screenshotUrl"] = screenshot_url
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/steps"
        headers = {"X-Internal-Api-Key": UIUX_CALLBACK_TOKEN} if UIUX_CALLBACK_TOKEN else None
        print(f"Reporting step {step} to backend: {url_dest}")
        r = httpx.post(url_dest, json=payload, headers=headers, timeout=5.0)
        r.raise_for_status()
    except Exception as e:
        print(f"Failed to send step: {e}")

def uiux_log(event: str, **fields):
    """워커 내부 진단 로그를 JSON 형태로 안전하게 출력합니다.

    긴 문자열과 리스트는 로그 폭주를 막기 위해 잘라내고, ensure_ascii=False로 한글 메시지를 그대로 남깁니다.
    """
    safe_fields = {}
    for key, value in fields.items():
        if isinstance(value, str):
            safe_fields[key] = value[:700]
        elif isinstance(value, list):
            safe_fields[key] = value[:12]
        else:
            safe_fields[key] = value
    print(f"[UIUX] {event} {json.dumps(safe_fields, ensure_ascii=False, default=str)}", flush=True)

def summarize_page_state(page) -> Dict[str, Any]:
    """현재 화면의 핵심 상태를 짧게 요약합니다.

    URL/title/본문 길이/비밀번호 입력/주요 링크와 버튼을 수집해, 클릭 전후 화면 변화 여부와 인증 장벽 여부를 판단하는
    기준 데이터로 사용합니다.
    """
    try:
        return page.evaluate("""
            () => {
                const visible = (el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                };
                const text = document.body ? document.body.innerText.slice(0, 3000) : '';
                const authText = /\uB85C\uADF8\uC778|\uB85C\uADF8\uC778\uD558\uC138\uC694|\uD68C\uC6D0\uAC00\uC785|\uBE44\uBC00\uBC88\uD638|\uC544\uC774\uB514|\uC774\uBA54\uC77C|login|sign\\s?in|sign\\s?up|password/i.test(text);
                const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible).length;
                const links = Array.from(document.querySelectorAll('a[href]')).filter(visible).slice(0, 20).map((a) => ({
                    text: (a.innerText || a.textContent || '').trim().slice(0, 80),
                    href: a.href
                }));
                const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'))
                    .filter(visible).slice(0, 20).map((el) => ({
                        text: (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 80)
                    }));
                return {
                    url: location.href,
                    title: document.title,
                    bodyLength: text.length,
                    passwordInputs,
                    authText,
                    likelyAuthWall: passwordInputs > 0 && authText,
                    visibleLinks: links,
                    visibleButtons: buttons
                };
            }
        """)
    except Exception as e:
        return {"url": getattr(page, "url", None), "error": str(e)}

def classify_site_type(page) -> Dict[str, Any]:
    """대상 사이트의 성격을 DOM 텍스트 기반으로 빠르게 분류합니다.

    제목, 헤딩, 내비게이션, 버튼, 링크, 입력 필드를 키워드 스코어링해 commerce/dashboard/auth_portal 같은
    사용자 과업 유형을 추정합니다. 이 결과는 이후 어떤 버튼/링크를 우선 탐색할지 결정하는 힌트입니다.
    """
    started_at = time.time()
    try:
        profile = page.evaluate("""
            () => {
                const visible = (el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                };
                const pickText = (selector, limit, maxScan = 120) => Array.from(document.querySelectorAll(selector))
                    .slice(0, maxScan)
                    .filter(visible)
                    .slice(0, limit)
                    .map((el) => (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim())
                    .filter(Boolean);
                const title = document.title || '';
                const headings = pickText('h1, h2, h3', 12, 80);
                const navTexts = pickText('nav a, header a, nav button, header button', 18, 80);
                const buttonTexts = pickText('button, [role="button"], input[type="button"], input[type="submit"]', 35, 120);
                const linkTexts = pickText('a[href]', 35, 140);
                const inputTexts = Array.from(document.querySelectorAll('input, textarea, select'))
                    .slice(0, 35)
                    .filter(visible)
                    .slice(0, 18)
                    .map((el) => [el.placeholder, el.name, el.id, el.getAttribute('aria-label'), el.type].filter(Boolean).join(' '))
                    .filter(Boolean);
                const body = (document.body ? (document.body.innerText || document.body.textContent || '') : '').slice(0, 2500);
                const haystack = [location.href, title, ...headings, ...navTexts, ...buttonTexts, ...linkTexts, ...inputTexts, body].join('\
').toLowerCase();
                const categories = {
                    commerce: ['상품','제품','가격','원','장바구니','구매','주문','결제','배송','리뷰','product','price','cart','checkout','order','shipping','buy'],
                    content_workspace: ['문서','노트','페이지','워크스페이스','공유','댓글','편집','템플릿','doc','docs','note','page','workspace','share','comment','edit','template'],
                    community: ['게시글','댓글','좋아요','팔로우','프로필','글쓰기','신고','태그','forum','post','comment','like','follow','profile','write','report','community'],
                    media_content: ['뉴스','블로그','영상','강의','아티클','읽기','시청','blog','news','video','course','article','watch','read'],
                    game_interactive: ['게임','플레이','시작','점수','랭킹','레벨','캐릭터','튜토리얼','play','game','score','ranking','level','character','tutorial'],
                    saas_dashboard: ['대시보드','필터','테이블','내보내기','분석','관리','상태','리포트','dashboard','filter','table','export','analytics','admin','status','report'],
                    booking_service: ['예약','일정','날짜','시간','좌석','신청','상담','인원','booking','reserve','schedule','date','time','seat','appointment'],
                    marketing_landing: ['기능','가격','문의','데모','시작하기','다운로드','고객사','pricing','demo','contact','feature','download','get started']
                };
                const scores = {};
                const evidence = {};
                for (const [type, keywords] of Object.entries(categories)) {
                    scores[type] = 0;
                    evidence[type] = [];
                    for (const keyword of keywords) {
                        const lower = keyword.toLowerCase();
                        const count = haystack.split(lower).length - 1;
                        if (count > 0) {
                            scores[type] += Math.min(12, count * 3);
                            if (evidence[type].length < 5) evidence[type].push(keyword);
                        }
                    }
                }
                const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible).length;
                const hasAuthText = /로그인|회원가입|비밀번호|login|sign\\s?in|sign\\s?up|password/i.test(body);
                const publicActionCount = buttonTexts.concat(linkTexts).filter((text) => !/로그인|회원가입|login|sign\\s?in|sign\\s?up/i.test(text)).length;
                if (passwordInputs > 0 && hasAuthText && publicActionCount < 4) {
                    scores.auth_portal = 40;
                    evidence.auth_portal = ['password input', 'login text', 'few public actions'];
                } else {
                    scores.auth_portal = 0;
                    evidence.auth_portal = [];
                }
                const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
                const [topType, topScore] = sorted[0] || ['unknown_mixed', 0];
                const secondScore = sorted[1] ? sorted[1][1] : 0;
                const confidence = topScore <= 0 ? 0.3 : Math.max(0.3, Math.min(0.95, topScore / Math.max(topScore + secondScore + 10, 1)));
                const primaryType = confidence < 0.55 ? 'unknown_mixed' : topType;
                const secondaryTypes = sorted
                    .filter(([type, score]) => type !== primaryType && score > 0 && score >= topScore * 0.45)
                    .slice(0, 3)
                    .map(([type]) => type);
                const taskMap = {
                    commerce: ['상품 목록/카테고리 탐색', '검색 또는 필터 사용', '상품 상세/장바구니 시도 후 인증 요구 여부 확인'],
                    content_workspace: ['문서/페이지 목록 탐색', '새 문서/템플릿/공유 affordance 확인', '댓글/협업 기능의 인증 요구 여부 확인'],
                    community: ['게시글 목록 탐색', '검색/태그/카테고리 확인', '댓글/글쓰기/좋아요의 인증 요구 여부 확인'],
                    media_content: ['주요 콘텐츠 탐색', '검색/카테고리 확인', '본문 가독성 및 관련 콘텐츠 이동 확인'],
                    game_interactive: ['시작/플레이 진입 확인', '튜토리얼/조작 안내 확인', '설정/랭킹/재시작 경로 확인'],
                    saas_dashboard: ['대시보드 요약 정보 확인', '필터/정렬/검색 확인', '생성/수정/내보내기 버튼의 위험도 분류'],
                    booking_service: ['예약 대상 탐색', '날짜/시간/인원 선택 가능성 확인', '신청 단계의 인증/개인정보 요구 여부 확인'],
                    marketing_landing: ['주요 CTA 확인', '기능/가격/문의 섹션 탐색', '문의 폼 검증'],
                    auth_portal: ['로그인 요구 안내 명확성 확인', '공개 도움말/가입/비밀번호 찾기 경로 확인', '인증 없이는 내부 기능을 실행하지 않음'],
                    unknown_mixed: ['첫 화면 목적 파악', '검색/탐색/주요 CTA 확인', '인증 또는 민감 액션 여부 분류']
                };
                return {
                    primaryType,
                    secondaryTypes,
                    confidence: Number(confidence.toFixed(2)),
                    evidence: evidence[primaryType] || [],
                    scores,
                    recommendedTasks: taskMap[primaryType] || taskMap.unknown_mixed,
                    observed: {
                        title,
                        headings: headings.slice(0, 6),
                        buttons: buttonTexts.slice(0, 10),
                        links: linkTexts.slice(0, 10),
                        inputs: inputTexts.slice(0, 10)
                    }
                };
            }
        """)
        uiux_log(
            "site.classified_fast",
            elapsedSeconds=round(time.time() - started_at, 3),
            primaryType=profile.get("primaryType"),
            confidence=profile.get("confidence"),
        )
        return profile
    except Exception as e:
        uiux_log("site.classification_failed", elapsedSeconds=round(time.time() - started_at, 3), error=str(e))
        return {
            "primaryType": "unknown_mixed",
            "secondaryTypes": [],
            "confidence": 0.0,
            "evidence": [str(e)],
            "recommendedTasks": ["첫 화면 목적 파악", "검색/탐색/주요 CTA 확인", "인증 또는 민감 액션 여부 분류"],
        }

def report_report(request_id: str, report_data: dict):
    """최종 평가 리포트를 백엔드에 저장합니다."""
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/report"
        headers = {"X-Internal-Api-Key": UIUX_CALLBACK_TOKEN} if UIUX_CALLBACK_TOKEN else None
        print(f"Reporting report to backend: {url_dest}")
        r = httpx.post(url_dest, json=report_data, headers=headers, timeout=5.0)
        r.raise_for_status()
    except Exception as e:
        if hasattr(e, 'response') and e.response:
            print(f"Failed to send report. Status: {e.response.status_code}, Body: {e.response.text}")
        else:
            print(f"Failed to send report: {e}")

def report_failure(request_id: str, reason: str):
    """워커 실행 전체가 실패했을 때 백엔드에 실패 상태를 보고합니다."""
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/fail"
        headers = {"X-Internal-Api-Key": UIUX_CALLBACK_TOKEN} if UIUX_CALLBACK_TOKEN else None
        print(f"Reporting fail to backend: {url_dest}, Reason: {reason}")
        r = httpx.post(url_dest, params={"reason": reason}, headers=headers, timeout=5.0)
    except Exception as e:
        print(f"Failed to send failure: {e}")

def upload_video_to_supabase(file_path: str, request_id: str) -> Optional[str]:
    """Playwright 녹화 파일을 Supabase Storage에 업로드하고 공개 URL을 반환합니다.

    Supabase 설정이 없으면 영상 업로드만 건너뛰고, 리포트 생성은 계속 진행합니다. 서비스 역할 키가 있으면 우선 사용하고
    없을 때 익명 키를 사용합니다.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        print("Supabase upload skipped: SUPABASE_URL or Supabase key is missing.")
        return None
        
    bucket_name = "ui-test-videos"
    dest_path = f"{request_id}.webm"
    url = f"{supabase_url}/storage/v1/object/{bucket_name}/{dest_path}"
    
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "video/webm",
        "x-upsert": "true",
    }
    
    try:
        with open(file_path, "rb") as f:
            file_data = f.read()
        r = httpx.post(url, headers=headers, content=file_data, timeout=60.0)
        if r.status_code in (200, 201):
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{dest_path}"
            return public_url
        print(f"Supabase upload failed: status={r.status_code}, body={r.text[:500]}")
        return None
    except Exception as e:
        print(f"Supabase upload crashed: {e}")
        return None

def severity_from_impact(impact: Optional[str]) -> str:
    """axe-core impact 값을 FlowCheck 결함 심각도 체계로 변환합니다."""
    return {
        "critical": "CRITICAL",
        "serious": "MAJOR",
        "moderate": "MINOR",
        "minor": "MINOR",
    }.get((impact or "").lower(), "MINOR")

def localize_axe_rule_id(rule_id: Optional[str]) -> Optional[str]:
    """axe-core rule ID를 한글 설명으로 변환합니다.

    axe 결과의 help 텍스트가 영어로 오더라도 사용자가 바로 이해할 수 있게, 자주 나오는 규칙은 rule_id 기준으로
    먼저 한글화합니다.
    """
    if not rule_id:
        return None
    mapping = {
        "color-contrast": "텍스트와 배경의 색상 대비가 WCAG 기준을 충족하지 않습니다.",
        "image-alt": "이미지에 대체 텍스트(alt)가 없습니다.",
        "button-name": "버튼에 접근 가능한 이름이 없습니다.",
        "link-name": "링크에 접근 가능한 텍스트가 없습니다.",
        "label": "폼 입력 요소에 연결된 라벨이 없습니다.",
        "aria-required-attr": "ARIA 역할에 필수 속성이 누락되었습니다.",
        "aria-required-children": "ARIA 역할에 필수 자식 요소가 없습니다.",
        "aria-required-parent": "ARIA 요소가 올바른 부모 요소 안에 있지 않습니다.",
        "aria-roles": "유효하지 않은 ARIA 역할이 사용되었습니다.",
        "aria-valid-attr": "유효하지 않은 ARIA 속성이 있습니다.",
        "aria-valid-attr-value": "ARIA 속성 값이 올바르지 않습니다.",
        "aria-hidden-body": "body 요소에 aria-hidden이 설정되어 있어 접근성을 차단합니다.",
        "aria-hidden-focus": "aria-hidden 요소 안에 포커스 가능한 요소가 있습니다.",
        "aria-allowed-attr": "해당 ARIA 역할에 허용되지 않는 속성이 있습니다.",
        "aria-prohibited-attr": "해당 요소에 사용이 금지된 ARIA 속성이 있습니다.",
        "frame-title": "iframe에 제목이 없습니다.",
        "frame-tested": "iframe 내부를 검사할 수 없습니다.",
        "html-lang-valid": "html 요소의 lang 속성이 유효하지 않습니다.",
        "html-has-lang": "html 요소에 lang 속성이 없습니다.",
        "document-title": "페이지 제목(title)이 없습니다.",
        "duplicate-id": "페이지 내에 중복된 id 값이 있습니다.",
        "duplicate-id-active": "포커스 가능한 요소에 중복된 id 값이 있습니다.",
        "duplicate-id-aria": "ARIA 참조에 사용된 id 값이 중복되어 있습니다.",
        "heading-order": "제목 계층 구조(h1~h6)가 올바르지 않습니다.",
        "landmark-one-main": "문서에 main 랜드마크가 하나만 있어야 합니다.",
        "landmark-complementary-is-top-level": "aside 랜드마크는 최상위 랜드마크여야 합니다.",
        "landmark-no-duplicate-banner": "banner 랜드마크가 두 개 이상 있습니다.",
        "landmark-no-duplicate-contentinfo": "contentinfo 랜드마크가 두 개 이상 있습니다.",
        "landmark-no-duplicate-main": "main 랜드마크가 두 개 이상 있습니다.",
        "region": "페이지의 주요 콘텐츠가 랜드마크 영역 안에 포함되지 않았습니다.",
        "skip-link": "키보드 사용자를 위한 건너뛰기 링크가 없습니다.",
        "tabindex": "tabindex 값이 0보다 크면 키보드 탐색 순서가 혼란스러워집니다.",
        "target-size": "클릭/터치 대상의 크기가 최소 권장 기준(44x44px)보다 작습니다.",
        "focus-trap": "포커스가 특정 영역에 갇혀 있어 키보드로 벗어날 수 없습니다.",
        "focusable-disabled": "비활성화된 요소가 포커스를 받고 있습니다.",
        "focusable-modal-open": "모달이 열려 있는 동안 배경 콘텐츠가 포커스 가능한 상태입니다.",
        "scrollable-region-focusable": "스크롤 가능한 영역이 키보드로 접근 가능하지 않습니다.",
        "select-name": "select 요소에 접근 가능한 이름이 없습니다.",
        "input-button-name": "입력 버튼에 접근 가능한 이름이 없습니다.",
        "input-image-alt": "이미지 입력 버튼에 대체 텍스트가 없습니다.",
        "object-alt": "object 요소에 대체 텍스트가 없습니다.",
        "video-caption": "동영상에 자막이 없습니다.",
        "audio-caption": "오디오 콘텐츠에 자막이 없습니다.",
        "th-has-data-cells": "th 요소에 연결된 데이터 셀이 없습니다.",
        "td-headers-attr": "td 요소의 headers 속성이 올바르지 않습니다.",
        "scope-attr-valid": "scope 속성 값이 올바르지 않습니다.",
        "table-duplicate-name": "표의 요약(summary)과 캡션(caption)이 동일합니다.",
        "table-fake-caption": "표의 캡션이 데이터 셀로 구현되어 있습니다.",
        "definition-list": "dl 요소의 구조가 올바르지 않습니다.",
        "dlitem": "dl 요소 안에 dt/dd가 올바르게 배치되지 않았습니다.",
        "list": "ul/ol 요소 안에 li 이외의 직계 자식이 있습니다.",
        "listitem": "li 요소가 ul 또는 ol 안에 없습니다.",
        "meta-refresh": "meta refresh로 자동 새로고침이 설정되어 있습니다.",
        "meta-viewport": "meta viewport가 사용자의 확대/축소를 막고 있습니다.",
        "p-as-heading": "단락(p)이 굵은 텍스트만으로 제목처럼 사용되고 있습니다.",
        "valid-lang": "lang 속성 값이 유효한 언어 코드가 아닙니다.",
        "blink": "blink 요소는 접근성에 좋지 않습니다.",
        "marquee": "marquee 요소는 접근성에 좋지 않습니다.",
    }
    return mapping.get(rule_id)


# ---- axe-core violation.help 텍스트 → 한글 번역 테이블 ----
# axe-core의 violation.help 필드에 들어오는 영어 원문을 한글로 매핑합니다.
# 출처: https://github.com/dequelabs/axe-core/blob/develop/lib/rules/*.json
_AXE_HELP_TEXT_KO: Dict[str, str] = {
    # 색상 대비
    "Background and foreground colors do not have a sufficient contrast ratio.": "텍스트와 배경의 색상 대비 비율이 충분하지 않습니다.",
    "Background and foreground colors do not have a sufficient contrast ratio": "텍스트와 배경의 색상 대비 비율이 충분하지 않습니다.",
    # 버튼/링크
    "Buttons must have discernible text": "버튼에 인식 가능한 텍스트나 접근성 이름이 있어야 합니다.",
    "Links must have discernible text": "링크에 인식 가능한 텍스트나 접근성 이름이 있어야 합니다.",
    "Interactive controls must not be nested": "인터랙티브 컨트롤은 중첩해서 배치할 수 없습니다.",
    # 이미지
    "Images must have alternate text": "이미지에 대체 텍스트(alt)가 있어야 합니다.",
    "Image buttons must have alternate text": "이미지 버튼에 대체 텍스트(alt)가 있어야 합니다.",
    "<img> elements with [usemap] must use <map> and <area> elements": "usemap 속성이 있는 img 요소는 map과 area 요소를 함께 사용해야 합니다.",
    # 폼
    "Form elements must have labels": "폼 입력 요소에 라벨이 있어야 합니다.",
    "Select element must have an accessible name": "select 요소에 접근 가능한 이름이 있어야 합니다.",
    "Form field must not have multiple label elements": "폼 필드에 label 요소가 두 개 이상 있어서는 안 됩니다.",
    # ARIA
    "Required ARIA attributes must be provided": "ARIA 역할에 필수 속성이 제공되어야 합니다.",
    "Required ARIA children role must be present": "ARIA 역할에 필수 자식 역할이 포함되어야 합니다.",
    "Required ARIA parent role must be present": "ARIA 요소가 올바른 부모 역할 안에 있어야 합니다.",
    "ARIA roles used must conform to valid values": "사용된 ARIA 역할이 유효한 값이어야 합니다.",
    "ARIA attributes must conform to valid values": "ARIA 속성이 유효한 값을 가져야 합니다.",
    "ARIA attributes must conform to valid names": "ARIA 속성 이름이 올바른 형식이어야 합니다.",
    "Ensures aria-hidden='true' is not present on the document body.": "document body에 aria-hidden='true'를 사용하면 안 됩니다.",
    "ARIA hidden element must not contain focusable elements": "aria-hidden 요소 안에 포커스 가능한 요소가 있으면 안 됩니다.",
    "ARIA commands must have an accessible name": "ARIA 커맨드 요소에 접근 가능한 이름이 있어야 합니다.",
    "ARIA meter must have accessible name": "ARIA meter 요소에 접근 가능한 이름이 있어야 합니다.",
    "ARIA progressbar must have accessible name": "ARIA progressbar 요소에 접근 가능한 이름이 있어야 합니다.",
    "ARIA toggle fields must have an accessible name": "ARIA 토글 필드에 접근 가능한 이름이 있어야 합니다.",
    "ARIA tooltip must have an accessible name": "ARIA 툴팁에 접근 가능한 이름이 있어야 합니다.",
    "ARIA treeitem must have an accessible name": "ARIA treeitem에 접근 가능한 이름이 있어야 합니다.",
    "Elements must only use permitted ARIA attributes": "허용된 ARIA 속성만 사용해야 합니다.",
    "Certain ARIA roles must contain particular children": "특정 ARIA 역할은 정해진 자식 요소를 포함해야 합니다.",
    "Certain ARIA roles must be contained by particular parents": "특정 ARIA 역할은 정해진 부모 요소 안에 배치되어야 합니다.",
    # HTML 구조
    "<html> element must have a lang attribute": "html 요소에 lang 속성을 추가하세요.",
    "<html> element must have a valid value for the lang attribute": "html 요소의 lang 속성에 유효한 언어 코드를 사용하세요.",
    "Page must have means to bypass repeated blocks": "반복되는 블록을 건너뛸 수 있는 수단을 제공해야 합니다.",
    "Page must have a level-one heading": "페이지에 최상위 제목(h1)이 있어야 합니다.",
    "Page must contain a main landmark": "페이지에 main 랜드마크가 있어야 합니다.",
    "Document must have one main landmark": "문서에 main 랜드마크가 하나만 있어야 합니다.",
    "All page content must be contained by landmarks": "모든 페이지 콘텐츠는 랜드마크 영역 안에 포함되어야 합니다.",
    "Document should not have more than one banner landmark": "banner 랜드마크가 두 개 이상 있어서는 안 됩니다.",
    "Document should not have more than one contentinfo landmark": "contentinfo 랜드마크가 두 개 이상 있어서는 안 됩니다.",
    "Document should not have more than one main landmark": "main 랜드마크가 두 개 이상 있어서는 안 됩니다.",
    # 제목
    "Heading levels should only increase by one": "제목 계층은 한 단계씩만 올라가야 합니다.",
    "Page must have a title": "페이지에 제목(title)이 있어야 합니다.",
    # ID 중복
    "id attribute value must be unique": "id 속성 값이 페이지 내에서 유일해야 합니다.",
    "IDs used in ARIA and target must be unique": "ARIA 참조에 사용된 id 값이 유일해야 합니다.",
    "IDs of active elements must be unique": "활성 요소의 id 값이 유일해야 합니다.",
    # 링크
    "Links with the same name must have a similar purpose": "같은 이름의 링크는 같은 목적이어야 합니다.",
    # 테이블
    "Tables should not have both cells and role=presentation": "표에 데이터 셀과 presentation 역할을 함께 사용할 수 없습니다.",
    # 탭인덱스
    "Elements should not have tabindex greater than zero": "tabindex 값을 0 또는 -1로 설정하세요.",
    # 비디오/오디오
    "<video> elements must have captions": "video 요소에 자막이 있어야 합니다.",
    "<video> elements must have an audio description track": "video 요소에 오디오 설명 트랙이 있어야 합니다.",
    # 언어
    "<html> element must have a valid value for the xml:lang attribute": "html 요소의 xml:lang 속성에 유효한 언어 코드를 사용하세요.",
    "lang attribute must have a valid value": "lang 속성에 유효한 언어 코드를 사용하세요.",
    # 터치 대상
    "All interactive elements must be large enough to be easily activated": "모든 인터랙티브 요소는 터치/클릭하기 충분한 크기여야 합니다.",
    # Lighthouse 색상 대비 description (dequeuniversity 링크 포함 버전)
    "Low-contrast text is difficult or impossible for many users to read.": "명도 대비가 낮은 텍스트는 많은 사용자가 읽기 어렵습니다. 텍스트와 배경의 대비 비율을 4.5:1 이상으로 높이세요.",
    # Lighthouse 기타 audit description 패턴
    "Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds": "텍스트와 배경의 색상 대비가 WCAG AA 기준(4.5:1)을 충족해야 합니다.",
}

# ---- Lighthouse audit description 한글 번역 테이블 ----
# Lighthouse audit.description 전체 문자열 → 한글 매핑
# 출처: https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/
_LIGHTHOUSE_DESC_KO: Dict[str, str] = {
    # 접근성 - 색상 대비
    "Ensure the color-contrast of the text is high enough": "텍스트 색상 대비를 충분히 높이세요.",
    # 접근성 - 이미지
    "Ensures <img> elements have alternate text or a role of none or presentation": "img 요소에 alt 텍스트를 추가하거나 장식용이면 role=presentation으로 표시하세요.",
    # 접근성 - 버튼
    "Ensures buttons have discernible text": "버튼에 인식 가능한 텍스트나 aria-label을 추가하세요.",
    # 접근성 - 링크
    "Ensures links have discernible text": "링크에 인식 가능한 텍스트나 aria-label을 추가하세요.",
    # 접근성 - 폼
    "Ensures every form element has a label": "모든 폼 요소에 label 또는 aria-label을 제공하세요.",
    # 모범 사례
    "Does not use deprecated APIs": "더 이상 지원되지 않는 API 사용을 제거하세요.",
    "Browser errors were logged to the console": "브라우저 콘솔에 오류가 기록되었습니다. 누락된 리소스나 스크립트 예외를 확인하세요.",
    "Page has the HTML doctype": "HTML 문서 최상단에 <!DOCTYPE html>을 선언하세요.",
    "Avoids front-end JavaScript libraries with known security vulnerabilities": "알려진 보안 취약점이 있는 JavaScript 라이브러리 사용을 피하세요.",
    "Allows users to zoom in and out of the page by not using the 'user-scalable=no' param": "meta viewport에서 user-scalable=no를 제거해 사용자가 화면을 확대할 수 있게 하세요.",
    "Issues were logged in the Issues panel in Chrome Devtools": "Chrome DevTools 이슈 패널에 문제가 기록되었습니다.",
    "Avoid requesting the geolocation permission on page load": "페이지 로드 시 위치 정보 권한을 자동으로 요청하지 마세요.",
    "Avoid requesting the notification permission on page load": "페이지 로드 시 알림 권한을 자동으로 요청하지 마세요.",
    "Displays images with incorrect aspect ratio": "이미지가 원래 비율과 다르게 표시되고 있습니다.",
    "Detected JavaScript libraries": "감지된 JavaScript 라이브러리 목록입니다.",
    # 성능 - Lighthouse 공식 문서 기반
    "Avoid chaining critical requests by reducing the length of chains, reducing the download size of resources, or deferring the download of unnecessary resources to improve page load.": "중요 요청 체인의 길이와 리소스 다운로드 크기를 줄이고, 불필요한 리소스는 지연 로드해 페이지 로딩 성능을 개선하세요.",
    "Requests are blocking the page's initial render, which may delay LCP. Deferring or inlining can move these network requests out of the critical path.": "초기 렌더링을 막는 요청이 있어 LCP가 지연될 수 있습니다. 핵심 리소스는 인라인 처리하고, 비핵심 CSS/JavaScript는 defer, async 또는 지연 로딩으로 critical path 밖으로 이동하세요.",
}


import re as _re

def _strip_markdown_links(text: str) -> str:
    """마크다운 링크 [text](url) 와 단독 URL을 제거하고 링크 텍스트만 남깁니다."""
    # [링크 텍스트](URL) → 링크 텍스트
    text = _re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # 단독 URL 제거
    text = _re.sub(r'https?://\S+', '', text)
    return ' '.join(text.split()).strip()


def localize_uiux_text(text: Optional[str]) -> Optional[str]:
    """외부 검사 엔진이 반환한 영어 설명을 사용자용 한국어 문장으로 바꿉니다.

    마크다운 링크 제거, axe/Lighthouse 직접 매핑, exact-match 치환, 패턴 기반 번역 순서로 처리합니다.
    매핑하지 못한 문장은 원문을 그대로 반환해 정보 손실을 피합니다.
    """
    if not text:
        return text
    # 1단계: 마크다운 링크/URL 제거 후 정규화
    stripped = _strip_markdown_links(str(text))
    normalized = " ".join(stripped.strip().split())
    # 2단계: axe help 텍스트 직접 매핑 (마침표 유무 무관)
    for src, tgt in _AXE_HELP_TEXT_KO.items():
        src_norm = src.rstrip(".")
        if normalized.rstrip(".") == src_norm:
            return tgt
    # 3단계: Lighthouse description 직접 매핑
    for src, tgt in _LIGHTHOUSE_DESC_KO.items():
        if normalized.rstrip(".") == src.rstrip("."):
            return tgt
    # 4단계: 기존 exact-match 테이블
    replacements = {
        # 버튼/링크 접근성
        "Buttons must have discernible text": "버튼에는 사용자가 이해할 수 있는 텍스트나 접근성 이름이 있어야 합니다.",
        "Links must have discernible text": "링크에는 사용자가 이해할 수 있는 텍스트나 접근성 이름이 있어야 합니다.",
        "Ensures buttons have discernible text": "버튼에 접근 가능한 텍스트나 이름을 추가하세요.",
        "Ensures links have discernible text": "링크에 접근 가능한 텍스트나 이름을 추가하세요.",
        "An interactive element has no accessible name.": "인터랙티브 요소에 접근성 이름이 없습니다.",
        "Add clear text or aria-label to buttons and links.": "버튼과 링크에 명확한 텍스트를 넣거나 aria-label을 제공하세요.",
        # 색상 대비
        "Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds": "텍스트와 배경의 색상 대비가 WCAG AA 기준을 충족해야 합니다. 색상 대비 비율을 4.5:1 이상으로 높이세요.",
        "Elements must meet minimum color contrast ratio thresholds": "텍스트와 배경의 색상 대비가 최소 기준을 충족해야 합니다.",
        # 이미지 대체 텍스트
        "Image elements must have alternate text": "이미지에는 대체 텍스트가 있어야 합니다.",
        "Ensures <img> elements have alternate text or a role of none or presentation": "img 요소에 대체 텍스트(alt)를 추가하거나, 장식용이면 alt=\"\"로 설정하세요.",
        "Images must have alternate text": "이미지에 대체 텍스트를 제공하세요.",
        # 폼 라벨
        "Form elements must have labels": "폼 입력 요소에는 연결된 라벨이 있어야 합니다.",
        "Ensures every form element has a label": "모든 폼 입력 요소에 label 또는 aria-label을 제공하세요.",
        "Ensures the label element has a text label and is associated with a form control": "label 요소에 텍스트와 연결된 폼 컨트롤이 있어야 합니다.",
        # ARIA
        "Ensures all ARIA attributes have valid values": "모든 ARIA 속성에 유효한 값을 설정하세요.",
        "Ensures role attribute has an appropriate value for the element": "role 속성에 해당 요소에 적합한 값을 사용하세요.",
        "Ensures every ARIA input field has an accessible name": "ARIA 입력 필드에 접근 가능한 이름을 제공하세요.",
        "Ensures elements with an ARIA role that require child roles contain them": "ARIA 역할에 필요한 자식 요소가 있는지 확인하세요.",
        "Ensures elements with an ARIA role that require parent roles are contained by them": "ARIA 요소가 올바른 부모 역할 안에 배치되어 있는지 확인하세요.",
        # HTML 구조
        "Ensures every HTML document has a lang attribute": "html 요소에 lang 속성을 추가하세요. 예: <html lang=\"ko\">.",
        "Ensures the lang attribute of the <html> element has a valid value": "html 요소의 lang 속성에 유효한 언어 코드(예: ko, en)를 사용하세요.",
        "Ensures that every page has at least one mechanism allowing users to bypass navigation": "키보드 사용자를 위해 본문으로 바로 이동하는 건너뛰기 링크를 제공하세요.",
        "Ensures the document has at most one main landmark": "문서에 main 랜드마크는 하나만 있어야 합니다.",
        "Ensures all page content is contained by landmarks": "페이지 콘텐츠는 header, main, nav, footer 같은 랜드마크 영역 안에 배치하세요.",
        # 제목 구조
        "Ensures the order of headings is semantically correct": "제목 계층(h1 → h2 → h3 …)이 순서대로 사용되고 있는지 확인하세요.",
        "Ensures the document has a title element and its contents are not empty": "페이지에 의미 있는 title 요소를 추가하세요.",
        # 중복 ID
        "Ensures every id attribute value is unique": "페이지 내 id 값이 중복되지 않도록 수정하세요.",
        "Ensures every id attribute value used in ARIA and target attributes is unique": "ARIA 참조에 사용된 id 값이 중복되지 않도록 수정하세요.",
        # iframe
        "Ensures <iframe> and <frame> elements have an accessible name": "iframe에 title 속성을 추가해 콘텐츠를 설명하세요.",
        # 탭인덱스
        "Ensures that tabindex attribute values are not greater than 0": "tabindex 값을 0 또는 -1로 설정해 자연스러운 키보드 탐색 순서를 유지하세요.",
        # 스크롤 영역
        "Ensures elements that have scrollable content are accessible by keyboard": "스크롤 가능한 영역에 tabindex=\"0\"을 추가해 키보드로 접근 가능하게 만드세요.",
        # meta viewport
        "Ensures <meta name=\"viewport\"> does not disable text scaling and zooming": "meta viewport에서 user-scalable=no 또는 maximum-scale=1을 제거해 사용자가 확대할 수 있도록 하세요.",
        # 리스트 구조
        "Ensures that lists are structured correctly": "ul/ol 요소 안에는 li 요소만 직접 자식으로 넣으세요.",
        "Ensures <li> elements are used semantically": "li 요소는 ul 또는 ol 안에서만 사용하세요.",
        # 접근성/UX 기타
        "Make clickable elements at least 44x44px and keep enough spacing around them.": "클릭 가능한 요소는 최소 44x44px 이상으로 만들고 주변 간격을 충분히 확보하세요.",
        "An accessibility issue was detected.": "접근성 문제가 감지되었습니다.",
        "Password requirements are not explained before input.": "비밀번호 입력 조건이 입력 전에 안내되지 않습니다.",
        "Show password length and character requirements near the field before submission.": "제출 전에 비밀번호 길이와 문자 조합 조건을 입력 필드 가까이에 표시하세요.",
        "Declare <!doctype html> at the top of the document.": "문서 최상단에 <!doctype html>을 선언하세요.",
        "Add rel=\"noopener noreferrer\" to target=_blank links.": "target=_blank 링크에는 rel=\"noopener noreferrer\"를 추가하세요.",
        "Use specific CTA text so users can predict the next action.": "사용자가 다음 행동을 예측할 수 있도록 구체적인 CTA 문구를 사용하세요.",
        # 성능 지표
        "First Contentful Paint": "첫 콘텐츠 표시 시간이 느립니다.",
        "Largest Contentful Paint": "가장 큰 콘텐츠가 화면에 표시되기까지 시간이 오래 걸립니다.",
        "Total Blocking Time": "사용자 입력을 막는 긴 작업 시간이 깁니다.",
        "Cumulative Layout Shift": "화면 요소가 로딩 중 예기치 않게 이동합니다.",
        "Speed Index": "화면 주요 콘텐츠가 표시되는 속도가 느립니다.",
        "Time to Interactive": "페이지가 상호작용 가능한 상태가 되기까지 시간이 오래 걸립니다.",
        "Network dependency tree": "네트워크 의존성 트리",
        "Render blocking requests": "렌더링 차단 요청",
    }
    for source, target in replacements.items():
        if normalized == source:
            return target
    # 5단계: 패턴 기반 번역
    if normalized.startswith("Touch target size is ") and "below the recommended minimum" in normalized:
        return normalized.replace("Touch target size is", "터치 대상 크기가").replace(
            "px, below the recommended minimum.", "px로 권장 최소 기준보다 작습니다."
        )
    if "Element does not have inner text that is visible to screen readers" in normalized:
        return "요소에 스크린 리더가 읽을 수 있는 텍스트가 없습니다."
    if "aria-label attribute does not exist or is empty" in normalized:
        return "aria-label 속성이 없거나 비어 있습니다."
    if "Element has no title attribute" in normalized:
        return "요소에 title 속성이 없습니다."
    if "First Contentful Paint marks the time" in normalized:
        return "첫 텍스트나 이미지가 화면에 처음 표시되는 시간을 줄이세요. 서버 응답, 렌더링 차단 CSS/JS, 웹폰트 로딩을 우선 확인하세요."
    if "Largest Contentful Paint marks the time" in normalized:
        return "가장 큰 이미지나 텍스트 블록이 빨리 보이도록 핵심 이미지 최적화, 우선 로딩, 서버 응답 시간을 개선하세요."
    if "Sum of all time periods between FCP and Time to Interactive" in normalized:
        return "초기 로딩 중 긴 JavaScript 작업을 줄이고 코드 분할, 지연 로딩, 불필요한 스크립트 제거를 적용하세요."
    if "Measures the movement of visible elements" in normalized:
        return "이미지와 광고 영역의 크기를 미리 지정하고, 로딩 중 레이아웃이 밀리지 않도록 공간을 예약하세요."
    if "Avoid chaining critical requests" in normalized:
        return "중요 요청 체인의 길이와 리소스 다운로드 크기를 줄이고, 불필요한 리소스는 지연 로드해 페이지 로딩 성능을 개선하세요."
    if "Requests are blocking the page's initial render" in normalized or "render-blocking" in normalized:
        return "초기 렌더링을 차단하는 요청이 있어 LCP가 지연될 수 있습니다. 핵심 리소스는 인라인 처리하고, 비핵심 CSS/JavaScript는 defer, async 또는 지연 로딩으로 전환하세요."
    if "ARIA roles must be contained" in normalized:
        return "일부 ARIA 역할은 정해진 부모 요소 안에 배치되어야 합니다."
    if "one main landmark" in normalized:
        return "문서에는 main 랜드마크가 하나만 있어야 합니다."
    if "level-one heading" in normalized:
        return "페이지에는 최상위 제목(h1)이 있어야 합니다."
    if "contained by landmarks" in normalized:
        return "페이지의 주요 콘텐츠는 header, main, nav, footer 같은 랜드마크 영역 안에 포함되어야 합니다."
    # 6단계: 포함 검사 기반 패턴 (넓은 범위)
    low = normalized.lower()
    if ("contrast" in low and ("foreground" in low or "background" in low or "ratio" in low or "low-contrast" in low)):
        return "텍스트와 배경의 색상 대비 비율을 WCAG 기준(4.5:1) 이상으로 높이세요."
    if "bypass" in low and "navigation" in low:
        return "키보드 사용자를 위해 본문으로 바로 이동하는 건너뛰기 링크를 제공하세요."
    if "scrollable" in low and "keyboard" in low:
        return "스크롤 가능한 영역에 tabindex=\"0\"을 추가해 키보드로 접근 가능하게 만드세요."
    if "tabindex" in low and "greater than 0" in low:
        return "tabindex 값을 0 또는 -1로 설정해 자연스러운 키보드 탐색 순서를 유지하세요."
    if "viewport" in low and ("zoom" in low or "scaling" in low or "user-scalable" in low):
        return "meta viewport에서 user-scalable=no를 제거해 사용자가 화면을 확대할 수 있도록 하세요."
    if "lang" in low and "html" in low:
        return "html 요소에 유효한 lang 속성을 추가하세요. 예: <html lang=\"ko\">."
    if "heading" in low and "order" in low:
        return "제목 계층 구조(h1 → h2 → h3)가 순서대로 사용되고 있는지 확인하세요."
    if "duplicate" in low and "id" in low:
        return "페이지 내에 중복된 id 값이 있습니다. id는 페이지에서 유일해야 합니다."
    if "iframe" in low and ("title" in low or "accessible name" in low):
        return "iframe 요소에 내용을 설명하는 title 속성을 추가하세요."
    if "list" in low and "structured" in low:
        return "목록(ul/ol) 요소의 구조가 올바른지 확인하세요. 직접 자식으로는 li 요소만 허용됩니다."
    if "minimum color contrast" in low or "color contrast ratio" in low:
        return "텍스트와 배경의 색상 대비가 최소 기준을 충족해야 합니다."
    return text

def describe_defect_target(selector: Optional[str], evidence: Optional[dict]) -> str:
    """결함이 발생한 UI 요소를 사람이 읽기 쉬운 이름으로 요약합니다.

    evidence에 들어 있는 텍스트, aria-label, title, placeholder, href를 우선 사용하고 없으면 selector를 사용합니다.
    보고서 한 줄 요약에 들어가므로 너무 긴 값은 잘라냅니다.
    """
    evidence = evidence if isinstance(evidence, dict) else {}
    candidates = [
        evidence.get("text"),
        evidence.get("ariaLabel"),
        evidence.get("title"),
        evidence.get("placeholder"),
        evidence.get("href"),
        selector,
    ]
    target = next((str(value).strip() for value in candidates if str(value or "").strip()), "")
    if not target:
        return "식별 가능한 텍스트가 없는 요소"
    if len(target) > 80:
        target = target[:77] + "..."
    return target

def localize_lighthouse_finding(finding: dict) -> tuple[str, str]:
    """Lighthouse audit finding을 한글 제목과 개선 권장사항으로 변환합니다.

    성능 지표와 접근성 규칙은 ruleId 기반으로 우선 매핑하고, 모르는 audit은 title/description을 범용 한글화 함수로
    넘겨 사용자에게 최대한 자연스러운 설명을 제공합니다.
    """
    rule_id = finding.get("ruleId")
    display_value = finding.get("displayValue")
    # 성능 지표 → 한글 제목/권장사항 직접 매핑
    metric_labels = {
        "first-contentful-paint": ("첫 콘텐츠 표시 시간이 느립니다.", "첫 텍스트나 이미지가 화면에 나타나는 시간을 줄이세요. 서버 응답, 렌더링 차단 CSS/JS, 웹폰트 로딩을 우선 확인하세요."),
        "largest-contentful-paint": ("가장 큰 콘텐츠 표시 시간이 느립니다.", "대표 이미지나 큰 텍스트 블록이 빨리 보이도록 이미지 최적화, preload, 서버 응답 개선을 적용하세요."),
        "total-blocking-time": ("초기 로딩 중 입력 차단 시간이 깁니다.", "긴 JavaScript 작업을 줄이고 코드 분할, 지연 로딩, 불필요한 스크립트 제거를 적용하세요."),
        "cumulative-layout-shift": ("로딩 중 화면 요소가 흔들립니다.", "이미지/광고/동적 영역의 크기를 미리 예약해 사용자가 보던 위치가 밀리지 않게 하세요."),
        "speed-index": ("화면 콘텐츠가 표시되는 속도가 느립니다.", "첫 화면에 필요한 리소스만 우선 로드하고 나머지는 지연 로딩하세요."),
        "interactive": ("상호작용 가능 시점이 늦습니다.", "초기 JavaScript 실행량을 줄여 버튼과 링크가 더 빨리 반응하게 하세요."),
        "max-potential-fid": ("최대 입력 지연 가능 시간이 깁니다.", "가장 오래 걸리는 JavaScript 작업을 줄이고, 긴 작업을 분할해 사용자의 첫 입력 지연을 낮추세요."),
        "critical-request-chains": ("중요 요청 체인이 길어 페이지 로딩이 지연됩니다.", "렌더링에 필요한 핵심 요청 수와 다운로드 크기를 줄이고, 불필요한 리소스는 지연 로딩하세요."),
        "render-blocking-resources": ("초기 렌더링을 차단하는 리소스가 있습니다.", "첫 화면에 필요한 CSS는 인라인 처리하고, 비핵심 CSS/JavaScript는 defer, async 또는 지연 로딩으로 전환하세요."),
        "unused-javascript": ("사용하지 않는 JavaScript가 많습니다.", "초기 화면에 필요 없는 JavaScript를 제거하거나 코드 분할하고, 필요한 시점까지 로딩을 지연하세요."),
        "uses-text-compression": ("텍스트 리소스 압축이 적용되지 않았습니다.", "HTML, CSS, JavaScript 같은 텍스트 기반 리소스에 gzip, deflate 또는 Brotli 압축을 적용하세요."),
        "uses-rel-preconnect": ("중요 외부 출처에 대한 사전 연결이 없습니다.", "중요한 외부 도메인에는 preconnect 또는 dns-prefetch 리소스 힌트를 추가해 연결 시간을 줄이세요."),
        "largest-contentful-paint-element": ("가장 큰 콘텐츠 요소가 LCP에 영향을 줍니다.", "LCP 대상 이미지나 텍스트 블록을 우선 로드하고, 크기 지정과 이미지 최적화를 적용하세요."),
    }
    # 접근성 audit → 한글 제목/권장사항 직접 매핑
    # 출처: https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/accessibility/
    accessibility_labels = {
        "color-contrast": (
            "텍스트와 배경의 색상 대비가 충분하지 않습니다.",
            "텍스트와 배경 색상의 대비 비율을 4.5:1(일반 텍스트) 또는 3:1(큰 텍스트) 이상으로 높이세요.",
        ),
        "image-alt": (
            "이미지에 대체 텍스트(alt)가 없습니다.",
            "의미 있는 이미지에는 alt 텍스트를 추가하고, 장식용 이미지는 alt=\"\"로 표시하세요.",
        ),
        "button-name": (
            "버튼에 접근 가능한 이름이 없습니다.",
            "버튼에 텍스트를 넣거나 aria-label 속성으로 이름을 제공하세요.",
        ),
        "link-name": (
            "링크에 인식 가능한 텍스트가 없습니다.",
            "링크에 설명적인 텍스트를 넣거나 aria-label로 목적을 명시하세요.",
        ),
        "label": (
            "폼 입력 요소에 라벨이 없습니다.",
            "label[for] 또는 aria-label을 사용해 입력 필드의 목적을 명확히 연결하세요.",
        ),
        "html-has-lang": (
            "html 요소에 lang 속성이 없습니다.",
            "<html lang=\"ko\">처럼 페이지 언어를 명시하세요.",
        ),
        "html-lang-valid": (
            "html 요소의 lang 속성 값이 유효하지 않습니다.",
            "IETF 언어 태그 형식에 맞는 유효한 값(예: ko, en-US)을 사용하세요.",
        ),
        "document-title": (
            "페이지 제목(title)이 없습니다.",
            "페이지 내용을 명확히 설명하는 title 태그를 추가하세요.",
        ),
        "meta-viewport": (
            "meta viewport가 사용자의 확대/축소를 막고 있습니다.",
            "user-scalable=no 또는 maximum-scale=1 설정을 제거해 사용자가 화면을 확대할 수 있게 하세요.",
        ),
        "heading-order": (
            "제목 계층 구조(h1~h6)가 올바르지 않습니다.",
            "제목 태그는 h1부터 순서대로 사용하고 단계를 건너뛰지 마세요.",
        ),
        "bypass": (
            "반복 탐색 블록을 건너뛸 수단이 없습니다.",
            "키보드 사용자가 주요 내비게이션을 건너뛸 수 있는 '본문 바로가기' 링크를 페이지 상단에 제공하세요.",
        ),
        "landmark-one-main": (
            "문서에 main 랜드마크가 없거나 두 개 이상입니다.",
            "<main> 요소를 페이지 주요 콘텐츠 영역에 정확히 하나만 사용하세요.",
        ),
        "region": (
            "페이지 콘텐츠가 랜드마크 영역 밖에 있습니다.",
            "모든 콘텐츠를 header, main, nav, footer 같은 랜드마크 요소 안에 배치하세요.",
        ),
        "frame-title": (
            "iframe에 제목이 없습니다.",
            "iframe 요소에 title 속성을 추가해 콘텐츠를 설명하세요.",
        ),
        "duplicate-id-active": (
            "활성 요소에 중복된 id 값이 있습니다.",
            "페이지 내 모든 id 값이 유일한지 확인하세요.",
        ),
        "duplicate-id-aria": (
            "ARIA 참조에 사용된 id 값이 중복되어 있습니다.",
            "aria-labelledby, aria-describedby 등에 참조된 id가 페이지에서 유일한지 확인하세요.",
        ),
        "tabindex": (
            "tabindex 값이 0보다 커서 키보드 탐색 순서가 혼란스럽습니다.",
            "tabindex 값을 0 또는 -1로만 사용하고 양수 값은 피하세요.",
        ),
        "target-size": (
            "클릭/터치 대상이 너무 작습니다.",
            "버튼·링크 등 인터랙티브 요소의 클릭 영역을 최소 44×44px 이상으로 만드세요.",
        ),
        "aria-required-children": (
            "ARIA 역할에 필수 자식 요소가 없습니다.",
            "해당 ARIA 역할이 요구하는 자식 역할 요소를 추가하세요.",
        ),
        "aria-required-parent": (
            "ARIA 요소가 올바른 부모 요소 안에 없습니다.",
            "해당 ARIA 역할을 허용하는 부모 요소 안에 배치하세요.",
        ),
        "aria-roles": (
            "유효하지 않은 ARIA 역할이 사용되었습니다.",
            "WAI-ARIA 명세에서 허용하는 올바른 역할 값을 사용하세요.",
        ),
        "aria-valid-attr": (
            "유효하지 않은 ARIA 속성이 있습니다.",
            "WAI-ARIA 명세에서 허용하는 올바른 속성 이름을 사용하세요.",
        ),
        "aria-valid-attr-value": (
            "ARIA 속성 값이 올바르지 않습니다.",
            "해당 ARIA 속성에서 허용하는 유효한 값을 사용하세요.",
        ),
        "aria-hidden-focus": (
            "aria-hidden 요소 안에 포커스 가능한 요소가 있습니다.",
            "aria-hidden='true' 영역 안에는 포커스 가능한 요소(버튼, 링크, 입력 등)를 배치하지 마세요.",
        ),
        "scrollable-region-focusable": (
            "스크롤 가능한 영역이 키보드로 접근 불가능합니다.",
            "스크롤 가능한 div 등에 tabindex='0'을 추가해 키보드로 접근 가능하게 만드세요.",
        ),
        "select-name": (
            "select 요소에 접근 가능한 이름이 없습니다.",
            "select 요소에 연결된 label 또는 aria-label을 제공하세요.",
        ),
        "input-image-alt": (
            "이미지 입력 버튼에 대체 텍스트가 없습니다.",
            "input[type=image]에 alt 속성을 추가해 버튼의 기능을 설명하세요.",
        ),
        "object-alt": (
            "object 요소에 대체 텍스트가 없습니다.",
            "object 요소 안에 대체 콘텐츠를 제공하거나 title 속성을 추가하세요.",
        ),
        "video-caption": (
            "동영상에 자막이 없습니다.",
            "video 요소에 <track kind='captions'> 태그를 추가해 자막을 제공하세요.",
        ),
        "list": (
            "목록(ul/ol) 요소의 구조가 올바르지 않습니다.",
            "ul/ol 요소의 직접 자식으로는 li 요소만 사용하세요.",
        ),
        "listitem": (
            "li 요소가 ul 또는 ol 밖에 있습니다.",
            "li 요소는 반드시 ul 또는 ol 안에 배치하세요.",
        ),
        "definition-list": (
            "dl 요소의 구조가 올바르지 않습니다.",
            "dl 요소 안에는 dt/dd 쌍만 직접 자식으로 배치하세요.",
        ),
        "dlitem": (
            "dl 요소 안에 dt/dd가 올바르게 배치되지 않았습니다.",
            "dl 요소 안에 dt와 dd 요소만 직접 자식으로 배치하세요.",
        ),
        # 모범 사례 audit
        "is-on-https": (
            "HTTP로 제공되는 리소스가 있습니다.",
            "모든 리소스와 페이지를 HTTPS로 제공하세요.",
        ),
        "no-unload-listeners": (
            "unload 이벤트 리스너가 사용되고 있습니다.",
            "unload 대신 pagehide 또는 visibilitychange 이벤트를 사용하세요.",
        ),
        "deprecations": (
            "더 이상 지원되지 않는 웹 API가 사용되고 있습니다.",
            "브라우저 콘솔 경고를 확인하고 지원 중단된 API를 최신 대안으로 교체하세요.",
        ),
        "errors-in-console": (
            "브라우저 콘솔에 오류가 기록되었습니다.",
            "콘솔 오류의 원인을 확인하고 누락된 리소스, 스크립트 예외, 실패한 API 요청을 수정하세요.",
        ),
        "doctype": (
            "HTML 문서에 DOCTYPE 선언이 없습니다.",
            "문서 최상단에 <!DOCTYPE html>을 추가하세요.",
        ),
        "charset": (
            "문자 인코딩이 선언되지 않았습니다.",
            "<meta charset='utf-8'>을 head 태그 상단에 추가하세요.",
        ),
        "geolocation-on-start": (
            "페이지 로드 시 위치 정보 권한을 자동으로 요청합니다.",
            "사용자 행동에 응답해 위치 정보를 요청하도록 변경하세요.",
        ),
        "notification-on-start": (
            "페이지 로드 시 알림 권한을 자동으로 요청합니다.",
            "사용자 행동에 응답해 알림 권한을 요청하도록 변경하세요.",
        ),
        "image-aspect-ratio": (
            "이미지가 원래 비율과 다르게 표시됩니다.",
            "이미지의 width/height 속성과 CSS 크기를 원본 비율에 맞게 설정하세요.",
        ),
        "inspector-issues": (
            "Chrome DevTools 이슈 패널에 문제가 기록되었습니다.",
            "DevTools의 Issues 탭을 확인해 쿠키, 혼합 콘텐츠, CSP 등의 문제를 해결하세요.",
        ),
        "js-libraries": (
            "감지된 JavaScript 라이브러리 목록입니다.",
            "사용 중인 라이브러리의 최신 버전과 보안 취약점 여부를 정기적으로 확인하세요.",
        ),
        "no-vulnerable-libraries": (
            "알려진 보안 취약점이 있는 JavaScript 라이브러리가 감지되었습니다.",
            "해당 라이브러리를 최신 버전으로 업데이트하거나 안전한 대안으로 교체하세요.",
        ),
        "valid-source-maps": (
            "소스 맵이 올바르지 않거나 없습니다.",
            "배포 시 올바른 소스 맵을 생성해 디버깅이 가능하게 하세요.",
        ),
        "unsized-images": (
            "크기가 지정되지 않은 이미지가 있습니다.",
            "이미지 요소에 width와 height 속성을 지정해 레이아웃 변화(CLS)를 방지하세요.",
        ),
    }
    if rule_id in metric_labels:
        title, recommendation = metric_labels[rule_id]
        if display_value:
            title = f"{title} 측정값: {display_value}"
        return title, recommendation
    if rule_id in accessibility_labels:
        title, recommendation = accessibility_labels[rule_id]
        if display_value:
            title = f"{title} 측정값: {display_value}"
        return title, recommendation
    # rule_id 매핑이 없는 경우 title/description을 번역 후 반환
    return (
        localize_uiux_text(finding.get("title")) or "Lighthouse 검사 항목에서 개선점이 발견되었습니다.",
        localize_uiux_text(finding.get("description")) or "Lighthouse 세부 결과를 확인해 해당 항목을 개선하세요.",
    )

def summarize_defect_group(defects: List[UIUXTestDefect], category_label: str) -> str:
    """동일 유형 결함 묶음을 최종 보고서의 한 줄 개선 항목으로 요약합니다.

    특히 터치 대상 크기 문제처럼 반복 개수가 많은 결함은 예시 요소 몇 개만 보여주고,
    사용자가 패턴 단위로 고칠 수 있도록 권장사항을 재구성합니다.
    """
    first = defects[0]
    description = (first.description or "").strip().rstrip(".")
    recommendation = (first.recommendation or "").strip().rstrip(".")
    count = len(defects)

    if first.rule_id == "target-size":
        examples = []
        for defect in defects[:3]:
            target = describe_defect_target(defect.selector, defect.evidence)
            evidence = defect.evidence if isinstance(defect.evidence, dict) else {}
            size = ""
            if evidence.get("width") and evidence.get("height"):
                size = f"({evidence.get('width')}x{evidence.get('height')}px)"
            examples.append(f"{target} {size}".strip())
        description = f"터치 대상 크기가 작은 클릭 요소가 {count}개 발견되었습니다. 예: {', '.join(examples)}"
        recommendation = "반복되는 작은 버튼/링크 패턴을 묶어서 최소 44x44px 터치 영역과 충분한 간격을 확보하세요"
    elif count > 1:
        description = f"{description} 같은 유형의 문제가 {count}개 발견되었습니다"

    if recommendation:
        return f"- {category_label}: {description}. 개선 방향: {recommendation}."
    return f"- {category_label}: {description}."

def select_balanced_defect_groups(grouped_defects: List[List[UIUXTestDefect]], limit: int = 5) -> List[List[UIUXTestDefect]]:
    """최종 보고서에 표시할 결함 그룹을 카테고리 편중 없이 고릅니다.

    접근성 DOM 규칙은 한 화면에서 작은 터치 대상처럼 반복 결함이 많이 나올 수 있습니다.
    단순히 심각도순 상위 N개만 자르면 접근성 항목만 보이고 사용성/성능/탐색 효율 문제가 가려지므로,
    먼저 카테고리별 대표 그룹을 하나씩 넣고 남은 칸을 전체 우선순위 순서로 채웁니다.
    """
    selected: List[List[UIUXTestDefect]] = []
    seen_keys = set()
    seen_categories = set()

    for group in grouped_defects:
        category = group[0].category
        if category in seen_categories:
            continue
        selected.append(group)
        seen_categories.add(category)
        seen_keys.add((category, group[0].rule_id or group[0].description))
        if len(selected) >= limit:
            return selected

    for group in grouped_defects:
        key = (group[0].category, group[0].rule_id or group[0].description)
        if key in seen_keys:
            continue
        selected.append(group)
        seen_keys.add(key)
        if len(selected) >= limit:
            break

    return selected

def find_chromium_executable() -> Optional[str]:
    """Lighthouse가 사용할 Chromium 실행 파일 경로를 찾습니다.

    CHROME_PATH가 명시되어 있으면 최우선으로 사용하고, 없으면 Playwright 브라우저 설치 경로 후보를 순회합니다.
    컨테이너 이미지마다 폴더 구조가 다를 수 있어 chrome-linux64와 chrome-linux 모두 확인합니다.
    """
    configured_path = os.getenv("CHROME_PATH")
    if configured_path and os.path.exists(configured_path):
        return configured_path

    search_roots = [
        os.getenv("PLAYWRIGHT_BROWSERS_PATH", "/ms-playwright"),
        os.path.join(os.path.dirname(__file__), "ms-playwright"),
    ]
    executable_suffixes = (
        os.path.join("chrome-linux64", "chrome"),
        os.path.join("chrome-linux", "chrome"),
    )
    for root in search_roots:
        if not root or not os.path.isdir(root):
            continue
        for current_root, _, files in os.walk(root):
            for suffix in executable_suffixes:
                candidate = os.path.join(current_root, suffix)
                if os.path.exists(candidate):
                    return candidate
            if "chrome" in files:
                candidate = os.path.join(current_root, "chrome")
                if os.access(candidate, os.X_OK):
                    return candidate
    return None

def _trim_debug_text(value: Optional[str], limit: int = 1500) -> str:
    """외부 프로세스 stdout/stderr를 로그에 넣기 좋게 짧게 자릅니다."""
    return (value or "").strip()[:limit]

def run_lighthouse_audit(target_url: str) -> Dict[str, Any]:
    """Lighthouse CLI를 실행해 성능/접근성/모범 사례 점수와 주요 finding을 수집합니다.

    실행 전 패키지와 Chromium 존재 여부를 확인하고, 대상 URL precheck 결과를 diagnostics에 남깁니다.
    Lighthouse가 설치되지 않았거나 timeout이 발생해도 워커 전체를 실패시키지 않고, available=False 결과로 대체 규칙이
    점수를 계산할 수 있게 합니다.
    """
    started_at = time.time()
    diagnostics = {
        "targetUrl": target_url,
        "timeoutSeconds": LIGHTHOUSE_TIMEOUT_SECONDS,
        "precheckTimeoutSeconds": LIGHTHOUSE_PRECHECK_TIMEOUT_SECONDS,
    }
    lighthouse_cli = os.path.join(os.path.dirname(__file__), "node_modules", "lighthouse", "cli", "index.js")
    diagnostics["lighthouseCli"] = lighthouse_cli
    diagnostics["lighthouseCliExists"] = os.path.exists(lighthouse_cli)
    if not os.path.exists(lighthouse_cli):
        uiux_log("lighthouse.preflight_failed", **diagnostics, reason="missing_lighthouse_package")
        return {"available": False, "error": "Lighthouse package is not installed.", "diagnostics": diagnostics}

    chrome_path = find_chromium_executable()
    diagnostics["chromePath"] = chrome_path
    diagnostics["chromePathExists"] = bool(chrome_path and os.path.exists(chrome_path))
    if not chrome_path:
        uiux_log("lighthouse.preflight_failed", **diagnostics, reason="missing_chromium")
        return {"available": False, "error": "Chromium executable is not installed.", "diagnostics": diagnostics}

    try:
        precheck_started = time.time()
        with httpx.Client(timeout=LIGHTHOUSE_PRECHECK_TIMEOUT_SECONDS, follow_redirects=True, verify=False) as client:
            response = client.get(target_url)
        diagnostics["targetPrecheckStatus"] = response.status_code
        diagnostics["targetPrecheckFinalUrl"] = str(response.url)
        diagnostics["targetPrecheckSeconds"] = round(time.time() - precheck_started, 3)
    except Exception as e:
        diagnostics["targetPrecheckError"] = str(e)[:500]

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        output_path = tmp.name
    diagnostics["outputPath"] = output_path

    cmd = [
        "node",
        lighthouse_cli,
        target_url,
        "--quiet",
        "--output=json",
        f"--output-path={output_path}",
        "--only-categories=performance,accessibility,best-practices",
        "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --ignore-certificate-errors",
    ]
    diagnostics["command"] = " ".join(cmd[:3] + ["...", f"--timeout={LIGHTHOUSE_TIMEOUT_SECONDS}s"])
    uiux_log("lighthouse.start", **diagnostics)

    try:
        env = {**os.environ, "CHROME_PATH": chrome_path}
        completed = subprocess.run(cmd, check=True, timeout=LIGHTHOUSE_TIMEOUT_SECONDS, capture_output=True, text=True, env=env)
        diagnostics["processSeconds"] = round(time.time() - started_at, 3)
        diagnostics["returnCode"] = completed.returncode
        diagnostics["stderrTail"] = _trim_debug_text(completed.stderr)
        with open(output_path, "r", encoding="utf-8") as f:
            result = json.load(f)
        categories = result.get("categories", {})
        audits = result.get("audits", {})

        scores = {}
        for key, category_name in [
            ("performance", "performance"),
            ("accessibility", "accessibility"),
            ("best-practices", "bestPractices"),
        ]:
            category = categories.get(key, {})
            raw_score = category.get("score")
            scores[category_name] = 0 if raw_score is None else round(raw_score * 100)

        findings = []
        for category_id, category in categories.items():
            if category_id not in ("performance", "accessibility", "best-practices"):
                continue
            for ref in category.get("auditRefs", []):
                audit_id = ref.get("id")
                audit = audits.get(audit_id, {})
                score = audit.get("score")
                score_display_mode = audit.get("scoreDisplayMode")
                if score is None or score == 1 or score_display_mode in ("notApplicable", "manual", "informative"):
                    continue
                details = audit.get("details") or {}
                finding = {
                    "category": category_id,
                    "ruleId": audit_id,
                    "title": audit.get("title"),
                    "description": audit.get("description"),
                    "displayValue": audit.get("displayValue"),
                    "score": score,
                    "numericValue": audit.get("numericValue"),
                    "scoreDisplayMode": score_display_mode,
                    "items": details.get("items", [])[:3] if isinstance(details.get("items"), list) else [],
                }
                findings.append(finding)

        uiux_log(
            "lighthouse.success",
            elapsedSeconds=diagnostics["processSeconds"],
            lighthouseVersion=result.get("lighthouseVersion"),
            finalUrl=result.get("finalDisplayedUrl") or result.get("finalUrl"),
            scores=scores,
        )
        return {
            "available": True,
            "scores": scores,
            "findings": findings[:30],
            "lighthouseVersion": result.get("lighthouseVersion"),
            "fetchTime": result.get("fetchTime"),
            "finalUrl": result.get("finalDisplayedUrl") or result.get("finalUrl"),
            "diagnostics": diagnostics,
        }
    except subprocess.TimeoutExpired as e:
        diagnostics["processSeconds"] = round(time.time() - started_at, 3)
        diagnostics["timeoutExpired"] = True
        diagnostics["stdoutTail"] = _trim_debug_text(e.stdout.decode("utf-8", errors="ignore") if isinstance(e.stdout, bytes) else e.stdout)
        diagnostics["stderrTail"] = _trim_debug_text(e.stderr.decode("utf-8", errors="ignore") if isinstance(e.stderr, bytes) else e.stderr)
        uiux_log("lighthouse.timeout", **diagnostics)
        return {
            "available": False,
            "error": f"Lighthouse timed out after {LIGHTHOUSE_TIMEOUT_SECONDS}s before completing.",
            "diagnostics": diagnostics,
        }
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").strip()
        stdout = (e.stdout or "").strip()
        detail = stderr or stdout
        diagnostics["processSeconds"] = round(time.time() - started_at, 3)
        diagnostics["returnCode"] = e.returncode
        diagnostics["stdoutTail"] = _trim_debug_text(stdout)
        diagnostics["stderrTail"] = _trim_debug_text(stderr)
        uiux_log("lighthouse.process_failed", **diagnostics)
        print(f"Lighthouse failed before completing: {detail[:1000]}", flush=True)
        return {
            "available": False,
            "error": "Lighthouse exited before completing.",
            "debugError": detail[:1000],
            "diagnostics": diagnostics,
        }
    except Exception as e:
        diagnostics["processSeconds"] = round(time.time() - started_at, 3)
        diagnostics["exception"] = str(e)[:500]
        uiux_log("lighthouse.crashed", **diagnostics)
        print(f"Lighthouse could not run: {e}", flush=True)
        return {"available": False, "error": "Lighthouse could not run.", "debugError": str(e)[:1000], "diagnostics": diagnostics}
    finally:
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception:
            pass
def run_axe_audit(page) -> Dict[str, Any]:
    """현재 Playwright 페이지에 axe-core를 주입해 접근성 위반을 검사합니다.

    WCAG 2.x와 best-practice 태그를 기준으로 violations만 수집하고, impact와 노드 개수를 바탕으로 접근성 보조 점수를
    계산합니다. axe 패키지가 없으면 실행 불가 상태를 반환합니다.
    """
    axe_path = os.path.join(os.path.dirname(__file__), "node_modules", "axe-core", "axe.min.js")
    if not os.path.exists(axe_path):
        return {"available": False, "error": "axe-core package is not installed."}

    try:
        with open(axe_path, "r", encoding="utf-8") as f:
            axe_source = f.read()
        page.add_script_tag(content=axe_source)
        result = page.evaluate("""
            async () => {
                return await axe.run(document, {
                    resultTypes: ['violations'],
                    runOnly: {
                        type: 'tag',
                        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
                    }
                });
            }
        """)
        violations = result.get("violations", [])
        # 위반 유형별 감점: 동일 규칙 노드가 많을수록 log2 스케일로 완화
        total_deduction = 0
        impact_weights = {"critical": 20, "serious": 12, "moderate": 6, "minor": 2}
        for violation in violations:
            impact = violation.get("impact") or "minor"
            nodes = violation.get("nodes") or []
            node_count = max(1, len(nodes))
            weight = impact_weights.get(impact, 2)
            total_deduction += weight * (1 + math.log2(node_count))
        # 최대 감점 60점으로 제한 — 규모가 큰 사이트가 과도하게 낮아지지 않도록
        score = clamp_score(100 - min(60, round(total_deduction)))
        return {
            "available": True,
            "score": score,
            "violations": violations,
            "testEngine": result.get("testEngine"),
            "testRunner": result.get("testRunner"),
            "testEnvironment": result.get("testEnvironment"),
        }
    except Exception as e:
        return {"available": False, "error": str(e)}

def clamp_score(value: int) -> int:
    """점수가 0~100 범위를 벗어나지 않도록 보정합니다."""
    return max(0, min(100, int(value)))

def build_selector(el_info: dict) -> str:
    """DOM 요소 정보에서 간단한 CSS selector 표현을 만듭니다."""
    tag = el_info.get("tag") or ""
    el_id = el_info.get("id") or ""
    class_name = el_info.get("className") or ""
    if el_id:
        return f"{tag}#{el_id}"
    if class_name:
        first_class = str(class_name).split()[0]
        return f"{tag}.{first_class}"
    return tag or "N/A"

def evaluate_accessibility_rules(page, add_defect_fn, start_time):
    """axe/Lighthouse와 별도로 빠르게 수행하는 자체 접근성 규칙 검사입니다.

    작은 터치 타깃, 이름 없는 버튼/링크, 라벨 없는 입력, 대체 텍스트 누락처럼 DOM만으로 판단 가능한 문제를 찾아
    결함 목록과 감점 내역에 추가합니다.
    """
    deductions = []
    try:
        issues = page.evaluate("""
            () => {
                const selectorFor = (el) => ({
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    className: typeof el.className === 'string' ? el.className : '',
                });
                const visible = (el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                };
                const textOf = (el) => (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
                const targetInfo = (el, rect) => ({
                    text: (el.innerText || el.textContent || '').trim().slice(0, 80),
                    ariaLabel: (el.getAttribute('aria-label') || '').trim().slice(0, 80),
                    title: (el.getAttribute('title') || '').trim().slice(0, 80),
                    href: (el.href || el.getAttribute('href') || '').toString().slice(0, 120),
                    role: el.getAttribute('role') || '',
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    expected: '>=44x44'
                });
                const hasLabel = (input) => {
                    if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return true;
                    if (input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) return true;
                    return !!input.closest('label');
                };
                const results = [];

                document.querySelectorAll('button, a, input[type="button"], input[type="submit"]').forEach((el) => {
                    if (!visible(el)) return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width < 44 || rect.height < 44) {
                        results.push({
                            ruleId: 'target-size',
                            selector: selectorFor(el),
                            description: `터치 대상 크기가 ${Math.round(rect.width)}x${Math.round(rect.height)}px로 권장 최소 기준보다 작습니다.`,
                            recommendation: '클릭 가능한 요소는 최소 44x44px 이상으로 만들고 주변 간격을 충분히 확보하세요.',
                            evidence: targetInfo(el, rect),
                            severity: 'MAJOR',
                            deduction: 5,
                        });
                    }
                    if (!textOf(el)) {
                        results.push({
                            ruleId: 'accessible-name',
                            selector: selectorFor(el),
                            description: '인터랙티브 요소에 접근성 이름이 없습니다.',
                            recommendation: '버튼과 링크에 명확한 텍스트를 넣거나 aria-label을 제공하세요.',
                            evidence: targetInfo(el, rect),
                            severity: 'MAJOR',
                            deduction: 7,
                        });
                    }
                });

                document.querySelectorAll('input, textarea, select').forEach((el) => {
                    if (!visible(el)) return;
                    if (!hasLabel(el)) {
                        results.push({
                            ruleId: 'form-label',
                            selector: selectorFor(el),
                            description: '입력 요소에 연결된 라벨이 없습니다.',
                            recommendation: 'label[for] 또는 aria-label을 사용해 입력 목적을 명확히 연결하세요.',
                            evidence: { type: el.getAttribute('type') || el.tagName.toLowerCase(), placeholder: el.getAttribute('placeholder') || '' },
                            severity: 'MAJOR',
                            deduction: 7,
                        });
                    }
                });

                document.querySelectorAll('img').forEach((el) => {
                    if (!visible(el)) return;
                    if (!el.hasAttribute('alt')) {
                        results.push({
                            ruleId: 'image-alt',
                            selector: selectorFor(el),
                            description: '이미지에 대체 텍스트가 없습니다.',
                            recommendation: '의미 있는 이미지에는 대체 텍스트를 제공하고, 장식 이미지는 빈 alt 텍스트를 사용하세요.',
                            evidence: { src: el.currentSrc || el.src || '' },
                            severity: 'MINOR',
                            deduction: 4,
                        });
                    }
                });

                return results;
            }
        """)
        current_offset = int(time.time() - start_time)
        score = 100
        for issue in issues:
            score -= int(issue.get("deduction", 5))
            selector = build_selector(issue.get("selector", {}))
            deductions.append(issue)
            add_defect_fn(
                category="ACCESSIBILITY",
                selector=selector,
                severity=issue.get("severity", "MAJOR"),
                description=issue.get("description", "An accessibility issue was detected."),
                timestamp_offset=current_offset,
                source="UX_RULE",
                rule_id=issue.get("ruleId"),
                evidence=issue.get("evidence"),
                recommendation=issue.get("recommendation")
            )
        return clamp_score(score), deductions
    except Exception as e:
        return 80, [{"ruleId": "accessibility-evaluation-error", "error": str(e), "deduction": 20}]

def add_lighthouse_findings(lighthouse_result, add_defect_fn, start_time):
    """Lighthouse finding을 FlowCheck 결함 모델과 감점 내역으로 변환합니다."""
    deductions = []
    if not lighthouse_result.get("available"):
        return [{
            "ruleId": "lighthouse-unavailable",
            "error": lighthouse_result.get("error"),
            "deduction": 0
        }]

    current_offset = int(time.time() - start_time)
    for finding in lighthouse_result.get("findings", []):
        category_id = finding.get("category")
        if category_id == "performance":
            category = "PERFORMANCE"
        elif category_id == "accessibility":
            category = "ACCESSIBILITY"
        else:
            category = "BEST_PRACTICES"

        score = finding.get("score")
        deduction = 0 if score is None else round((1 - float(score)) * 10)
        deductions.append({
            "ruleId": finding.get("ruleId"),
            "category": category,
            "title": finding.get("title"),
            "displayValue": finding.get("displayValue"),
            "score": score,
            "deduction": deduction,
        })
        localized_title, localized_recommendation = localize_lighthouse_finding(finding)
        add_defect_fn(
            category=category,
            selector="document",
            severity="MINOR" if category != "ACCESSIBILITY" else "MAJOR",
            description=localized_title,
            timestamp_offset=current_offset,
            source="LIGHTHOUSE",
            rule_id=finding.get("ruleId"),
            evidence={
                "description": finding.get("description"),
                "displayValue": finding.get("displayValue"),
                "score": score,
                "numericValue": finding.get("numericValue"),
                "items": finding.get("items", []),
            },
            recommendation=localized_recommendation
        )
    return deductions

def add_axe_findings(axe_result, add_defect_fn, start_time):
    """axe-core violations를 FlowCheck 결함 모델과 감점 내역으로 변환합니다."""
    deductions = []
    if not axe_result.get("available"):
        return [{
            "ruleId": "axe-unavailable",
            "error": axe_result.get("error"),
            "deduction": 0
        }]

    current_offset = int(time.time() - start_time)
    impact_weights = {"critical": 15, "serious": 10, "moderate": 5, "minor": 2}
    for violation in axe_result.get("violations", []):
        impact = violation.get("impact") or "minor"
        nodes = violation.get("nodes") or []
        deduction = impact_weights.get(impact, 2) * max(1, len(nodes))
        deductions.append({
            "ruleId": violation.get("id"),
            "impact": impact,
            "nodeCount": len(nodes),
            "tags": violation.get("tags", []),
            "deduction": deduction,
        })
        first_node = nodes[0] if nodes else {}
        target = first_node.get("target") if isinstance(first_node.get("target"), list) else []
        selector = target[0] if target else "N/A"
        rule_id = violation.get("id")
        # axe-core 결함 설명: rule_id → 한글 우선, 없으면 help/description 한글화
        raw_description = violation.get("help") or violation.get("description") or "axe-core 접근성 위반이 감지되었습니다."
        localized_desc = (
            localize_axe_rule_id(rule_id)
            or localize_uiux_text(raw_description)
            or raw_description
        )
        raw_recommendation = violation.get("help") or violation.get("description") or ""
        localized_rec = (
            localize_axe_rule_id(rule_id)
            or localize_uiux_text(raw_recommendation)
            or raw_recommendation
        )
        add_defect_fn(
            category="ACCESSIBILITY",
            selector=selector,
            severity=severity_from_impact(impact),
            description=localized_desc,
            timestamp_offset=current_offset,
            source="AXE",
            rule_id=rule_id,
            evidence={
                "impact": impact,
                "description": violation.get("description"),
                "helpUrl": violation.get("helpUrl"),
                "tags": violation.get("tags", []),
                "nodes": [{
                    "target": node.get("target"),
                    "html": node.get("html"),
                    "failureSummary": node.get("failureSummary"),
                } for node in nodes[:3]],
            },
            recommendation=localized_rec
        )
    return deductions

def evaluate_best_practices(page, target_url, console_errors, page_errors, add_defect_fn, start_time):
    """보안/품질 관점의 자체 모범 사례 규칙을 평가합니다.

    HTTPS 사용 여부, 콘솔 오류, 런타임 오류, doctype, target=_blank rel 속성처럼 Lighthouse가 실패해도 확인 가능한
    기술 품질 항목을 검사합니다.
    """
    score = 100
    deductions = []
    current_offset = int(time.time() - start_time)

    def add_issue(rule_id, description, recommendation, deduction, evidence=None, severity="MINOR"):
        nonlocal score
        score -= deduction
        issue = {
            "ruleId": rule_id,
            "description": description,
            "recommendation": recommendation,
            "deduction": deduction,
            "evidence": evidence or {},
        }
        deductions.append(issue)
        add_defect_fn(
            category="BEST_PRACTICES",
            selector="document",
            severity=severity,
            description=description,
            timestamp_offset=current_offset,
            source="UX_RULE",
            rule_id=rule_id,
            evidence=evidence or {},
            recommendation=recommendation
        )

    if not target_url.startswith("https://") and not target_url.startswith("http://localhost") and not target_url.startswith("http://127.0.0.1"):
        add_issue(
            "uses-https",
            "테스트 대상 URL이 HTTPS를 사용하지 않습니다.",
            "운영 환경에서는 HTTPS를 적용하고 HTTP 요청은 HTTPS로 리다이렉트하세요.",
            15,
            {"url": target_url},
            "MAJOR"
        )

    if console_errors:
        add_issue(
            "console-errors",
            f"브라우저 콘솔 오류가 {len(console_errors)}건 발생했습니다.",
            "콘솔 오류의 원인을 확인하고, 누락된 리소스, 스크립트 예외, 실패한 API 요청을 수정하세요.",
            min(20, len(console_errors) * 5),
            {"errors": console_errors[:5]},
            "MAJOR"
        )

    if page_errors:
        add_issue(
            "runtime-errors",
            f"페이지 런타임 오류가 {len(page_errors)}건 발생했습니다.",
            "브라우저 pageerror 로그를 확인해 예외가 발생한 스크립트와 상태 처리를 수정하세요.",
            min(20, len(page_errors) * 10),
            {"errors": page_errors[:5]},
            "MAJOR"
        )

    try:
        dom_issues = page.evaluate("""
            () => {
                const issues = [];
                if (!document.doctype) {
                    issues.push({
                        ruleId: 'doctype',
                        description: 'HTML doctype이 선언되어 있지 않습니다.',
                        recommendation: '<!doctype html>을 문서 최상단에 선언하세요.',
                        deduction: 10,
                        evidence: {},
                    });
                }
                document.querySelectorAll('a[target="_blank"]').forEach((a) => {
                    const rel = (a.getAttribute('rel') || '').toLowerCase();
                    if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
                        issues.push({
                            ruleId: 'external-link-rel',
                            description: '새 창 링크에 rel="noopener" 또는 noreferrer가 없습니다.',
                            recommendation: 'target="_blank" 링크에는 rel="noopener noreferrer"를 추가하세요.',
                            deduction: 4,
                            evidence: { href: a.href, text: (a.innerText || '').trim() },
                        });
                    }
                });
                return issues;
            }
        """)
        for issue in dom_issues:
            add_issue(
                issue.get("ruleId"),
                issue.get("description"),
                issue.get("recommendation"),
                int(issue.get("deduction", 5)),
                issue.get("evidence"),
                "MINOR"
            )
    except Exception as e:
        deductions.append({"ruleId": "best-practices-evaluation-error", "error": str(e), "deduction": 0})

    return clamp_score(score), deductions

def evaluate_usability_rules(page, steps_history, failed_selectors, add_defect_fn, start_time):
    """Playwright 탐색 결과와 DOM 상태를 바탕으로 사용성 문제를 평가합니다.

    모호한 CTA, 비밀번호 조건 안내 부족, 자동 탐색 실패 같은 실제 사용 흐름의 마찰을 찾아 사용성 점수에 반영합니다.
    """
    score = 100
    deductions = []
    current_offset = int(time.time() - start_time)

    def add_issue(rule_id, selector, description, recommendation, deduction, evidence=None, severity="MINOR"):
        nonlocal score
        score -= deduction
        issue = {
            "ruleId": rule_id,
            "selector": selector,
            "description": description,
            "recommendation": recommendation,
            "deduction": deduction,
            "evidence": evidence or {},
        }
        deductions.append(issue)
        add_defect_fn(
            category="USABILITY",
            selector=selector,
            severity=severity,
            description=description,
            timestamp_offset=current_offset,
            source="UX_RULE",
            rule_id=rule_id,
            evidence=evidence or {},
            recommendation=recommendation
        )

    try:
        issues = page.evaluate("""
            () => {
                const selectorFor = (el) => {
                    const tag = el.tagName.toLowerCase();
                    if (el.id) return `${tag}#${el.id}`;
                    if (typeof el.className === 'string' && el.className.trim()) return `${tag}.${el.className.trim().split(/\\s+/)[0]}`;
                    return tag;
                };
                const visible = (el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                };
                const generic = new Set(['click', 'click here', 'more', 'submit', 'button', '\uD655\uC778', '\uD074\uB9AD', '\uC790\uC138\uD788']);
                const results = [];
                document.querySelectorAll('button, a').forEach((el) => {
                    if (!visible(el)) return;
                    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
                    if (generic.has(text)) {
                        results.push({
                            ruleId: 'generic-action-label',
                            selector: selectorFor(el),
                            description: '버튼이나 링크의 문구가 너무 일반적이어서 다음 행동을 예측하기 어렵습니다.',
                            recommendation: '사용자가 클릭 결과를 알 수 있도록 구체적인 CTA 문구를 사용하세요.',
                            deduction: 6,
                            evidence: { text },
                        });
                    }
                });
                const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible);
                if (passwordInputs.length > 0) {
                    const hasHelpText = Array.from(document.querySelectorAll('p, small, span, div')).some((el) => {
                        const text = (el.innerText || '').trim();
                        return /\uBE44\uBC00\uBC88\uD638|password/.test(text) && /8|\uD2B9\uC218|\uC601\uBB38|\uC22B\uC790|\uC870\uAC74|\uADDC\uCE59/.test(text);
                    });
                    if (!hasHelpText) {
                        results.push({
                            ruleId: 'password-requirements-help',
                            selector: selectorFor(passwordInputs[0]),
                            description: '비밀번호 입력 조건이 입력 전에 안내되지 않습니다.',
                            recommendation: '제출 전에 비밀번호 길이와 문자 조합 조건을 입력 필드 근처에 표시하세요.',
                            deduction: 6,
                            evidence: { passwordInputCount: passwordInputs.length },
                        });
                    }
                }
                return results;
            }
        """)
        for issue in issues:
            add_issue(
                issue.get("ruleId"),
                issue.get("selector", "N/A"),
                issue.get("description"),
                issue.get("recommendation"),
                int(issue.get("deduction", 5)),
                issue.get("evidence"),
                "MINOR"
            )
    except Exception as e:
        deductions.append({"ruleId": "usability-evaluation-error", "error": str(e), "deduction": 0})

    if failed_selectors:
        add_issue(
            "interaction-failures",
            "N/A",
            f"자동 탐색 중 클릭/입력 실패가 {len(failed_selectors)}건 발생했습니다.",
            "비활성화 상태, 오버레이, z-index, selector 안정성, 입력 가능 상태를 확인하세요.",
            min(30, len(failed_selectors) * 10),
            {"failedSelectors": failed_selectors},
            "MAJOR"
        )

    return clamp_score(score), deductions

def build_report_markdown(scores, breakdown, defects):
    """점수와 결함 목록을 프론트에 표시할 한국어 마크다운 보고서로 구성합니다.

    심각도와 발생 시점을 기준으로 결함을 정렬한 뒤 동일 rule/description끼리 묶어 상위 5개 개선 항목만 요약합니다.
    """
    category_labels = {
        "USABILITY": "사용성",
        "ACCESSIBILITY": "접근성",
        "EFFICIENCY": "탐색 효율",
        "PERFORMANCE": "성능",
        "BEST_PRACTICES": "기술 품질",
    }
    severity_rank = {"CRITICAL": 0, "MAJOR": 1, "MINOR": 2}
    sorted_defects = sorted(
        defects,
        key=lambda defect: (severity_rank.get(defect.severity, 3), defect.timestamp_offset)
    )
    grouped_defects = []
    grouped_index = {}
    for defect in sorted_defects:
        group_key = (defect.category, defect.rule_id or defect.description)
        if group_key not in grouped_index:
            grouped_index[group_key] = len(grouped_defects)
            grouped_defects.append([defect])
        else:
            grouped_defects[grouped_index[group_key]].append(defect)
    top_groups = select_balanced_defect_groups(grouped_defects, limit=5)

    if scores["overall"] >= 85:
        summary = "주요 흐름은 전반적으로 안정적입니다. 일부 세부 항목을 보완하면 더 완성도 높은 경험이 됩니다."
    elif scores["overall"] >= 70:
        summary = "서비스 이용은 가능하지만 사용성, 접근성, 탐색 흐름에서 개선 지점이 확인되었습니다."
    else:
        summary = "사용자가 주요 흐름에서 막히거나 지연될 가능성이 큽니다. 심각도가 높은 항목부터 우선 개선하세요."

    lines = [
        "### 종합 진단",
        f"- 종합 점수는 {scores['overall']}점입니다.",
        f"- {summary}",
        "",
        "### 항목별 점수",
        f"- 사용성: {scores['usability']}점",
        f"- 접근성: {scores['accessibility']}점",
        f"- 탐색 효율: {scores['efficiency']}점",
        f"- 성능: {scores['performance']}점",
        f"- 기술 품질: {scores['bestPractices']}점",
        "",
        "### 주요 개선 항목",
    ]

    if not top_groups:
        lines.append("- 이번 테스트에서 즉시 조치가 필요한 주요 결함은 감지되지 않았습니다.")
    else:
        groups_by_category = {}
        for group in top_groups:
            groups_by_category.setdefault(group[0].category, []).append(group)

        for category, groups in groups_by_category.items():
            label = category_labels.get(category, "Quality")
            lines.append(f"#### {label}")
            for group in groups:
                lines.append(summarize_defect_group(group, label).replace(f"- {label}: ", "- ", 1))

    lines.extend([
        "",
        "### 평가 기준",
        "- Lighthouse, axe-core, Playwright 기반 사용성 검사를 종합해 점수를 산정했습니다.",
        "- AI 문장은 측정 결과를 이해하기 쉽게 요약할 뿐, 점수 자체를 변경하지 않습니다.",
    ])
    return "\n".join(lines)

def collect_public_action_candidates(page) -> Dict[str, Any]:
    """현재 화면에서 비인증 공개 액션 후보를 수집하고 점수화합니다.

    버튼, 링크, role=button 요소를 대상으로 텍스트/href/위치/크기를 보고 클릭 우선순위를 계산합니다.
    로그인/회원가입/로고/현재 URL 링크는 감점해 실제 사용자 과업에 가까운 후보가 먼저 선택되도록 합니다.
    """
    return page.evaluate("""
        () => {
            const visible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const cssEscape = (value) => window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
            const selectorFor = (el) => {
                const tag = el.tagName.toLowerCase();
                if (el.id) return `${tag}#${cssEscape(el.id)}`;
                const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy');
                if (testId) return `${tag}[data-testid="${cssEscape(testId)}"]`;
                if (el.getAttribute('aria-label')) return `${tag}[aria-label="${cssEscape(el.getAttribute('aria-label'))}"]`;
                if (typeof el.className === 'string' && el.className.trim()) return `${tag}.${cssEscape(el.className.trim().split(/\\s+/)[0])}`;
                const all = Array.from(document.querySelectorAll(tag));
                const index = all.indexOf(el) + 1;
                return `${tag}:nth-of-type(${Math.max(index, 1)})`;
            };
            const authPattern = /\uB85C\uADF8\uC778|\uB85C\uADF8\uC544\uC6C3|\uD68C\uC6D0\uAC00\uC785|\uBE44\uBC00\uBC88\uD638|\uC544\uC774\uB514|login|logout|sign\\s?in|sign\\s?up|password|auth/i;
            const publicPattern = /\uC0C1\uD488|\uC81C\uD488|\uB9C8\uCF13|\uC0C1\uC810|\uC2A4\uD1A0\uC5B4|\uC7A5\uBC14\uAD6C\uB2C8|\uCE74\uD2B8|\uAD6C\uB9E4|\uC8FC\uBB38|\uAC80\uC0C9|\uCE74\uD14C\uACE0\uB9AC|\uBAA9\uB85D|\uC0C1\uC138|\uB354\uBCF4\uAE30|\uC2DC\uC791|\uBD84\uC11D|product|item|shop|market|store|cart|basket|buy|order|search|category|detail|more|start|test|analy[sz]e/i;
            const strongPattern = /\uC7A5\uBC14\uAD6C\uB2C8|\uCE74\uD2B8|\uAD6C\uB9E4|\uC8FC\uBB38|\uAC80\uC0C9|cart|basket|buy|order|search/i;
            const logoPattern = /logo|brand|home|bulletmarket/i;
            const candidates = Array.from(document.querySelectorAll('button, a[href], [role="button"], input[type="button"], input[type="submit"]'))
                .filter(visible)
                .map((el) => {
                    const text = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
                    const href = el.href || el.getAttribute('href') || '';
                    const haystack = `${text} ${href}`.trim();
                    const rect = el.getBoundingClientRect();
                    let targetUrl = null;
                    try {
                        targetUrl = href ? new URL(href, location.href) : null;
                    } catch {
                        targetUrl = null;
                    }
                    const isCurrentUrl = targetUrl && targetUrl.href.replace(/#$/, '') === location.href.replace(/#$/, '');
                    const isHashOnly = href === '#' || href.startsWith('#');
                    const isLogo = logoPattern.test(haystack) || el.closest('header') && /logo|brand/i.test(el.className || '');
                    let score = 0;
                    if (publicPattern.test(haystack)) score += 120;
                    if (strongPattern.test(haystack)) score += 80;
                    if (authPattern.test(haystack)) score -= 200;
                    if (isLogo || isCurrentUrl) score -= 180;
                    if (isHashOnly) score -= 20;
                    if (el.tagName.toLowerCase() === 'button') score += 35;
                    if (rect.top >= 0 && rect.top < window.innerHeight * 0.85) score += 20;
                    if (rect.width >= 40 && rect.height >= 32) score += 10;
                    if (el.tagName.toLowerCase() === 'a' && href) score += 5;
                    return { selector: selectorFor(el), text, href: href || null, score, isAuth: authPattern.test(haystack), isLogo, isCurrentUrl, isHashOnly };
                })
                .sort((a, b) => b.score - a.score || a.selector.localeCompare(b.selector));
            return {
                total: candidates.length,
                publicCount: candidates.filter((c) => !c.isAuth && c.score > 0).length,
                authCount: candidates.filter((c) => c.isAuth).length,
                candidates: candidates.slice(0, 60)
            };
        }
    """)


def recover_to_exploration_base(page, base_url: str):
    """다음 탐색을 위해 화면을 기준 URL 또는 이전 상태로 되돌립니다.

    모달은 Escape로 닫고, URL이 바뀌었으면 뒤로 가기 후 실패 시 base_url로 다시 이동합니다.
    복구 실패는 치명적 오류로 보지 않고 다음 단계에서 가능한 만큼 계속 진행합니다.
    """
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
    except Exception:
        pass
    if page.url != base_url:
        try:
            page.go_back(timeout=3500, wait_until="domcontentloaded")
            page.wait_for_timeout(250)
        except Exception:
            try:
                page.goto(base_url, timeout=4500, wait_until="domcontentloaded")
                page.wait_for_timeout(250)
            except Exception:
                pass


def flash_click_target(page, selector: str, label: Optional[str] = None):
    """사용자 VNC 화면에서 자동 클릭 지점을 잠깐 강조 표시합니다.

    브라우저를 직접 지켜보는 사용자가 워커가 어떤 요소를 누르는지 이해할 수 있도록 빨간 원형 마커를 DOM에 삽입하고
    짧은 시간 뒤 제거합니다.
    """
    try:
        page.evaluate(
            """
            ({ selector, label }) => {
                const target = document.querySelector(selector);
                if (!target) return false;
                const rect = target.getBoundingClientRect();
                if (!rect || rect.width <= 0 || rect.height <= 0) return false;

                const previous = document.getElementById('flowcheck-click-flash');
                if (previous) previous.remove();

                const marker = document.createElement('div');
                marker.id = 'flowcheck-click-flash';
                marker.setAttribute('aria-hidden', 'true');
                marker.style.position = 'fixed';
                marker.style.left = `${rect.left + rect.width / 2}px`;
                marker.style.top = `${rect.top + rect.height / 2}px`;
                marker.style.width = `${Math.max(44, Math.min(120, rect.width + 18))}px`;
                marker.style.height = `${Math.max(44, Math.min(120, rect.height + 18))}px`;
                marker.style.transform = 'translate(-50%, -50%)';
                marker.style.border = '4px solid #ef4444';
                marker.style.borderRadius = '999px';
                marker.style.background = 'rgba(239, 68, 68, 0.18)';
                marker.style.boxShadow = '0 0 0 9999px rgba(239, 68, 68, 0.04), 0 0 22px rgba(239, 68, 68, 0.8)';
                marker.style.zIndex = '2147483647';
                marker.style.pointerEvents = 'none';
                marker.style.transition = 'opacity 220ms ease, transform 220ms ease';

                if (label) {
                    const caption = document.createElement('div');
                    caption.textContent = label.slice(0, 40);
                    caption.style.position = 'absolute';
                    caption.style.left = '50%';
                    caption.style.bottom = 'calc(100% + 6px)';
                    caption.style.transform = 'translateX(-50%)';
                    caption.style.padding = '4px 8px';
                    caption.style.borderRadius = '999px';
                    caption.style.background = '#ef4444';
                    caption.style.color = '#fff';
                    caption.style.font = '700 12px/1.2 system-ui, sans-serif';
                    caption.style.whiteSpace = 'nowrap';
                    marker.appendChild(caption);
                }

                document.documentElement.appendChild(marker);
                window.setTimeout(() => {
                    marker.style.opacity = '0';
                    marker.style.transform = 'translate(-50%, -50%) scale(1.18)';
                }, 650);
                window.setTimeout(() => marker.remove(), 980);
                return true;
            }
            """,
            {"selector": selector, "label": label or "클릭"},
        )
        page.wait_for_timeout(180)
    except Exception as e:
        uiux_log("click_flash.failed", selector=selector, error=str(e))


def exploratory_action_sweep(page, add_defect_fn, start_time, site_profile=None, max_actions=7):
    """여러 공개 기능 후보를 연속으로 훑는 범용 탐색 루프입니다.

    한 번 성공했다고 끝내지 않고, 액션 결과를 기록한 뒤 원래 화면으로 복구해서 다음 후보를 시도합니다.
    포털/커뮤니티/콘텐츠 사이트처럼 한 화면에 여러 과업이 있는 경우 테스트가 한 지점에 멈추지 않게 하는 핵심 로직입니다.
    """
    base_url = page.url
    visited = set()
    actions = []
    failures = []
    current_offset = int(time.time() - start_time)

    for round_index in range(max_actions):
        try:
            candidate_info = collect_public_action_candidates(page)
        except Exception as e:
            failures.append({"round": round_index + 1, "error": str(e)})
            break

        candidates = [
            c for c in candidate_info.get("candidates", [])
            if not c.get("isAuth") and not c.get("isLogo") and c.get("score", 0) > 0
        ]
        selected = None
        for candidate in candidates:
            key = f"{candidate.get('selector')}|{candidate.get('text')}|{candidate.get('href')}"
            if key not in visited:
                selected = candidate
                visited.add(key)
                break
        if not selected:
            uiux_log("action_sweep.no_candidate", round=round_index + 1, candidateInfo=candidate_info)
            break

        selector = selected.get("selector")
        before_url = page.url
        before_state = summarize_page_state(page)
        try:
            nav_start = time.time()
            flash_click_target(page, selector, selected.get("text") or selected.get("href") or "클릭")
            page.locator(selector).first.click(timeout=2500)
            try:
                page.wait_for_load_state("domcontentloaded", timeout=4000)
            except Exception:
                pass
            page.wait_for_timeout(350)
            elapsed = time.time() - nav_start
            after_state = summarize_page_state(page)
            changed = (
                page.url != before_url
                or after_state.get("bodyLength") != before_state.get("bodyLength")
                or after_state.get("title") != before_state.get("title")
                or after_state.get("passwordInputs") != before_state.get("passwordInputs")
            )
            outcome = "success" if changed else "no_effect"
            if after_state.get("likelyAuthWall"):
                outcome = "auth_required"
            action_log = {
                "round": round_index + 1,
                "selector": selector,
                "text": selected.get("text"),
                "href": selected.get("href"),
                "beforeUrl": before_url,
                "afterUrl": page.url,
                "elapsed": round(elapsed, 3),
                "changed": changed,
                "outcome": outcome,
                "afterTitle": after_state.get("title"),
            }
            actions.append(action_log)
            uiux_log("action_sweep.clicked", **action_log)
            if outcome == "auth_required":
                add_defect_fn(
                    category="USABILITY",
                    selector=selector,
                    severity="MINOR",
                    description="핵심 기능 후보가 로그인 요구 화면으로 이어졌습니다.",
                    timestamp_offset=current_offset,
                    source="PLAYWRIGHT",
                    rule_id="task-auth-required",
                    evidence={"selector": selector, "text": selected.get("text"), "siteType": (site_profile or {}).get("primaryType")},
                    recommendation="인증이 필요한 기능은 이유와 다음 행동을 명확히 안내하고, 가능한 공개 대체 경로를 제공하세요."
                )
            recover_to_exploration_base(page, base_url)
        except Exception as e:
            failure = {"round": round_index + 1, "selector": selector, "text": selected.get("text"), "error": str(e)}
            failures.append(failure)
            uiux_log("action_sweep.failed", **failure)
            recover_to_exploration_base(page, base_url)

    success_count = len([a for a in actions if a.get("outcome") == "success"])
    auth_count = len([a for a in actions if a.get("outcome") == "auth_required"])
    return {
        "ok": bool(actions),
        "mode": "action_sweep",
        "outcome": "multi_action_explored" if actions else "skipped_no_candidate",
        "actions": actions,
        "actionCount": len(actions),
        "successCount": success_count,
        "authRequiredCount": auth_count,
        "failures": failures[:5],
        "candidateCount": len(visited),
        "publicCandidateCount": len(visited),
        "reason": f"{len(actions)}개 기능 후보를 순회 탐색했습니다. 성공 {success_count}개, 인증 요구 {auth_count}개.",
    }


def deterministic_primary_action(page, add_defect_fn, start_time, site_profile=None):
    """단일 핵심 액션 후보를 결정적으로 선택해 실행합니다.

    현재 화면의 버튼/링크 후보를 점수화해 하나씩 클릭하고, URL/본문 길이/title/password input 수 변화로 성공 여부를
    판단합니다. 로그인 모달처럼 인증 장벽이 뜬 경우에는 결함으로 기록하고 다른 후보를 계속 시도합니다.
    """
    current_offset = int(time.time() - start_time)
    before_state = summarize_page_state(page)
    uiux_log("primary_action.begin", pageState=before_state, siteProfile=site_profile or {})

    try:
        candidate_info = collect_public_action_candidates(page)
    except Exception as e:
        candidate_info = {"total": 0, "publicCount": 0, "authCount": 0, "candidates": [], "error": str(e)}
    uiux_log("primary_action.candidates", **candidate_info)

    candidates = [c for c in candidate_info.get("candidates", []) if not c.get("isAuth") and not c.get("isLogo") and c.get("score", 0) > 0]
    no_effect_attempts = []
    for action in candidates[:8]:
        selector = action.get("selector")
        try:
            before_url = page.url
            before_state = summarize_page_state(page)
            nav_start = time.time()
            flash_click_target(page, selector, action.get("text") or action.get("href") or "클릭")
            page.locator(selector).first.click(timeout=2500)
            try:
                page.wait_for_load_state("domcontentloaded", timeout=4000)
            except Exception:
                pass
            page.wait_for_timeout(350)
            elapsed = time.time() - nav_start
            after_state = summarize_page_state(page)
            outcome = "success"
            if after_state.get("likelyAuthWall"):
                outcome = "auth_required"
                try:
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                except Exception:
                    pass
            changed = (
                page.url != before_url
                or after_state.get("bodyLength") != before_state.get("bodyLength")
                or after_state.get("title") != before_state.get("title")
                or after_state.get("passwordInputs") != before_state.get("passwordInputs")
            )
            uiux_log("primary_action.clicked", selector=selector, text=action.get("text"), beforeUrl=before_url, afterUrl=page.url, elapsed=round(elapsed, 3), changed=changed, outcome=outcome, afterState=after_state)
            if not changed:
                no_effect_attempts.append({"selector": selector, "text": action.get("text"), "href": action.get("href")})
                continue
            if outcome == "auth_required":
                add_defect_fn(
                    category="USABILITY",
                    selector=selector,
                    severity="MINOR",
                    description="선택한 핵심 액션이 로그인 요구 화면으로 이어졌습니다.",
                    timestamp_offset=current_offset,
                    source="PLAYWRIGHT",
                    rule_id="task-auth-required",
                    evidence={"selector": selector, "text": action.get("text"), "siteType": (site_profile or {}).get("primaryType")},
                    recommendation="비로그인 사용자가 접근 가능한 대체 경로를 제공하거나, 인증이 필요한 이유와 다음 행동을 명확히 안내하세요."
                )
                no_effect_attempts.append({"selector": selector, "text": action.get("text"), "outcome": "auth_required"})
                continue
            return {
                "ok": True,
                "mode": "click",
                "outcome": outcome,
                "selector": selector,
                "text": action.get("text"),
                "beforeUrl": before_url,
                "afterUrl": page.url,
                "elapsed": elapsed,
                "candidateCount": candidate_info.get("total", 0),
                "publicCandidateCount": candidate_info.get("publicCount", 0),
                "noEffectAttempts": no_effect_attempts,
            }
        except Exception as e:
            uiux_log("primary_action.click_failed", selector=selector, text=action.get("text"), error=str(e))
            no_effect_attempts.append({"selector": selector, "text": action.get("text"), "error": str(e)})

    if no_effect_attempts:
        uiux_log("primary_action.no_effect", attempts=no_effect_attempts)

    attempted_paths = []
    parsed = urlparse(page.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else page.url
    for path in ["/", "/products", "/product", "/items", "/shop", "/market", "/store", "/cart", "/basket", "/search", "/categories"]:
        candidate_url = urljoin(base_url, path)
        if candidate_url in attempted_paths:
            continue
        attempted_paths.append(candidate_url)
        try:
            nav_start = time.time()
            response = page.goto(candidate_url, timeout=5000, wait_until="domcontentloaded")
            page.wait_for_timeout(300)
            state = summarize_page_state(page)
            status = response.status if response else None
            elapsed = time.time() - nav_start
            uiux_log("primary_action.path_probe", url=candidate_url, status=status, elapsed=round(elapsed, 3), likelyAuthWall=state.get("likelyAuthWall"), bodyLength=state.get("bodyLength"))
            if status and status >= 400:
                continue
            if not state.get("likelyAuthWall") and state.get("bodyLength", 0) > 80:
                return {
                    "ok": True,
                    "mode": "path_probe",
                    "beforeUrl": before_state.get("url"),
                    "afterUrl": page.url,
                    "elapsed": elapsed,
                    "candidateCount": candidate_info.get("total", 0),
                    "publicCandidateCount": candidate_info.get("publicCount", 0),
                    "attemptedPaths": attempted_paths,
                    "reason": "공개 CTA가 없어 같은 도메인의 공개 경로를 추가로 탐색했습니다."
                }
        except Exception as e:
            uiux_log("primary_action.path_probe_failed", url=candidate_url, error=str(e))

    if before_state.get("likelyAuthWall"):
        add_defect_fn(
            category="USABILITY",
            selector="body",
            severity="MAJOR",
            description="로그인 폼에 막혔고, 비로그인 상태에서 접근 가능한 상품/장바구니/검색/탐색 흐름을 찾지 못했습니다.",
            timestamp_offset=current_offset,
            source="PLAYWRIGHT",
            rule_id="login-wall-limited-coverage",
            evidence={"startUrl": before_state.get("url"), "attemptedPaths": attempted_paths, "candidateSummary": candidate_info},
            recommendation="공개 데모, 상품 목록, 검색, 비회원 장바구니 경로 중 하나를 제공하거나 테스트 전용 자격 증명을 안전한 설정으로 주입하세요."
        )
    return {
        "ok": False,
        "outcome": "skipped_no_candidate",
        "reason": "인증 없이 실행 가능한 공개 액션이나 같은 도메인의 공개 경로를 찾지 못했습니다.",
        "candidateCount": candidate_info.get("total", 0),
        "publicCandidateCount": candidate_info.get("publicCount", 0),
        "authCandidateCount": candidate_info.get("authCount", 0),
        "attemptedPaths": attempted_paths,
    }

def deterministic_form_feedback_check(page, add_defect_fn, start_time):
    """검색창 또는 일반 입력 폼의 피드백 동작을 검사합니다.

    테스트 값을 입력한 뒤 검색 결과나 검증 메시지가 화면에 나타나는지 확인합니다.
    로그인/회원가입 폼만 보이는 상황에서는 비밀번호 폼을 임의 제출하지 않고 안전하게 스킵합니다.
    """
    form_info = page.evaluate("""
        () => {
            const visible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const cssEscape = (value) => window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
            const selectorFor = (el) => {
                const tag = el.tagName.toLowerCase();
                if (el.id) return `${tag}#${cssEscape(el.id)}`;
                if (el.name) return `${tag}[name="${cssEscape(el.name)}"]`;
                if (el.getAttribute('aria-label')) return `${tag}[aria-label="${cssEscape(el.getAttribute('aria-label'))}"]`;
                if (typeof el.className === 'string' && el.className.trim()) return `${tag}.${cssEscape(el.className.trim().split(/\\s+/)[0])}`;
                const all = Array.from(document.querySelectorAll(tag));
                return `${tag}:nth-of-type(${Math.max(all.indexOf(el) + 1, 1)})`;
            };
            const authPattern = /\uB85C\uADF8\uC778|\uB85C\uADF8\uC544\uC6C3|\uD68C\uC6D0\uAC00\uC785|\uBE44\uBC00\uBC88\uD638|\uC544\uC774\uB514|login|logout|sign\\s?in|sign\\s?up|password|auth/i;
            const searchPattern = /\uAC80\uC0C9|search|query|keyword|q/i;
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'))
                .filter(visible)
                .filter((el) => !el.disabled && !el.readOnly);
            if (!inputs.length) return { found: false, totalInputs: 0 };
            const enriched = inputs.map((input) => {
                const form = input.closest('form');
                const container = form || input.closest('section, aside, header, main, div') || input.parentElement;
                const formText = container ? container.innerText : '';
                const haystack = `${input.type || ''} ${input.name || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''} ${formText || ''}`;
                const isPassword = (input.type || '').toLowerCase() === 'password';
                const isAuth = isPassword || authPattern.test(haystack);
                const isSearch = searchPattern.test(haystack) || (input.type || '').toLowerCase() === 'search';
                return { input, form, isAuth, isSearch };
            });
            const nonAuth = enriched.filter((item) => !item.isAuth);
            const chosen = nonAuth.find((item) => item.isSearch) || nonAuth[0];
            if (!chosen) {
                return { found: true, skipped: true, reason: '로그인/회원가입 입력 폼만 표시되어 폼 검사를 건너뛰었습니다.', totalInputs: inputs.length, authInputs: enriched.filter((item) => item.isAuth).length };
            }
            const submit = chosen.form
                ? Array.from(chosen.form.querySelectorAll('button, input[type="submit"]')).filter(visible)[0]
                : Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(visible).find((el) => !authPattern.test(el.innerText || el.value || ''));
            return {
                found: true,
                skipped: false,
                inputSelector: selectorFor(chosen.input),
                inputType: chosen.input.getAttribute('type') || chosen.input.tagName.toLowerCase(),
                isSearch: chosen.isSearch,
                submitSelector: submit ? selectorFor(submit) : null,
                beforeText: document.body.innerText.slice(0, 5000),
                totalInputs: inputs.length,
                authInputs: enriched.filter((item) => item.isAuth).length
            };
        }
    """)
    uiux_log("form_feedback.selected", **(form_info or {}), url=page.url)
    if not form_info or not form_info.get("found"):
        return {"ok": True, "reason": "검사 가능한 입력 필드가 화면에 없습니다.", "totalInputs": 0}
    if form_info.get("skipped"):
        return {"ok": True, "skipped": True, "reason": form_info.get("reason"), "totalInputs": form_info.get("totalInputs"), "authInputs": form_info.get("authInputs")}

    current_offset = int(time.time() - start_time)
    input_type = (form_info.get("inputType") or "").lower()
    invalid_value = "not-an-email" if "email" in input_type else "flowcheck-test"
    if form_info.get("isSearch"):
        invalid_value = "test"
    try:
        page.locator(form_info["inputSelector"]).first.fill(invalid_value, timeout=2000)
        if form_info.get("submitSelector"):
            flash_click_target(page, form_info["submitSelector"], "제출")
            page.locator(form_info["submitSelector"]).first.click(timeout=2000)
        else:
            page.locator(form_info["inputSelector"]).first.press("Enter", timeout=2000)
        page.wait_for_timeout(400)
        feedback = page.evaluate("""
            (beforeText) => {
                const text = document.body.innerText.slice(0, 7000);
                const added = text.replace(beforeText || '', '').trim();
                const hasValidation = /\uD544\uC218|\uC624\uB958|\uC798\uBABB|\uD615\uC2DD|\uC785\uB825|\uD655\uC778|required|invalid|error|check|format/i.test(text);
                const hasSearchResult = /\uAC80\uC0C9|\uACB0\uACFC|\uC0C1\uD488|\uC81C\uD488|\uC5C6\uC2B5\uB2C8\uB2E4|search|result|product|item|no results/i.test(text);
                return { hasValidation, hasSearchResult, addedText: added.slice(0, 500) };
            }
        """, form_info.get("beforeText", ""))
        uiux_log("form_feedback.result", inputSelector=form_info["inputSelector"], isSearch=form_info.get("isSearch"), feedback=feedback, url=page.url)
        if not form_info.get("isSearch") and not feedback.get("hasValidation"):
            add_defect_fn(
                category="USABILITY",
                selector=form_info["inputSelector"],
                severity="MINOR",
                description="잘못된 입력 후 명확한 검증 피드백이 표시되지 않았습니다.",
                timestamp_offset=current_offset,
                source="UX_RULE",
                rule_id="form-validation-feedback",
                evidence={"inputSelector": form_info["inputSelector"], "submittedValue": invalid_value},
                recommendation="입력값이 올바르지 않을 때 해당 필드 근처에 구체적인 오류 메시지를 표시하세요."
            )
        return {"ok": True, "inputSelector": form_info["inputSelector"], "feedbackDetected": bool(feedback.get("hasValidation") or feedback.get("hasSearchResult")), "isSearch": form_info.get("isSearch")}
    except Exception as e:
        uiux_log("form_feedback.failed", inputSelector=form_info.get("inputSelector"), error=str(e))
        add_defect_fn(
            category="EFFICIENCY",
            selector=form_info["inputSelector"],
            severity="MINOR",
            description="폼 피드백 검사를 완료하지 못했습니다.",
            timestamp_offset=current_offset,
            source="PLAYWRIGHT",
            rule_id="form-feedback-check-failed",
            evidence={"inputSelector": form_info["inputSelector"], "error": str(e)},
            recommendation="테스트 시점에 입력 필드가 수정 가능하고 제출 버튼이 활성화되어 있는지 확인하세요."
        )
        return {"ok": False, "inputSelector": form_info["inputSelector"], "error": str(e)}

def deterministic_navigation_check(page, add_defect_fn, start_time):
    """같은 도메인 내부 내비게이션 링크가 정상 이동하는지 확인합니다.

    로그인/회원가입 링크는 제외하고 공개 링크를 우선 선택합니다. 후보가 없으면 실제 클릭 없이 스킵 결과를 반환하므로,
    프론트 타임라인에서는 해당 STEP이 빠르게 지나갈 수 있습니다.
    """
    nav_info = page.evaluate("""
        () => {
            const visible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const cssEscape = (value) => window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
            const authPattern = /\uB85C\uADF8\uC778|\uB85C\uADF8\uC544\uC6C3|\uD68C\uC6D0\uAC00\uC785|\uBE44\uBC00\uBC88\uD638|\uC544\uC774\uB514|login|logout|sign\\s?in|sign\\s?up|password|auth/i;
            const publicPattern = /\uC0C1\uD488|\uC81C\uD488|\uB9C8\uCF13|\uC0C1\uC810|\uC2A4\uD1A0\uC5B4|\uC7A5\uBC14\uAD6C\uB2C8|\uCE74\uD2B8|\uAD6C\uB9E4|\uC8FC\uBB38|\uAC80\uC0C9|\uCE74\uD14C\uACE0\uB9AC|\uBAA9\uB85D|\uC0C1\uC138|product|item|shop|market|store|cart|basket|buy|order|search|category|detail/i;
            const selectorFor = (a) => {
                if (a.id) return `a#${cssEscape(a.id)}`;
                const href = a.getAttribute('href') || '';
                return `a[href="${cssEscape(href)}"]`;
            };
            const links = Array.from(document.querySelectorAll('nav a[href], header a[href], main a[href], a[href]'))
                .filter(visible)
                .filter((a) => {
                    const href = a.getAttribute('href') || '';
                    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
                    try {
                        const url = new URL(href, location.href);
                        return url.origin === location.origin && url.href !== location.href;
                    } catch {
                        return false;
                    }
                })
                .map((a, index) => {
                    const text = (a.innerText || a.textContent || '').trim();
                    const haystack = `${text} ${a.href}`;
                    let score = 0;
                    if (publicPattern.test(haystack)) score += 100;
                    if (authPattern.test(haystack)) score -= 200;
                    if (index < 10) score += 10;
                    return { selector: selectorFor(a), href: a.href, text, index, score, isAuth: authPattern.test(haystack) };
                })
                .sort((a, b) => b.score - a.score || a.index - b.index);
            return {
                total: links.length,
                publicCount: links.filter((l) => !l.isAuth && l.score > 0).length,
                authCount: links.filter((l) => l.isAuth).length,
                selected: links.find((l) => !l.isAuth && l.score > 0) || links.find((l) => !l.isAuth) || null,
                candidates: links.slice(0, 10)
            };
        }
    """)
    uiux_log("navigation.candidates", **(nav_info or {}), url=page.url)
    selected = (nav_info or {}).get("selected")
    if not selected:
        return {"ok": True, "skipped": True, "reason": "로그인 외 같은 도메인 내비게이션 링크가 보이지 않아 건너뛰었습니다.", "candidateCount": (nav_info or {}).get("total", 0), "authCandidateCount": (nav_info or {}).get("authCount", 0)}

    current_offset = int(time.time() - start_time)
    try:
        before_url = page.url
        nav_start = time.time()
        flash_click_target(page, selected["selector"], selected.get("text") or selected.get("href") or "이동")
        page.locator(selected["selector"]).first.click(timeout=2500)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=4000)
        except Exception:
            pass
        page.wait_for_timeout(300)
        elapsed = time.time() - nav_start
        after_url = page.url
        uiux_log("navigation.clicked", selector=selected["selector"], text=selected.get("text"), href=selected.get("href"), beforeUrl=before_url, afterUrl=after_url, elapsed=round(elapsed, 3))
        if after_url == before_url:
            add_defect_fn(
                category="EFFICIENCY",
                selector=selected["selector"],
                severity="MINOR",
                description="같은 도메인 내비게이션 링크를 클릭했지만 페이지 URL 변화가 감지되지 않았습니다.",
                timestamp_offset=current_offset,
                source="PLAYWRIGHT",
                rule_id="navigation-no-url-change",
                evidence={"selector": selected["selector"], "href": selected["href"], "text": selected["text"]},
                recommendation="링크 라우트와 클릭 핸들러가 실제 화면 변화로 이어지는지 확인하세요."
            )
        try:
            page.go_back(timeout=3500, wait_until="domcontentloaded")
        except Exception:
            pass
        return {"ok": True, "selector": selected["selector"], "text": selected.get("text"), "beforeUrl": before_url, "afterUrl": after_url, "elapsed": elapsed, "candidateCount": nav_info.get("total", 0), "publicCandidateCount": nav_info.get("publicCount", 0)}
    except Exception as e:
        uiux_log("navigation.failed", selector=selected.get("selector"), href=selected.get("href"), error=str(e))
        add_defect_fn(
            category="EFFICIENCY",
            selector=selected["selector"],
            severity="MINOR",
            description="같은 도메인 내비게이션 링크를 열지 못했습니다.",
            timestamp_offset=current_offset,
            source="PLAYWRIGHT",
            rule_id="navigation-click-failed",
            evidence={"selector": selected["selector"], "href": selected["href"], "error": str(e)},
            recommendation="라우트가 존재하는지, 링크가 가려졌거나 비활성화되지 않았는지 확인하세요."
        )
        return {"ok": False, "selector": selected["selector"], "error": str(e), "candidateCount": nav_info.get("total", 0)}

def main():
    """컨테이너 워커의 실행 진입점입니다.

    REQUEST_ID와 TARGET_URL을 환경 변수로 받아 Chromium을 실행하고, 페이지 로드부터 사이트 분류, 액션 탐색,
    Lighthouse/axe 검사, 점수 계산, 최종 리포트 저장까지 전체 UI/UX 테스트 파이프라인을 순서대로 수행합니다.
    """
    request_id = os.getenv("REQUEST_ID")
    target_url = os.getenv("TARGET_URL")
    
    if not request_id or not target_url:
        print("Missing REQUEST_ID or TARGET_URL environment variables")
        sys.exit(1)

    print(f"Starting UI Agent via Fargate Script for requestId: {request_id}, targetUrl: {target_url}")
    vnc_url = os.getenv("VNC_URL")
    if vnc_url:
        report_step(request_id, 0, target_url, "STARTING_VNC", reason="브라우저 컨테이너가 시작되어 VNC 스트림을 준비합니다.", vnc_url=vnc_url)
    else:
        report_step(request_id, 0, target_url, "STARTING_BROWSER", reason="브라우저 컨테이너가 시작되어 실시간 화면 캡처를 준비합니다.")
    steps_history = [{
        "step": 0,
        "url": target_url,
        "action": "STARTING_VNC" if vnc_url else "STARTING_BROWSER",
        "reason": "브라우저 컨테이너가 시작되어 VNC 스트림을 준비합니다." if vnc_url else "브라우저 컨테이너가 시작되어 실시간 화면 캡처를 준비합니다.",
        **({"vncUrl": vnc_url} if vnc_url else {})
    }]
    failed_selectors = []
    
    start_time = time.time()
    performance_times = []
    defects = []
    unique_defects = set()
    console_errors = []
    page_errors = []

    def add_defect(
        category,
        selector,
        severity,
        description,
        timestamp_offset,
        source=None,
        rule_id=None,
        evidence=None,
        recommendation=None,
        screenshot_url=None
    ):
        """중복 결함을 제거하고 사용자용 한국어 설명으로 정규화해 defects 목록에 추가합니다.

        같은 category/selector/description/rule_id 조합은 한 번만 저장해 보고서가 반복 항목으로 과도하게 길어지는 것을
        막습니다. target-size 규칙은 어떤 요소가 작은지 보고서에 드러나도록 대상 요약을 덧붙입니다.
        """
        key = (category, selector, description, rule_id)
        if key not in unique_defects:
            unique_defects.add(key)
            localized_description = localize_uiux_text(description)
            localized_recommendation = localize_uiux_text(recommendation)
            if rule_id == "target-size":
                target = describe_defect_target(selector, evidence)
                if target and "대상:" not in localized_description:
                    localized_description = f"{localized_description} 대상: {target}."
            defects.append(UIUXTestDefect(
                category=category,
                selector=selector[:100] if selector else "N/A",
                severity=severity,
                description=localized_description,
                timestamp_offset=timestamp_offset,
                source=source,
                rule_id=rule_id,
                evidence=evidence,
                recommendation=localized_recommendation,
                screenshot_url=screenshot_url
            ))
    
    with sync_playwright() as p:
        try:
            # 여기부터가 UI/UX 테스트 워커의 실제 실행 순서입니다.
            # 각 단계는 "실제 검사 함수 실행 -> report_step()으로 진행 로그 저장" 순서로 동작합니다.
            # 프론트에 보이는 STEP 번호는 이 report_step 로그를 기반으로 표시됩니다.
            headless_mode = os.getenv("PLAYWRIGHT_HEADLESS", "false").lower() == "true"
            browser = p.chromium.launch(
                headless=headless_mode,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--use-gl=swiftshader",
                    "--window-size=1280,800",
                    "--ignore-certificate-errors",
                ],
            )
            video_dir = os.path.join(os.path.dirname(__file__), "videos")
            os.makedirs(video_dir, exist_ok=True)
            
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                record_video_dir=video_dir,
                record_video_size={"width": 800, "height": 500},
                ignore_https_errors=True
            )
            page = context.new_page()
            page.set_default_timeout(3000)
            page.set_default_navigation_timeout(INITIAL_PAGE_LOAD_TIMEOUT_MS)
            page.bring_to_front()
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            
            # STEP 1: 대상 URL을 실제 Chromium 페이지에 로드합니다.
            # 이 단계는 브라우저 화면을 만드는 진짜 네비게이션 작업입니다.
            nav_start = time.time()
            lighthouse_result = {"available": False, "error": "not-run"}
            axe_result = {"available": False, "error": "not-run"}
            accessibility_score = 80
            accessibility_deductions = []
            try:
                page.goto(target_url, timeout=INITIAL_PAGE_LOAD_TIMEOUT_MS, wait_until="domcontentloaded")
                page.bring_to_front()
                page.wait_for_timeout(INITIAL_SETTLE_TIMEOUT_MS)
                performance_times.append(time.time() - nav_start)
            except Exception as e:
                err = f"URL 로드 실패 {target_url}: {str(e)}"
                report_step(request_id, 1, target_url, "LOAD_PAGE", error=err, reason="초기 페이지 로드에 실패했습니다.")
                report_failure(request_id, f"URL 로드 실패: {str(e)}")
                browser.close()
                sys.exit(1)

            page.bring_to_front()
            initial_state = summarize_page_state(page)
            uiux_log("page.loaded", pageState=initial_state)
            report_step(request_id, 1, page.url, "LOAD_PAGE", reason="대상 페이지를 로드하고 초기 브라우저 상태를 기록했습니다.", screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 1, "url": page.url, "action": "LOAD_PAGE", "reason": "대상 페이지를 로드하고 초기 브라우저 상태를 기록했습니다.", "pageState": initial_state})

            # STEP 2: 사이트 유형을 먼저 분류하고, 그 유형에 맞는 UX 과업 후보를 정합니다.
            # 쇼핑몰/문서 협업/커뮤니티/게임/대시보드처럼 서비스별로 버튼 이름은 달라도
            # "핵심 사용자 과업" 관점으로 이후 액션을 해석하기 위한 준비 단계입니다.
            site_profile = classify_site_type(page)
            classification_reason = (
                f"사이트 유형을 {site_profile.get('primaryType')}로 분류했습니다. "
                f"신뢰도={site_profile.get('confidence')}, 근거={', '.join(site_profile.get('evidence', [])[:4]) or '근거 부족'}."
            )
            uiux_log("site.classified", siteProfile=site_profile, prompt=UNIVERSAL_UIUX_AGENT_PROMPT)
            report_step(request_id, 2, page.url, "CLASSIFY_SITE", reason=classification_reason, screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 2, "url": page.url, "action": "CLASSIFY_SITE", "reason": classification_reason, "siteProfile": site_profile})

            # STEP 4: 자체 DOM 규칙 검사입니다.
            # 터치 대상 크기, accessible name, form label, image alt 같은 정적 규칙을 확인합니다.
            # 클릭을 하지 않는 분석 단계라 빠르게 끝날 수 있습니다.
            page.bring_to_front()
            accessibility_score, accessibility_deductions = evaluate_accessibility_rules(page, add_defect, start_time)
            dom_reason = f"DOM 기반 규칙을 검사했고 {len(accessibility_deductions)}개 이슈 그룹을 찾았습니다."
            uiux_log("dom_rules.checked", url=page.url, issueGroups=len(accessibility_deductions), score=accessibility_score)
            report_step(request_id, 5, page.url, "CHECK_DOM_RULES", reason=dom_reason, screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 5, "url": page.url, "action": "CHECK_DOM_RULES", "reason": dom_reason, "issueGroups": len(accessibility_deductions)})

            # STEP 5: 첫 번째 실제 사용자 액션 탐색입니다.
            # 버튼/링크 후보를 점수화해서 클릭합니다.
            # 현재 구조에서는 "장바구니 클릭 -> 로그인 모달 표시"도 화면 변화로 보고 성공 처리될 수 있습니다.
            # 따라서 이 함수의 결과를 해석할 때 afterState.likelyAuthWall 또는 selector/text 로그를 같이 봐야 합니다.
            page.bring_to_front()
            primary_result = exploratory_action_sweep(page, add_defect, start_time, site_profile)
            if primary_result.get("elapsed") is not None:
                performance_times.append(primary_result["elapsed"])
            if not primary_result.get("ok") and primary_result.get("selector"):
                failed_selectors.append(primary_result["selector"])
            primary_reason = (
                f"주요 공개 흐름을 {primary_result.get('mode', 'none')} 방식으로 탐색했습니다. "
                f"공개 후보={primary_result.get('publicCandidateCount', 0)}개, 전체 후보={primary_result.get('candidateCount', 0)}개."
            )
            if primary_result.get("reason"):
                primary_reason += f" {primary_result.get('reason')}"
            report_step(request_id, 6, page.url, "EXPLORE_PRIMARY_ACTION", selector=primary_result.get("selector"), text=primary_result.get("text"), reason=primary_reason, error=primary_result.get("error"), screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 6, "url": page.url, "action": "EXPLORE_PRIMARY_ACTION", "reason": primary_reason, **primary_result})

            # STEP 6: 폼 또는 검색 입력 피드백 검사입니다.
            # STEP 5 이후의 현재 화면을 그대로 사용합니다.
            # 그래서 STEP 5에서 로그인 모달이 떠 있으면, 이 단계도 로그인 모달 위에서 입력 후보를 찾게 됩니다.
            # 후보가 없거나 로그인 폼만 있으면 실제 제출 없이 스킵되어 매우 빨리 끝납니다.
            page.bring_to_front()
            form_result = deterministic_form_feedback_check(page, add_defect, start_time)
            if not form_result.get("ok") and form_result.get("inputSelector"):
                failed_selectors.append(form_result["inputSelector"])
            form_reason = form_result.get("reason") or (
                f"폼/검색 피드백을 검사했습니다. 입력={form_result.get('inputSelector')}, 피드백 감지={form_result.get('feedbackDetected')}."
            )
            report_step(request_id, 7, page.url, "CHECK_FORM_FEEDBACK", selector=form_result.get("inputSelector"), reason=form_reason, error=form_result.get("error"), screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 7, "url": page.url, "action": "CHECK_FORM_FEEDBACK", "reason": form_reason, **form_result})

            # STEP 7: 내부 내비게이션 링크 검사입니다.
            # 현재 화면에서 같은 도메인 링크를 찾고, 로그인/회원가입 링크는 제외합니다.
            # 후보가 0개면 클릭 없이 스킵 결과를 반환하므로 UI상 거의 즉시 지나갑니다.
            page.bring_to_front()
            navigation_result = deterministic_navigation_check(page, add_defect, start_time)
            if navigation_result.get("elapsed") is not None:
                performance_times.append(navigation_result["elapsed"])
            if not navigation_result.get("ok") and navigation_result.get("selector"):
                failed_selectors.append(navigation_result["selector"])
            navigation_reason = navigation_result.get("reason") or (
                f"로그인 외 같은 도메인 내비게이션을 검사했습니다. 공개 후보={navigation_result.get('publicCandidateCount', 0)}개, 전체 후보={navigation_result.get('candidateCount', 0)}개."
            )
            report_step(request_id, 8, page.url, "CHECK_NAVIGATION", selector=navigation_result.get("selector"), text=navigation_result.get("text"), reason=navigation_reason, error=navigation_result.get("error"), screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 8, "url": page.url, "action": "CHECK_NAVIGATION", "reason": navigation_reason, **navigation_result})
            page.bring_to_front()

            # 공식/외부 분석 도구는 실제 탐색 액션을 먼저 수행한 뒤 실행합니다.
            # 배포 환경에서 Lighthouse가 느리거나 timeout이 나도 사용자는 이미 탐색 과정을 볼 수 있습니다.
            report_step(request_id, 9, page.url, "START_LIGHTHOUSE", reason="주요 화면 탐색 후 Lighthouse 측정을 짧게 시도합니다.", screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 9, "url": page.url, "action": "START_LIGHTHOUSE", "reason": "주요 화면 탐색 후 Lighthouse 측정을 짧게 시도합니다."})
            lighthouse_result = run_lighthouse_audit(target_url)
            lighthouse_step_reason = "Lighthouse 공식 audit 결과를 수집했습니다." if lighthouse_result.get("available") else "Lighthouse가 제한 시간 안에 완료되지 않아 대체 규칙을 사용합니다."
            report_step(request_id, 9, page.url, "RUN_LIGHTHOUSE", reason=lighthouse_step_reason, screenshot_url=capture_live_frame(page))
            steps_history.append({
                "step": 9,
                "url": page.url,
                "action": "RUN_LIGHTHOUSE",
                "reason": lighthouse_step_reason,
                "available": lighthouse_result.get("available", False),
                "error": lighthouse_result.get("error")
            })

            page.bring_to_front()
            report_step(request_id, 10, page.url, "START_AXE", reason="현재 화면 기준 axe-core 접근성 검사를 실행합니다.", screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 10, "url": page.url, "action": "START_AXE", "reason": "현재 화면 기준 axe-core 접근성 검사를 실행합니다."})
            axe_result = run_axe_audit(page)
            axe_step_reason = "axe-core 접근성 검사 결과를 수집했습니다." if axe_result.get("available") else "axe-core가 완료되지 않아 대체 규칙을 사용합니다."
            report_step(request_id, 10, page.url, "RUN_AXE", reason=axe_step_reason, screenshot_url=capture_live_frame(page))
            steps_history.append({
                "step": 10,
                "url": page.url,
                "action": "RUN_AXE",
                "reason": axe_step_reason,
                "available": axe_result.get("available", False),
                "error": axe_result.get("error")
            })

            # STEP 8은 브라우저를 조작하는 단계가 아닙니다.
            # 위에서 모은 Lighthouse/axe/DOM/액션 결과를 바탕으로 점수와 결함 목록을 계산한 뒤
            # "점수 계산 완료" 진행 로그를 저장합니다.
            # 따라서 STEP 7이 스킵되면 STEP 8은 바로 이어서 표시됩니다.
            # Final score calculation. Official engines provide core scores; AI never changes scores.
            lighthouse_deductions = add_lighthouse_findings(lighthouse_result, add_defect, start_time)
            axe_deductions = add_axe_findings(axe_result, add_defect, start_time)

            efficiency_deductions = []
            if failed_selectors:
                efficiency_deductions.append({
                    "ruleId": "interaction-failures",
                    "count": len(failed_selectors),
                    "failedSelectors": failed_selectors,
                    "deduction": min(60, len(failed_selectors) * 15)
                })
            successful_actions = len([
                s for s in steps_history
                if s.get("action") in ("LOAD_PAGE", "EXPLORE_PRIMARY_ACTION", "CHECK_FORM_FEEDBACK", "CHECK_NAVIGATION")
                and s.get("ok", True)
            ])
            efficiency_score = clamp_score(100 - min(60, len(failed_selectors) * 15) + min(5, successful_actions))

            avg_perf = sum(performance_times) / max(1, len(performance_times))
            timing_perf_score = clamp_score(100 - int(avg_perf * 10))
            performance_deductions = [{
                "ruleId": "action-response-time",
                "averageSeconds": round(avg_perf, 3),
                "deduction": 100 - timing_perf_score
            }]

            usability_score, usability_deductions = evaluate_usability_rules(page, steps_history, failed_selectors, add_defect, start_time)
            custom_best_practices_score, custom_best_practices_deductions = evaluate_best_practices(
                page,
                target_url,
                console_errors,
                page_errors,
                add_defect,
                start_time
            )
            lighthouse_scores = lighthouse_result.get("scores", {}) if lighthouse_result.get("available") else {}
            lighthouse_performance_score = lighthouse_scores.get("performance")
            lighthouse_accessibility_score = lighthouse_scores.get("accessibility")
            lighthouse_best_practices_score = lighthouse_scores.get("bestPractices")
            axe_score = axe_result.get("score") if axe_result.get("available") else None

            perf_score = lighthouse_performance_score if lighthouse_performance_score is not None else timing_perf_score
            best_practices_score = (
                lighthouse_best_practices_score
                if lighthouse_best_practices_score is not None
                else custom_best_practices_score
            )
            if axe_score is not None and lighthouse_accessibility_score is not None:
                accessibility_score = round(axe_score * 0.6 + lighthouse_accessibility_score * 0.4)
            elif axe_score is not None:
                accessibility_score = axe_score
            elif lighthouse_accessibility_score is not None:
                accessibility_score = lighthouse_accessibility_score

            overall_score = round(
                usability_score * 0.25
                + accessibility_score * 0.25
                + efficiency_score * 0.15
                + perf_score * 0.20
                + best_practices_score * 0.15
            )
            scores_payload = {
                "usability": usability_score,
                "accessibility": accessibility_score,
                "efficiency": efficiency_score,
                "performance": perf_score,
                "bestPractices": best_practices_score,
                "overall": overall_score
            }
            score_breakdown = {
                "weights": {
                    "usability": 0.25,
                    "accessibility": 0.25,
                    "efficiency": 0.15,
                    "performance": 0.20,
                    "bestPractices": 0.15
                },
                "deductions": {
                    "usability": usability_deductions,
                    "accessibility": accessibility_deductions + axe_deductions + [
                        d for d in lighthouse_deductions if d.get("category") == "ACCESSIBILITY"
                    ],
                    "efficiency": efficiency_deductions,
                    "performance": performance_deductions + [
                        d for d in lighthouse_deductions if d.get("category") == "PERFORMANCE"
                    ],
                    "bestPractices": custom_best_practices_deductions + [
                        d for d in lighthouse_deductions if d.get("category") == "BEST_PRACTICES"
                    ]
                },
                "metrics": {
                    "failedSelectorCount": len(failed_selectors),
                    "successfulActionCount": successful_actions,
                    "averageActionSeconds": round(avg_perf, 3),
                    "consoleErrorCount": len(console_errors),
                    "pageErrorCount": len(page_errors),
                    "lighthouseAvailable": lighthouse_result.get("available", False),
                    "axeAvailable": axe_result.get("available", False),
                    "lighthouseVersion": lighthouse_result.get("lighthouseVersion"),
                    "axeVersion": (axe_result.get("testEngine") or {}).get("version") if axe_result.get("available") else None
                },
                "sources": {
                    "usability": "PLAYWRIGHT_UX_RULES",
                    "accessibility": "AXE_CORE_AND_LIGHTHOUSE_ACCESSIBILITY",
                    "efficiency": "PLAYWRIGHT_ACTION_OUTCOMES",
                    "performance": "LIGHTHOUSE_PERFORMANCE" if lighthouse_performance_score is not None else "PLAYWRIGHT_TIMING_RULES",
                    "bestPractices": "LIGHTHOUSE_BEST_PRACTICES" if lighthouse_best_practices_score is not None else "PLAYWRIGHT_BEST_PRACTICE_RULES"
                },
                "engineResults": {
                    "lighthouse": {
                        "available": lighthouse_result.get("available", False),
                        "error": lighthouse_result.get("error"),
                        "debugError": lighthouse_result.get("debugError"),
                        "diagnostics": lighthouse_result.get("diagnostics"),
                        "scores": lighthouse_scores,
                        "finalUrl": lighthouse_result.get("finalUrl"),
                        "fetchTime": lighthouse_result.get("fetchTime")
                    },
                    "axe": {
                        "available": axe_result.get("available", False),
                        "error": axe_result.get("error"),
                        "score": axe_score,
                        "violationCount": len(axe_result.get("violations", [])) if axe_result.get("available") else 0
                    }
                }
            }
            final_evaluation_md = build_report_markdown(scores_payload, score_breakdown, defects)
            report_step(request_id, 11, page.url, "CALCULATE_SCORE", reason="수집한 audit과 탐색 결과로 최종 점수를 계산했습니다.", screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 11, "url": page.url, "action": "CALCULATE_SCORE", "reason": "수집한 audit과 탐색 결과로 최종 점수를 계산했습니다."})
            
            # STEP 10: 최종 보고서를 저장하는 단계입니다.
            # 이전에는 VNC 화면 확인용 keepalive sleep이 여기 있었지만,
            # 점수 계산 후에도 Running 상태가 불필요하게 오래 유지되어 제거했습니다.
            # 테스트가 끝났으면 바로 보고서를 저장하고 워커를 종료합니다.
            final_page_url = page.url
            video_path = page.video.path() if page.video else None
            context.close()
            browser.close()
            
            public_url = None
            if video_path and os.path.exists(video_path):
                public_url = upload_video_to_supabase(video_path, request_id)
                try:
                    os.remove(video_path)
                except Exception:
                    pass

            report_step(request_id, 12, final_page_url, "SAVE_REPORT", reason="점수, 결함, 영상 URL을 포함한 최종 보고서를 저장했습니다.")
            steps_history.append({"step": 12, "url": final_page_url, "action": "SAVE_REPORT", "reason": "점수, 결함, 영상 URL을 포함한 최종 보고서를 저장했습니다."})
            
            final_report = {
                "requestId": request_id,
                "scores": scores_payload,
                "scoreBreakdown": score_breakdown,
                "evaluationVersion": "v1",
                "deviceInfo": {
                    "browser": "chromium",
                    "width": 1280,
                    "height": 800,
                    "os": "linux"
                },
                "videoUrl": public_url,
                "uiuxTestReview": final_evaluation_md,
                "steps": steps_history,
                "defects": [{
                    "category": d.category,
                    "selector": d.selector,
                    "severity": d.severity,
                    "description": d.description,
                    "timestampOffset": d.timestamp_offset,
                    "source": d.source,
                    "ruleId": d.rule_id,
                    "evidence": d.evidence,
                    "recommendation": d.recommendation,
                    "screenshotUrl": d.screenshot_url
                } for d in defects]
            }
            
            report_report(request_id, final_report)
            
        except Exception as outer_e:
            err = f"Playwright execution crash: {str(outer_e)}"
            report_failure(request_id, err)
            sys.exit(1)

if __name__ == "__main__":
    main()
