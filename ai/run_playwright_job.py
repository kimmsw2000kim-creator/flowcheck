import os
import sys
import json
import httpx
import time
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types
from dotenv import load_dotenv

# .env 로드
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://host.docker.internal:8080")

class AgentAction(BaseModel):
    action: str = Field(description="Action to perform: 'CLICK', 'TYPE', or 'FINISH'")
    selector: Optional[str] = Field(None, description="Valid CSS selector of the target element. Keep it simple and direct. Null if action is FINISH")
    text: Optional[str] = Field(None, description="Text to enter if action is TYPE. Null otherwise")
    reason: str = Field(description="Korean explanation of the action rationale")

class UIUXTestScores(BaseModel):
    usability: int
    accessibility: int
    efficiency: int
    performance: int

class UIUXTestDefect(BaseModel):
    category: str
    selector: str
    severity: str
    description: str
    timestamp_offset: int

class UIUXTestReportData(BaseModel):
    request_id: str
    scores: UIUXTestScores
    device_info: Dict[str, Any]
    video_url: Optional[str] = None
    defects: List[UIUXTestDefect]

def report_step(request_id: str, step: int, url: str, action: str, selector: str = None, text: str = None, reason: str = None, error: str = None, vnc_url: str = None):
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
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/steps"
        print(f"Reporting step {step} to backend: {url_dest}")
        r = httpx.post(url_dest, json=payload, timeout=5.0)
        r.raise_for_status()
    except Exception as e:
        print(f"Failed to send step: {e}")

def report_report(request_id: str, report_data: dict):
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/report"
        print(f"Reporting report to backend: {url_dest}")
        r = httpx.post(url_dest, json=report_data, timeout=5.0)
        r.raise_for_status()
    except Exception as e:
        if hasattr(e, 'response') and e.response:
            print(f"Failed to send report. Status: {e.response.status_code}, Body: {e.response.text}")
        else:
            print(f"Failed to send report: {e}")

def report_failure(request_id: str, reason: str):
    try:
        url_dest = f"{BACKEND_URL}/api/uiux-tests/{request_id}/fail"
        print(f"Reporting fail to backend: {url_dest}, Reason: {reason}")
        r = httpx.post(url_dest, params={"reason": reason}, timeout=5.0)
    except Exception as e:
        print(f"Failed to send failure: {e}")

def upload_video_to_supabase(file_path: str, request_id: str) -> Optional[str]:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
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
        r = httpx.post(url, headers=headers, content=file_data, timeout=30.0)
        if r.status_code == 200:
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{dest_path}"
            return public_url
        return None
    except Exception as e:
        return None

def calculate_accessibility_score(page, add_defect_fn, start_time):
    try:
        results = page.evaluate("""
            () => {
                let issues = [];
                let buttons = document.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
                buttons.forEach(b => {
                    let rect = b.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                        issues.push({selector: b.tagName.toLowerCase() + (b.id ? '#'+b.id : '') + (b.className ? '.'+b.className.split(' ').join('.') : ''), issue: 'Touch target too small', size: Math.round(rect.width) + 'x' + Math.round(rect.height)});
                    }
                });
                return issues;
            }
        """)
        base_score = 100
        current_offset = int(time.time() - start_time)
        for res in results:
            base_score -= 5
            desc = res['issue']
            if desc == 'Touch target too small':
                desc = f"해당 요소의 터치 영역이 {res['size']}px로 모바일 표준 규격(최소 44x44px)보다 작아 오클릭 위험이 있습니다."
            
            add_defect_fn(
                category="ACCESSIBILITY",
                selector=res['selector'],
                severity="MAJOR",
                description=desc,
                timestamp_offset=current_offset
            )
        return max(0, base_score)
    except Exception as e:
        return 80

def main():
    request_id = os.getenv("REQUEST_ID")
    target_url = os.getenv("TARGET_URL")
    
    if not request_id or not target_url:
        print("Missing REQUEST_ID or TARGET_URL environment variables")
        sys.exit(1)

    print(f"Starting UI Agent via Fargate Script for requestId: {request_id}, targetUrl: {target_url}")
    vnc_url = os.getenv("VNC_URL")
    if vnc_url:
        report_step(request_id, 0, target_url, "STARTING_VNC", reason="브라우저 컨테이너가 시작되어 VNC 스트림을 준비합니다.", vnc_url=vnc_url)
    api_key = os.getenv("GEMINI_API_KEY")
    has_api_key = True
    if not api_key:
        has_api_key = False
        
    client = None
    if has_api_key:
        import httpx
        custom_client = httpx.Client(verify=False)
        client = genai.Client(api_key=api_key, http_options={'httpx_client': custom_client})
        
    steps_history = []
    if vnc_url:
        steps_history.append({"step": 0, "url": target_url, "action": "STARTING_VNC", "reason": "브라우저 컨테이너가 시작되어 VNC 스트림을 준비합니다.", "vncUrl": vnc_url})
    failed_selectors = []
    is_simulated_mode = not has_api_key
    api_error = None
    
    start_time = time.time()
    performance_times = []
    defects = []
    unique_defects = set()

    def add_defect(category, selector, severity, description, timestamp_offset):
        key = (category, selector, description)
        if key not in unique_defects:
            unique_defects.add(key)
            defects.append(UIUXTestDefect(
                category=category,
                selector=selector[:100] if selector else "N/A",
                severity=severity,
                description=description,
                timestamp_offset=timestamp_offset
            ))
    
    with sync_playwright() as p:
        try:
            headless_mode = os.getenv("PLAYWRIGHT_HEADLESS", "false").lower() == "true"
            browser = p.chromium.launch(headless=headless_mode)
            video_dir = os.path.join(os.path.dirname(__file__), "videos")
            os.makedirs(video_dir, exist_ok=True)
            
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                record_video_dir=video_dir,
                record_video_size={"width": 800, "height": 500},
                ignore_https_errors=True
            )
            page = context.new_page()
            
            nav_start = time.time()
            try:
                page.goto(target_url, timeout=20000, wait_until="load")
                page.wait_for_timeout(2000)
                performance_times.append(time.time() - nav_start)
            except Exception as e:
                err = f"URL 로드 실패 {target_url}: {str(e)}"
                report_step(request_id, 1, target_url, "OPEN_URL", error=err, reason="테스트 시작 실패")
                report_failure(request_id, f"URL 로드 실패: {str(e)}")
                browser.close()
                sys.exit(1)

            report_step(request_id, 1, page.url, "OPEN_URL", reason="대상의 초기 페이지를 성공적으로 로드하였습니다.")
            steps_history.append({"step": 1, "url": page.url, "action": "OPEN_URL", "reason": "대상의 초기 페이지를 성공적으로 로드하였습니다."})
            
            accessibility_score = calculate_accessibility_score(page, add_defect, start_time)
            
            for step_idx in range(2, 7):
                page.wait_for_timeout(1000)
                current_url = page.url
                
                try:
                    screenshot_bytes = page.screenshot(type="png")
                except Exception as e:
                    report_step(request_id, step_idx, current_url, "CAPTURE", error=str(e), reason="화면 스크린샷 캡처 중 오류 발생")
                    break

                action_data = None
                if not is_simulated_mode and client:
                    prompt_text = f"You are an AI UI test explorer. Currently on page: {current_url}. Choose the next action: CLICK, TYPE, or FINISH. All 'reason' fields MUST be written in Korean."
                    if failed_selectors:
                        prompt_text += f" CRITICAL: Do NOT attempt to click or type into the following selectors because they failed previously: {failed_selectors}."
                    
                    try:
                        response = client.models.generate_content(
                            model='gemini-3.5-flash',
                            contents=[types.Part.from_bytes(data=screenshot_bytes, mime_type='image/png'), prompt_text],
                            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=AgentAction, temperature=0.0)
                        )
                        action_data = json.loads(response.text)
                    except Exception as e:
                        api_error = str(e)
                        print(f"Gemini API Error: {api_error}")
                        is_simulated_mode = True

                if is_simulated_mode or action_data is None:
                    if step_idx == 2:
                        action_data = {"action": "CLICK", "selector": "a", "reason": "안전 모드: 기본 링크 클릭"}
                    else:
                        action_data = {"action": "FINISH", "reason": "안전 모드: 탐색 종료"}
                
                action = action_data.get("action", "FINISH")
                selector = action_data.get("selector")
                text = action_data.get("text")
                reason = action_data.get("reason", "이유 없음")
                
                current_offset = int(time.time() - start_time)
                
                if action == "FINISH":
                    report_step(request_id, step_idx, current_url, "FINISH", reason=reason)
                    steps_history.append({"step": step_idx, "action": "FINISH"})
                    break
                
                elif action == "CLICK":
                    if not selector:
                        continue
                    try:
                        nav_start = time.time()
                        page.wait_for_selector(selector, timeout=3000)
                        page.click(selector)
                        performance_times.append(time.time() - nav_start)
                        report_step(request_id, step_idx, current_url, "CLICK", selector=selector, reason=reason)
                        steps_history.append({"step": step_idx, "action": "CLICK", "selector": selector})
                    except Exception as e:
                        if not is_simulated_mode:
                            failed_selectors.append(selector)
                            add_defect(category="EFFICIENCY", selector=selector, severity="MINOR", description=f"해당 요소를 클릭할 수 없습니다: 다른 요소에 가려져 있거나 비활성화 상태일 수 있습니다.", timestamp_offset=current_offset)
                        report_step(request_id, step_idx, current_url, "CLICK", selector=selector, error=str(e), reason=reason)
                
                elif action == "TYPE":
                    if not selector or not text:
                        continue
                    try:
                        nav_start = time.time()
                        page.wait_for_selector(selector, timeout=3000)
                        page.fill(selector, text)
                        page.press(selector, "Enter")
                        performance_times.append(time.time() - nav_start)
                        report_step(request_id, step_idx, current_url, "TYPE", selector=selector, text=text, reason=reason)
                        steps_history.append({"step": step_idx, "action": "TYPE", "selector": selector})
                    except Exception as e:
                        if not is_simulated_mode:
                            failed_selectors.append(selector)
                            add_defect(category="EFFICIENCY", selector=selector, severity="MINOR", description=f"해당 요소에 텍스트를 입력할 수 없습니다: 입력창이 아니거나 비활성화 상태일 수 있습니다.", timestamp_offset=current_offset)
                        report_step(request_id, step_idx, current_url, "TYPE", selector=selector, text=text, error=str(e), reason=reason)
            
            # Scores calculation
            efficiency_score = max(0, 100 - (len(failed_selectors) * 10))
            avg_perf = sum(performance_times) / max(1, len(performance_times))
            perf_score = max(0, 100 - int(avg_perf * 10))
            
            class UsabilityChecklist(BaseModel):
                score: int = Field(description="Score between 0 and 100 based on the 10 Nielsen heuristics.")
                failed_heuristics: List[str] = Field(description="List of failed heuristics explanations.")

            final_evaluation_md = "* 닐슨 휴리스틱 평가가 비활성화되었습니다."
            usability_score = 80
            if not is_simulated_mode and client:
                try:
                    report_prompt = f"Analyze the following autonomous exploration session on: {target_url}\nSteps: {json.dumps(steps_history)}\nEvaluate the Nielsen 10 Heuristics as a binary checklist. Return the score and failed heuristics.\nStrictly output in Korean. For any failed heuristic, describe exactly what screen/element failed and provide a concrete UX/UI improvement alternative instead of just naming the heuristic."
                    report_resp = client.models.generate_content(
                        model='gemini-3.5-flash',
                        contents=report_prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=UsabilityChecklist, temperature=0.0)
                    )
                    usability_data = json.loads(report_resp.text)
                    usability_score = usability_data.get("score", 80)
                    for failed in usability_data.get("failed_heuristics", []):
                        add_defect(category="USABILITY", selector="N/A", severity="MAJOR", description=failed, timestamp_offset=current_offset)
                    
                    final_evaluation_md = f"### 닐슨 10대 휴리스틱 평가 보고서\n\n- 종합 사용성 점수: **{usability_score}점**\n\n### 주요 감지 결함\n"
                    if not usability_data.get("failed_heuristics", []):
                        final_evaluation_md += "- 특이사항 없음\n"
                    for failed in usability_data.get("failed_heuristics", []):
                        final_evaluation_md += f"- {failed}\n"
                except Exception as e:
                    print(f"Failed to generate usability report: {e}")
                    final_evaluation_md = f"* 평가 생성 중 오류가 발생했습니다: {e}"
            
            # 사용자 경험을 위해 컨테이너가 즉시 종료되지 않고 30초간 최종 화면을 유지하도록 대기
            print("Test finished. Keeping VNC alive for 30 seconds...")
            time.sleep(30)

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
            
            final_report = {
                "requestId": request_id,
                "scores": {
                    "usability": usability_score,
                    "accessibility": accessibility_score,
                    "efficiency": efficiency_score,
                    "performance": perf_score
                },
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
                    "timestampOffset": d.timestamp_offset
                } for d in defects]
            }
            
            report_report(request_id, final_report)
            
        except Exception as outer_e:
            err = f"Playwright execution crash: {str(outer_e)}"
            report_failure(request_id, err)
            sys.exit(1)

if __name__ == "__main__":
    main()
