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
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")

class AgentAction(BaseModel):
    action: str = Field(description="Action to perform: 'CLICK', 'TYPE', or 'FINISH'")
    selector: Optional[str] = Field(None, description="Valid CSS selector of the target element. Keep it simple and direct. Null if action is FINISH")
    text: Optional[str] = Field(None, description="Text to enter if action is TYPE. Null otherwise")
    reason: str = Field(description="Korean explanation of the action rationale (e.g. '상점 메뉴로 진입하기 위해 클릭합니다')")

def report_step(request_id: str, step: int, url: str, action: str, selector: str = None, text: str = None, reason: str = None, error: str = None):
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
    try:
        url_dest = f"{BACKEND_URL}/api/ui-tests/{request_id}/fail"
        print(f"Reporting fail to backend: {url_dest}")
        r = httpx.post(url_dest, params={"reason": reason}, timeout=5.0)
        print(f"Backend response: {r.status_code}")
    except Exception as e:
        print(f"Failed to send failure: {e}")

def run_ui_agent(request_id: str, target_url: str):
    print(f"Starting UI Agent for requestId: {request_id}, targetUrl: {target_url}")
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        err_msg = "GEMINI_API_KEY is not set in environment."
        print(err_msg)
        report_failure(request_id, err_msg)
        return
        
    client = genai.Client(api_key=api_key)
    steps_history = []
    
    with sync_playwright() as p:
        try:
            print("Launching Chromium browser...")
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            
            # Step 1: Open initial page
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
            
            # 최대 10단계 자율 탐색 루프
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

                prompt_text = f"""
                You are an AI QA explorer. You are currently on page: {current_url}.
                Analyze the screenshot and choose the next action to perform.
                
                Goal: Explore this website's pages and menus, click on interactive buttons or links, and try features.
                
                Available actions:
                1. CLICK: Click a link, button, menu item, or input form. You must provide a valid CSS selector.
                2. TYPE: Type search queries or form data. You must provide a valid CSS selector and the text value.
                3. FINISH: Stop exploration if you've fully tested key parts or if there is no other action to do.
                
                Please return a valid JSON object according to the schema.
                """
                
                try:
                    print(f"Calling Gemini for step {step_idx}...")
                    response = client.models.generate_content(
                        model='gemini-2.5-flash',
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
                    err = f"Gemini API call failed: {str(e)}"
                    report_step(request_id, step_idx, current_url, "GEMINI_ANALYSIS", error=err, reason="AI 분석 수행 중 오류")
                    break
                
                action = action_data.get("action", "FINISH")
                selector = action_data.get("selector")
                text = action_data.get("text")
                reason = action_data.get("reason", "No reason provided")
                
                if action == "FINISH":
                    report_step(request_id, step_idx, current_url, "FINISH", reason=reason)
                    steps_history.append({
                        "step": step_idx,
                        "url": current_url,
                        "action": "FINISH",
                        "reason": reason
                    })
                    break
                
                elif action == "CLICK":
                    if not selector:
                        report_step(request_id, step_idx, current_url, "CLICK", error="No selector provided by AI", reason=reason)
                        break
                    
                    try:
                        print(f"Clicking on selector: {selector}")
                        # 대상 요소 붉은 테두리로 하이라이트 (시각 효과)
                        try:
                            page.evaluate(f"document.querySelector('{selector}').style.border = '3px solid red'")
                            page.wait_for_timeout(500)
                        except Exception:
                            pass
                            
                        page.wait_for_selector(selector, timeout=5000)
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
                        report_step(request_id, step_idx, current_url, "CLICK", selector=selector, error=err, reason=reason)
                        steps_history.append({
                            "step": step_idx,
                            "url": current_url,
                            "action": "CLICK",
                            "selector": selector,
                            "error": err,
                            "reason": reason
                        })
                        break
                
                elif action == "TYPE":
                    if not selector or not text:
                        report_step(request_id, step_idx, current_url, "TYPE", error="Missing selector or text input", reason=reason)
                        break
                    
                    try:
                        print(f"Typing '{text}' in selector: {selector}")
                        # 대상 요소 파란 테두리로 하이라이트 (시각 효과)
                        try:
                            page.evaluate(f"document.querySelector('{selector}').style.border = '3px solid blue'")
                            page.wait_for_timeout(500)
                        except Exception:
                            pass
                            
                        page.wait_for_selector(selector, timeout=5000)
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
                        report_step(request_id, step_idx, current_url, "TYPE", selector=selector, text=text, error=err, reason=reason)
                        steps_history.append({
                            "step": step_idx,
                            "url": current_url,
                            "action": f"TYPE ({text})",
                            "selector": selector,
                            "error": err,
                            "reason": reason
                        })
                        break
            
            # 최종 마크다운 리포트 생성 및 저장
            print("Generating final UX/UI audit report...")
            history_str = json.dumps(steps_history, ensure_ascii=False, indent=2)
            report_prompt = f"""
            You are an expert QA and UX designer.
            Analyze the following execution path of an AI autonomous exploration robot on target URL: {target_url}.
            
            Exploration Path Steps:
            {history_str}
            
            Please write a professional, highly readable UX audit report in Korean.
            The report must include:
            1. 탐색 요약 (Exploration Summary)
            2. 주요 탐색 성과 및 정상 작동 확인 요소
            3. 보완점 및 UI/UX 피드백 (예: 레이아웃, 사용성 개선 가능 부분)
            4. 종합 평가 점수 (예: 5점 만점 중 몇 점)
            
            Respond only with the markdown content. Do not include markdown block codes around the output report itself (just write raw markdown text).
            """
            
            try:
                report_resp = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=report_prompt
                )
                report_md = report_resp.text
            except Exception as e:
                report_md = f"# UI 자율 탐색 종합 피드백 보고서\n\n탐색이 진행되었으나, 최종 보고서 생성 단계에서 API 에러가 발생하였습니다.\n\n**에러 내용:** {str(e)}"
            
            report_report(request_id, report_md)
            browser.close()
            
        except Exception as outer_e:
            err = f"Playwright execution crash: {str(outer_e)}"
            print(err)
            report_failure(request_id, err)
