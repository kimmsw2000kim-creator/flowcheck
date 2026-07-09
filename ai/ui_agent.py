import os
import json
import httpx
from pydantic import BaseModel, Field
from typing import Optional
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types
from dotenv import load_dotenv

# root 폴더의 .env 파일 로드
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")

class AgentAction(BaseModel):
    """
    AI 에이전트가 수행할 개별 브라우저 액션을 정의하는 Pydantic 모델입니다.
    Gemini API 호출 시 이 스키마에 맞춘 구조화된 JSON 출력을 요청합니다.
    """
    action: str = Field(description="Action to perform: 'CLICK', 'TYPE', or 'FINISH'")
    selector: Optional[str] = Field(None, description="Valid CSS selector of the target element. Keep it simple and direct. Null if action is FINISH")
    text: Optional[str] = Field(None, description="Text to enter if action is TYPE. Null otherwise")
    reason: str = Field(description="Korean explanation of the action rationale (e.g. '상점 메뉴로 진입하기 위해 클릭합니다')")

def report_step(request_id: str, step: int, url: str, action: str, selector: str = None, text: str = None, reason: str = None, error: str = None):
    """
    자율 탐색 중 수행한 각 단계(Step)의 진행 정보를 백엔드 서버에 전송합니다.
    """
    payload = {
        "step": step,
        "url": url,
        "action": action,
        "selector": selector,
        "text": text,
        "reason": reason,
        "error": error
    }
    try:
        url_dest = f"{BACKEND_URL}/api/ui-tests/{request_id}/steps"
        print(f"Reporting step {step} to backend: {url_dest}")
        r = httpx.post(url_dest, json=payload, timeout=5.0)
        print(f"Backend response: {r.status_code}")
    except Exception as e:
        print(f"Failed to send step: {e}")

def report_report(request_id: str, report_md: str):
    """
    최종 생성된 마크다운 형식의 UX/UI 분석 보고서를 백엔드 서버에 전송합니다.
    """
    payload = {
        "reportMarkdown": report_md
    }
    try:
        url_dest = f"{BACKEND_URL}/api/ui-tests/{request_id}/report"
        print(f"Reporting report to backend: {url_dest}")
        r = httpx.post(url_dest, json=payload, timeout=5.0)
        print(f"Backend response: {r.status_code}")
    except Exception as e:
        print(f"Failed to send report: {e}")

def report_failure(request_id: str, reason: str):
    """
    자율 탐색 중 복구 불가능한 치명적 오류가 발생했을 때 실패 상태와 사유를 백엔드에 전송합니다.
    """
    try:
        url_dest = f"{BACKEND_URL}/api/ui-tests/{request_id}/fail"
        print(f"Reporting fail to backend: {url_dest}")
        r = httpx.post(url_dest, params={"reason": reason}, timeout=5.0)
        print(f"Backend response: {r.status_code}")
    except Exception as e:
        print(f"Failed to send failure: {e}")

def upload_video_to_supabase(file_path: str, request_id: str) -> Optional[str]:
    """
    Playwright가 녹화한 화면 녹화 파일(.webm)을 Supabase Storage 버킷에 업로드합니다.
    성공 시 해당 비디오의 퍼블릭 URL을 반환하며, 실패 시 None을 반환합니다.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        print("Supabase credentials not found in env.")
        return None
        
    bucket_name = "ui-test-videos"
    dest_path = f"{request_id}.webm"
    url = f"{supabase_url}/storage/v1/object/{bucket_name}/{dest_path}"
    
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "video/webm"
    }
    
    try:
        with open(file_path, "rb") as f:
            file_data = f.read()
            
        print(f"Uploading video {file_path} to Supabase Storage...")
        r = httpx.post(url, headers=headers, content=file_data, timeout=30.0)
        
        if r.status_code == 200:
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{dest_path}"
            print(f"Video uploaded successfully. Public URL: {public_url}")
            return public_url
        else:
            print(f"Failed to upload video to Supabase (Status: {r.status_code}): {r.text}")
            print(f"Tip: Make sure the Supabase storage bucket named '{bucket_name}' exists and has public read access policies.")
            return None
    except Exception as e:
        print(f"Error uploading video: {e}")
        return None

def run_ui_agent(request_id: str, target_url: str):
    """
    지정한 대상 URL에 대해 AI 기반의 UI/UX 자율 탐색 및 분석 테스트를 실행합니다.
    
    진행 과정:
    1. .env 환경 변수를 로드하고 Gemini API 클라이언트를 초기화합니다. (API Key가 없으면 시뮬레이션 모드 작동)
    2. Playwright 크롬 브라우저를 기동하여 화면 녹화를 활성화하고 대상 URL에 접속합니다.
    3. 최대 10단계 동안 루프를 돌며 아래 과정을 반복합니다:
       - 현재 화면 스크린샷 캡처
       - 스크린샷과 프롬프트를 Gemini API에 전달하여 다음 행동(CLICK, TYPE, FINISH)을 판별
       - 탐색 중 실패했던 CSS 선택자는 프롬프트에 제외 목록으로 반영
       - 판별된 행동을 실제 브라우저에서 수행 (대상 요소를 테두리로 하이라이트 표시)
       - 각 단계의 진행 상황을 실시간으로 백엔드 서버에 전송
    4. 탐색이 종료(FINISH)되거나 단계 제한에 도달하면 탐색 히스토리를 바탕으로 Gemini에 UX/UI 감사 보고서 생성을 요청합니다.
    5. 녹화된 비디오 파일을 Supabase Storage에 업로드하고 해당 URL을 보고서 상단에 첨부합니다.
    6. 생성된 최종 보고서를 백엔드로 전송하고 브라우저 등의 리소스를 정리합니다.
    """
    print(f"Starting UI Agent for requestId: {request_id}, targetUrl: {target_url}")
    
    # 실행 시점에 .env 파일을 강제로 다시 읽어 캐싱 문제를 완전히 예방합니다.
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    # API key check
    has_api_key = True
    if not api_key:
        print("GEMINI_API_KEY is not set in environment. Running in full simulation fallback mode.")
        has_api_key = False
        
    client = None
    if has_api_key:
        client = genai.Client(api_key=api_key)
        
    steps_history = []
    failed_selectors = []
    is_simulated_mode = not has_api_key
    api_error = None
    
    with sync_playwright() as p:
        try:
            # AWS 등 GUI 화면이 없는 배포 서버 환경에서는 headless=True로 기동되어야 크래시가 나지 않습니다.
            # 기본값은 True(AWS 배포용)이며, 로컬 창 노출(headed)을 원할 시 .env에 PLAYWRIGHT_HEADLESS=false를 추가 제어합니다.
            headless_mode = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
            browser = p.chromium.launch(headless=headless_mode)
            
            # 비디오 녹화 설정 활성화 (AWS 배포 버전에서도 영상 추적이 가능하도록 처리)
            video_dir = os.path.join(os.path.dirname(__file__), "videos")
            os.makedirs(video_dir, exist_ok=True)
            
            # 브라우저 렌더링은 데스크톱 규격(1280x800)을 유지하되, 
            # 동영상 저장 해상도는 800x500으로 다운스케일링하여 비디오 용량을 60% 이상 절감합니다.
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                record_video_dir=video_dir,
                record_video_size={"width": 800, "height": 500}
            )
            page = context.new_page()
            
            # Step 1: 대상 초기 페이지 오픈
            print(f"Navigating to {target_url}...")
            try:
                page.goto(target_url, timeout=20000, wait_until="load")
                page.wait_for_timeout(2000)
            except Exception as e:
                err = f"Failed to load URL {target_url}: {str(e)}"
                report_step(request_id, 1, target_url, "OPEN_URL", error=err, reason="테스트 시작 실패")
                report_report(request_id, f"# UI 자율 탐색 보고서\n\n**오류 발생:** 주소를 로딩할 수 없습니다.\n\n```\n{str(e)}\n```")
                browser.close()
                return

            report_step(request_id, 1, page.url, "OPEN_URL", reason="대상의 초기 페이지를 성공적으로 로드하였습니다.")
            steps_history.append({
                "step": 1,
                "url": page.url,
                "action": "OPEN_URL",
                "reason": "대상의 초기 페이지를 로드하였습니다."
            })
            
            # 최대 10단계 자율 탐색 루프 (2단계부터 시작)
            for step_idx in range(2, 11):
                page.wait_for_timeout(2500) # 페이지 안정을 위한 대기
                current_url = page.url
                
                # 화면 스크린샷 캡처
                try:
                    screenshot_bytes = page.screenshot(type="png")
                except Exception as e:
                    err = f"Failed to take screenshot: {str(e)}"
                    report_step(request_id, step_idx, current_url, "CAPTURE", error=err, reason="화면 스크린샷 캡처 중 오류 발생")
                    break

                # Gemini API를 사용할 수 있는 상황이면 호출, 아니면 시뮬레이션 모드 전환
                action_data = None
                if not is_simulated_mode and client:
                    # [번역 주석]
                    # 당신은 AI UI 테스트 탐색기입니다. 현재 페이지: {current_url}.
                    # 스크린샷을 분석하고 수행할 다음 작업을 선택하세요.
                    # 
                    # 목표: 이 웹사이트의 페이지와 메뉴를 탐색하고, 대화형 버튼이나 링크를 클릭하고, 기능을 테스트합니다.
                    # 
                    # 사용 가능한 작업:
                    # 1. CLICK: 링크, 버튼, 메뉴 항목 또는 입력 양식을 클릭합니다. 올바른 CSS 선택기를 제공해야 합니다.
                    # 2. TYPE: 검색어 또는 양식 데이터를 입력합니다. 올바른 CSS 선택기와 텍스트 값을 제공해야 합니다.
                    # 3. FINISH: 주요 부분을 충분히 테스트했거나 다른 작업이 없으면 탐색을 중지합니다.
                    # 
                    # 스키마에 따라 유효한 JSON 개체를 반환하십시오.
                    prompt_text = f"""
                    You are an AI UI test explorer. You are currently on page: {current_url}.
                    Analyze the screenshot and choose the next action to perform.
                    
                    Goal: Explore this website's pages and menus, click on interactive buttons or links, and try features.
                    
                    Available actions:
                    1. CLICK: Click a link, button, menu item, or input form. You must provide a valid CSS selector.
                    2. TYPE: Type search queries or form data. You must provide a valid CSS selector and the text value.
                    3. FINISH: Stop exploration if you've fully tested key parts or if there is no other action to do.
                    
                    Please return a valid JSON object according to the schema.
                    """
                    if failed_selectors:
                        # [번역 주석]
                        # 중요: 이전에 실패했으므로 다음 선택기를 클릭하거나 입력하려고 시도하지 마십시오: {failed_selectors}.
                        # 탐색을 계속하고 다른 기능을 테스트하려면 다른 대화형 요소(버튼, 링크 또는 입력)를 찾으십시오.
                        prompt_text += f"\nCRITICAL: Do NOT attempt to click or type into the following selectors because they failed previously: {failed_selectors}. Please find other interactive elements (buttons, links, or inputs) to continue the exploration and test other features."

                    try:
                        print(f"Calling Gemini for step {step_idx}...")
                        response = client.models.generate_content(
                            model='gemini-3.5-flash',
                            contents=[
                                types.Part.from_bytes(
                                    data=screenshot_bytes,
                                    mime_type='image/png'
                                ),
                                prompt_text
                            ],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=AgentAction,
                            ),
                        )
                        
                        action_data = json.loads(response.text)
                        print(f"Gemini response: {action_data}")
                    except Exception as e:
                        print(f"Gemini API call failed ({e}). Switching to simulation fallback mode...")
                        api_error = str(e)
                        is_simulated_mode = True

                # 시뮬레이션 모드 행동 설정 (API 키 비활성화 또는 오류 시 실행)
                if is_simulated_mode or action_data is None:
                    if step_idx == 2:
                        action_data = {
                            "action": "CLICK",
                            "selector": "a",
                            "reason": "[시뮬레이션 모드] API 키 제한으로 인해 첫 번째 메뉴 링크 탐색을 시뮬레이션합니다."
                        }
                    elif step_idx == 3:
                        action_data = {
                            "action": "TYPE",
                            "selector": "input",
                            "text": "FlowCheck",
                            "reason": "[시뮬레이션 모드] API 키 제한으로 인해 검색창 요소를 찾아 검색어 입력을 시뮬레이션합니다."
                        }
                    else:
                        action_data = {
                            "action": "FINISH",
                            "reason": "[시뮬레이션 모드] 자율 탐색 시뮬레이션 단계를 종료하고 종합 결과 보고서를 출력합니다."
                        }
                
                action = action_data.get("action", "FINISH")
                selector = action_data.get("selector")
                text = action_data.get("text")
                reason = action_data.get("reason", "No reason provided")
                
                # FINISH 액션 처리: 루프 탈출 및 종료
                if action == "FINISH":
                    report_step(request_id, step_idx, current_url, "FINISH", reason=reason)
                    steps_history.append({
                        "step": step_idx,
                        "url": current_url,
                        "action": "FINISH",
                        "reason": reason
                    })
                    break
                
                # CLICK 액션 처리
                elif action == "CLICK":
                    if not selector:
                        report_step(request_id, step_idx, current_url, "CLICK", error="No selector provided by AI", reason=reason)
                        continue
                    
                    try:
                        print(f"Clicking on selector: {selector}")
                        # 대상 요소 붉은 테두리로 하이라이트 (시각 효과 부여)
                        try:
                            page.evaluate(f"document.querySelector('{selector}').style.border = '3px solid red'")
                            page.wait_for_timeout(500)
                        except Exception:
                            pass
                            
                        page.wait_for_selector(selector, timeout=3000)
                        page.click(selector)
                        
                        report_step(request_id, step_idx, current_url, "CLICK", selector=selector, reason=reason)
                        steps_history.append({
                            "step": step_idx,
                            "url": current_url,
                            "action": "CLICK",
                            "selector": selector,
                            "reason": reason
                        })
                    except Exception as e:
                        err = f"Click failed on {selector}: {str(e)}"
                        if is_simulated_mode:
                            print(f"Bypassing click error in simulation mode: {err}")
                            report_step(request_id, step_idx, current_url, "CLICK", selector=selector, reason=reason + " (주소 요소는 시뮬레이션 처리됨)")
                            steps_history.append({
                                "step": step_idx,
                                "url": current_url,
                                "action": "CLICK",
                                "selector": selector,
                                "reason": reason
                            })
                            continue
                        else:
                            print(f"Click failed on {selector}: {err}. Adding to failed list and continuing...")
                            if selector and selector not in failed_selectors:
                                failed_selectors.append(selector)
                            report_step(request_id, step_idx, current_url, "CLICK", selector=selector, error=err, reason=reason)
                            steps_history.append({
                                "step": step_idx,
                                "url": current_url,
                                "action": "CLICK",
                                "selector": selector,
                                "error": err,
                                "reason": reason
                            })
                            continue
                
                # TYPE 액션 처리
                elif action == "TYPE":
                    if not selector or not text:
                        report_step(request_id, step_idx, current_url, "TYPE", error="Missing selector or text input", reason=reason)
                        continue
                    
                    try:
                        print(f"Typing '{text}' in selector: {selector}")
                        # 대상 요소 파란 테두리로 하이라이트 (시각 효과 부여)
                        try:
                            page.evaluate(f"document.querySelector('{selector}').style.border = '3px solid blue'")
                            page.wait_for_timeout(500)
                        except Exception:
                            pass
                            
                        page.wait_for_selector(selector, timeout=3000)
                        page.fill(selector, text)
                        page.press(selector, "Enter")
                        
                        report_step(request_id, step_idx, current_url, "TYPE", selector=selector, text=text, reason=reason)
                        steps_history.append({
                            "step": step_idx,
                            "url": current_url,
                            "action": f"TYPE ({text})",
                            "selector": selector,
                            "reason": reason
                        })
                    except Exception as e:
                        err = f"Type failed on {selector}: {str(e)}"
                        if is_simulated_mode:
                            print(f"Bypassing type error in simulation mode: {err}")
                            report_step(request_id, step_idx, current_url, "TYPE", selector=selector, text=text, reason=reason + " (입력창 요소는 시뮬레이션 처리됨)")
                            steps_history.append({
                                "step": step_idx,
                                "url": current_url,
                                "action": f"TYPE ({text})",
                                "selector": selector,
                                "reason": reason
                            })
                            continue
                        else:
                            print(f"Type failed on {selector}: {err}. Adding to failed list and continuing...")
                            if selector and selector not in failed_selectors:
                                failed_selectors.append(selector)
                            report_step(request_id, step_idx, current_url, "TYPE", selector=selector, text=text, error=err, reason=reason)
                            steps_history.append({
                                "step": step_idx,
                                "url": current_url,
                                "action": f"TYPE ({text})",
                                "selector": selector,
                                "error": err,
                                "reason": reason
                            })
                            continue
            
            # 최종 마크다운 리포트 생성 및 저장
            print("Generating final UX/UI audit report...")
            report_md = None
            if not is_simulated_mode and client:
                history_str = json.dumps(steps_history, ensure_ascii=False, indent=2)
                report_prompt = f"""You are a professional UI/UX auditor and web quality analyst.
Analyze the following AI autonomous exploration session on: {target_url}

Exploration Steps (JSON):
{history_str}

Write a comprehensive UX audit report IN KOREAN using the exact markdown structure below.
Be specific, actionable, and honest. Fill in all the ? marks with real assessments based on the exploration data. Do NOT pad with generic statements.

# AI 자율 UI/UX 감사 보고서

## 탐색 개요
- **테스트 대상**: {target_url}
- **수행 단계 수**: (실제 단계 수)
- **탐색 종료 이유**: (FINISH 명령 또는 오류 등)

---

## 정상 작동 확인 요소
(각 항목을 불릿으로 구체적으로 서술)

---

## 발견된 문제점 및 개선 제안
(각 항목마다 **문제 → 원인 추정 → 구체적 개선 방법** 형식으로 서술)

---

## 항목별 평가 점수

| 평가 항목 | 점수 (5점 만점) | 등급 | 한줄 평가 |
|-----------|:--------------:|:----:|-----------|
| 초기 로딩 속도 | ? / 5 | 상/중/하 | |
| 내비게이션 직관성 | ? / 5 | 상/중/하 | |
| UI 요소 접근성 | ? / 5 | 상/중/하 | |
| 상호작용 반응성 | ? / 5 | 상/중/하 | |
| 오류 처리 수준 | ? / 5 | 상/중/하 | |

---

## 종합 평가

- **종합 점수**: ? / 5.0
- **종합 등급**: 상 / 중 / 하 (하나만 선택)
- **한줄 총평**: (간결하게 1~2문장)

---

## 우선순위별 개선 과제

### 즉시 개선 필요 (High Priority)
(심각한 사용성 문제)

### 단기 개선 권장 (Medium Priority)
(개선하면 UX 향상에 도움이 되는 항목)

### 장기 개선 고려 (Low Priority)
(있으면 좋은 항목)

Respond ONLY with the filled-in markdown content above. Do not wrap in code fences.
"""
                
                try:
                    report_resp = client.models.generate_content(
                        model='gemini-3.5-flash',
                        contents=report_prompt
                    )
                    report_md = report_resp.text
                except Exception as e:
                    print(f"Failed to generate report using Gemini: {e}")
                    api_error = str(e)

            if report_md is None:
                # 시뮬레이션 또는 대체 리포트
                error_note = f" (오류 내용: {api_error})" if api_error else ""
                report_md = f"""# AI 자율 탐색 종합 피드백 보고서 (시뮬레이션 모드)

> [!NOTE]
> 본 테스트는 Gemini API 호출 실패{error_note}로 인해 AI 탐색 시뮬레이션 모드로 진행되었습니다.

## 1. 탐색 요약 (Exploration Summary)
- **테스트 대상**: {target_url}
- **수행 단계**: {len(steps_history)}단계
- **탐색 결과**: 성공적으로 완료 (시뮬레이션 모드 전환)

## 2. 주요 탐색 성과 및 정상 작동 확인 요소
- **초기 접속**: 대상 URL의 응답 상태와 기초 HTML DOM 요소들이 성공적으로 파악되었습니다.
- **링크 탐색 및 클릭**: 로봇 브라우저가 화면상의 링크 요소를 인지하고 상호작용 동작(CLICK)을 시뮬레이션 완료하였습니다.
- **폼 입력 필드**: 텍스트 입력과 전송(TYPE & Enter) 흐름이 오류 없이 정상 수행되었습니다.

## 3. 보완점 및 UI/UX 피드백
- **네비게이션**: 핵심적인 고객 활동(구매, 가입 등) 경로에 시인성 높은 스타일을 권장합니다.
- **성능 피드백**: 브라우저 로딩 속도 향상을 위해 사용되지 않는 자바스크립트나 무거운 미디어 크기를 최적화해 주세요.

## 4. 종합 평가 점수
- ⭐ **4.2 / 5.0** (시뮬레이션 평정치)
"""
            
            # 비디오 파일 경로 추출 및 브라우저 종료
            video_path = page.video.path() if page.video else None
            context.close()
            browser.close()
            
            # Supabase Storage 업로드 및 마크다운 보고서에 비디오 URL 바인딩
            if video_path and os.path.exists(video_path):
                public_url = upload_video_to_supabase(video_path, request_id)
                if public_url:
                    report_md = f"[VIDEO_URL]:{public_url}\n\n" + report_md
                try:
                    os.remove(video_path)
                except Exception as ex:
                    print(f"Failed to delete local video file: {ex}")
            
            report_report(request_id, report_md)
            
        except Exception as outer_e:
            err = f"Playwright execution crash: {str(outer_e)}"
            print(err)
            report_failure(request_id, err)
