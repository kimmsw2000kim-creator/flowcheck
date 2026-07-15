import os
import sys
import json
import httpx
import time
import base64
import subprocess
import tempfile
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

# .env 로드
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://host.docker.internal:8080")

class UIUXTestScores(BaseModel):
    usability: int
    accessibility: int
    efficiency: int
    performance: int
    bestPractices: int
    overall: int

class UIUXTestDefect(BaseModel):
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
    request_id: str
    scores: UIUXTestScores
    device_info: Dict[str, Any]
    video_url: Optional[str] = None
    defects: List[UIUXTestDefect]

def capture_live_frame(page) -> Optional[str]:
    try:
        screenshot = page.screenshot(type="jpeg", quality=45, full_page=False)
        encoded = base64.b64encode(screenshot).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception as e:
        print(f"Failed to capture live frame: {e}")
        return None


def report_step(request_id: str, step: int, url: str, action: str, selector: str = None, text: str = None, reason: str = None, error: str = None, vnc_url: str = None, screenshot_url: str = None):
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
    return {
        "critical": "CRITICAL",
        "serious": "MAJOR",
        "moderate": "MINOR",
        "minor": "MINOR",
    }.get((impact or "").lower(), "MINOR")

def run_lighthouse_audit(target_url: str) -> Dict[str, Any]:
    lighthouse_cli = os.path.join(os.path.dirname(__file__), "node_modules", "lighthouse", "cli", "index.js")
    if not os.path.exists(lighthouse_cli):
        return {"available": False, "error": "Lighthouse package is not installed."}

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        output_path = tmp.name

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

    try:
        subprocess.run(cmd, check=True, timeout=120, capture_output=True, text=True)
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

        return {
            "available": True,
            "scores": scores,
            "findings": findings[:30],
            "lighthouseVersion": result.get("lighthouseVersion"),
            "fetchTime": result.get("fetchTime"),
            "finalUrl": result.get("finalDisplayedUrl") or result.get("finalUrl"),
        }
    except Exception as e:
        return {"available": False, "error": str(e)}
    finally:
        try:
            os.remove(output_path)
        except Exception:
            pass

def run_axe_audit(page) -> Dict[str, Any]:
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
        total_deduction = 0
        impact_weights = {"critical": 15, "serious": 10, "moderate": 5, "minor": 2}
        for violation in violations:
            impact = violation.get("impact") or "minor"
            nodes = violation.get("nodes") or []
            total_deduction += impact_weights.get(impact, 2) * max(1, len(nodes))
        score = clamp_score(100 - min(100, total_deduction))
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
    return max(0, min(100, int(value)))

def build_selector(el_info: dict) -> str:
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
                            description: `터치 대상 크기가 ${Math.round(rect.width)}x${Math.round(rect.height)}px로 권장 기준보다 작습니다.`,
                            recommendation: '클릭 가능한 요소의 최소 크기를 44x44px 이상으로 조정하고 주변 여백을 확보하세요.',
                            evidence: { width: Math.round(rect.width), height: Math.round(rect.height), expected: '>=44x44' },
                            severity: 'MAJOR',
                            deduction: 5,
                        });
                    }
                    if (!textOf(el)) {
                        results.push({
                            ruleId: 'accessible-name',
                            selector: selectorFor(el),
                            description: '인터랙티브 요소에 사용자가 이해할 수 있는 이름이 없습니다.',
                            recommendation: '버튼/링크에 명확한 텍스트를 넣거나 aria-label을 제공하세요.',
                            evidence: { text: textOf(el) },
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
                            description: '이미지에 alt 속성이 없습니다.',
                            recommendation: '의미 있는 이미지에는 대체 텍스트를 제공하고, 장식 이미지는 alt=""로 표시하세요.',
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
                description=issue.get("description", "접근성 문제가 감지되었습니다."),
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
        add_defect_fn(
            category=category,
            selector="document",
            severity="MINOR" if category != "ACCESSIBILITY" else "MAJOR",
            description=finding.get("title") or "Lighthouse audit failed.",
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
            recommendation=finding.get("description")
        )
    return deductions

def add_axe_findings(axe_result, add_defect_fn, start_time):
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
        add_defect_fn(
            category="ACCESSIBILITY",
            selector=selector,
            severity=severity_from_impact(impact),
            description=violation.get("help") or violation.get("description") or "axe-core accessibility violation.",
            timestamp_offset=current_offset,
            source="AXE",
            rule_id=violation.get("id"),
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
            recommendation=violation.get("help") or violation.get("description")
        )
    return deductions

def evaluate_best_practices(page, target_url, console_errors, page_errors, add_defect_fn, start_time):
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
            f"브라우저 콘솔 오류가 {len(console_errors)}건 감지되었습니다.",
            "콘솔 오류를 확인해 프론트 예외, 리소스 로드 실패, 잘못된 API 호출을 수정하세요.",
            min(20, len(console_errors) * 5),
            {"errors": console_errors[:5]},
            "MAJOR"
        )

    if page_errors:
        add_issue(
            "runtime-errors",
            f"페이지 런타임 오류가 {len(page_errors)}건 감지되었습니다.",
            "브라우저 pageerror 로그를 기준으로 예외 발생 지점을 수정하세요.",
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
                const generic = new Set(['click', 'click here', 'more', 'submit', 'button', '확인', '클릭', '자세히']);
                const results = [];
                document.querySelectorAll('button, a').forEach((el) => {
                    if (!visible(el)) return;
                    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
                    if (generic.has(text)) {
                        results.push({
                            ruleId: 'generic-action-label',
                            selector: selectorFor(el),
                            description: '버튼 또는 링크 문구가 행동 목적을 충분히 설명하지 않습니다.',
                            recommendation: '사용자가 다음 행동을 예측할 수 있도록 구체적인 CTA 문구를 사용하세요.',
                            deduction: 6,
                            evidence: { text },
                        });
                    }
                });
                const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible);
                if (passwordInputs.length > 0) {
                    const hasHelpText = Array.from(document.querySelectorAll('p, small, span, div')).some((el) => {
                        const text = (el.innerText || '').trim();
                        return /비밀번호|password/.test(text) && /8|특수|영문|숫자|조건|규칙/.test(text);
                    });
                    if (!hasHelpText) {
                        results.push({
                            ruleId: 'password-requirements-help',
                            selector: selectorFor(passwordInputs[0]),
                            description: '비밀번호 입력 조건을 사전에 안내하는 문구가 부족합니다.',
                            recommendation: '입력 전 비밀번호 길이, 문자 조합 등 요구 조건을 가까운 위치에 표시하세요.',
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
    top_defects = sorted_defects[:5]

    if scores["overall"] >= 85:
        summary = "핵심 흐름은 안정적입니다. 일부 세부 품질 항목만 보완하면 더 완성도 높은 경험을 만들 수 있습니다."
    elif scores["overall"] >= 70:
        summary = "서비스 사용은 가능하지만 사용성, 접근성, 탐색 흐름에서 개선 여지가 확인되었습니다."
    else:
        summary = "사용자가 핵심 행동을 완료하는 과정에서 마찰이 큽니다. 주요 결함부터 우선 개선하는 것이 좋습니다."

    lines = [
        "### 종합 진단",
        f"- 종합 점수는 {scores['overall']}점입니다.",
        f"- {summary}",
        "",
        "### 세부 점수",
        f"- 사용성 {scores['usability']}점",
        f"- 접근성 {scores['accessibility']}점",
        f"- 탐색 효율 {scores['efficiency']}점",
        f"- 성능 {scores['performance']}점",
        f"- 기술 품질 {scores['bestPractices']}점",
        "",
        "### 주요 개선 항목",
    ]

    if not top_defects:
        lines.append("- 이번 테스트에서 우선 조치가 필요한 주요 결함은 감지되지 않았습니다.")
    else:
        for defect in top_defects:
            label = category_labels.get(defect.category, "품질")
            description = (defect.description or "").strip().rstrip(".")
            recommendation = (defect.recommendation or "").strip().rstrip(".")
            if recommendation:
                lines.append(f"- {label}: {description}. 개선안: {recommendation}.")
            else:
                lines.append(f"- {label}: {description}.")

    lines.extend([
        "",
        "### 평가 기준",
        "- Lighthouse 성능/기술 품질, axe-core 접근성, Playwright 기반 사용성 규칙을 함께 반영했습니다.",
        "- 점수는 고정 규칙과 공식 엔진 결과로 산정하며, 보고서 문장은 결과를 이해하기 쉽게 정리하는 용도로만 사용합니다.",
    ])
    return "\n".join(lines)

def deterministic_primary_action(page, add_defect_fn, start_time):
    action = page.evaluate("""
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
                const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
                if (testId) return `${tag}[data-testid="${cssEscape(testId)}"], ${tag}[data-test="${cssEscape(testId)}"]`;
                if (typeof el.className === 'string' && el.className.trim()) return `${tag}.${cssEscape(el.className.trim().split(/\\s+/)[0])}`;
                const all = Array.from(document.querySelectorAll(tag));
                const index = all.indexOf(el) + 1;
                return `${tag}:nth-of-type(${Math.max(index, 1)})`;
            };
            const priority = [
                /시작|테스트|분석|무료|체험|로그인|회원가입|구매|결제|검색|문의|start|test|analy[sz]e|login|sign\\s?up|buy|search|contact/i,
                /더보기|자세히|계속|next|more|continue/i,
            ];
            const candidates = Array.from(document.querySelectorAll('button, a[href], [role="button"], input[type="button"], input[type="submit"]'))
                .filter(visible)
                .map((el) => {
                    const text = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
                    const rect = el.getBoundingClientRect();
                    let score = 0;
                    if (priority[0].test(text)) score += 100;
                    if (priority[1].test(text)) score += 40;
                    if (rect.top >= 0 && rect.top < window.innerHeight * 0.8) score += 20;
                    if (rect.width >= 44 && rect.height >= 44) score += 10;
                    return { selector: selectorFor(el), text, score, href: el.href || null };
                })
                .sort((a, b) => b.score - a.score || a.selector.localeCompare(b.selector));
            return candidates[0] || null;
        }
    """)
    if not action:
        return {"ok": False, "reason": "클릭 가능한 주요 액션을 찾지 못했습니다."}

    selector = action.get("selector")
    current_offset = int(time.time() - start_time)
    try:
        before_url = page.url
        nav_start = time.time()
        page.locator(selector).first.click(timeout=3000)
        page.wait_for_timeout(700)
        elapsed = time.time() - nav_start
        return {
            "ok": True,
            "selector": selector,
            "text": action.get("text"),
            "beforeUrl": before_url,
            "afterUrl": page.url,
            "elapsed": elapsed,
        }
    except Exception as e:
        add_defect_fn(
            category="EFFICIENCY",
            selector=selector,
            severity="MINOR",
            description="주요 액션 요소 클릭에 실패했습니다.",
            timestamp_offset=current_offset,
            source="PLAYWRIGHT",
            rule_id="primary-action-click-failed",
            evidence={"selector": selector, "text": action.get("text"), "error": str(e)},
            recommendation="주요 CTA가 클릭 가능한 상태인지, 오버레이가 가리지 않는지, 클릭 영역이 충분한지 확인하세요."
        )
        return {"ok": False, "selector": selector, "text": action.get("text"), "error": str(e)}

def deterministic_form_feedback_check(page, add_defect_fn, start_time):
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
                if (typeof el.className === 'string' && el.className.trim()) return `${tag}.${cssEscape(el.className.trim().split(/\\s+/)[0])}`;
                const all = Array.from(document.querySelectorAll(tag));
                return `${tag}:nth-of-type(${Math.max(all.indexOf(el) + 1, 1)})`;
            };
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'))
                .filter(visible)
                .filter((el) => !el.disabled && !el.readOnly);
            if (!inputs.length) return null;
            const input = inputs.find((el) => /email/i.test(el.type || el.name || el.placeholder || '')) || inputs[0];
            const form = input.closest('form');
            const submit = form
                ? Array.from(form.querySelectorAll('button, input[type="submit"]')).filter(visible)[0]
                : Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(visible)[0];
            return {
                inputSelector: selectorFor(input),
                inputType: input.getAttribute('type') || input.tagName.toLowerCase(),
                submitSelector: submit ? selectorFor(submit) : null,
                beforeText: document.body.innerText.slice(0, 5000),
            };
        }
    """)
    if not form_info:
        return {"ok": True, "reason": "검사할 입력 필드가 없습니다."}

    current_offset = int(time.time() - start_time)
    invalid_value = "invalid-email" if "email" in (form_info.get("inputType") or "").lower() else "x"
    try:
        page.locator(form_info["inputSelector"]).first.fill(invalid_value, timeout=3000)
        if form_info.get("submitSelector"):
            page.locator(form_info["submitSelector"]).first.click(timeout=3000)
        else:
            page.locator(form_info["inputSelector"]).first.press("Enter", timeout=3000)
        page.wait_for_timeout(600)
        feedback = page.evaluate("""
            (beforeText) => {
                const text = document.body.innerText.slice(0, 7000);
                const added = text.replace(beforeText, '').trim();
                const hasValidation = /필수|오류|잘못|형식|입력|확인|required|invalid|error|check|format/i.test(text);
                return { hasValidation, addedText: added.slice(0, 500) };
            }
        """, form_info.get("beforeText", ""))
        if not feedback.get("hasValidation"):
            add_defect_fn(
                category="USABILITY",
                selector=form_info["inputSelector"],
                severity="MINOR",
                description="잘못된 입력 후 명확한 오류 안내가 감지되지 않았습니다.",
                timestamp_offset=current_offset,
                source="UX_RULE",
                rule_id="form-validation-feedback",
                evidence={"inputSelector": form_info["inputSelector"], "submittedValue": invalid_value},
                recommendation="입력값이 잘못되었을 때 필드 근처에 구체적인 오류 메시지와 수정 방법을 표시하세요."
            )
        return {"ok": True, "inputSelector": form_info["inputSelector"], "feedbackDetected": bool(feedback.get("hasValidation"))}
    except Exception as e:
        add_defect_fn(
            category="EFFICIENCY",
            selector=form_info["inputSelector"],
            severity="MINOR",
            description="폼 피드백 검사 중 입력 또는 제출에 실패했습니다.",
            timestamp_offset=current_offset,
            source="PLAYWRIGHT",
            rule_id="form-feedback-check-failed",
            evidence={"inputSelector": form_info["inputSelector"], "error": str(e)},
            recommendation="폼 요소가 테스트 시점에 입력 가능한 상태인지, 제출 버튼이 정상적으로 활성화되는지 확인하세요."
        )
        return {"ok": False, "inputSelector": form_info["inputSelector"], "error": str(e)}

def deterministic_navigation_check(page, add_defect_fn, start_time):
    nav_info = page.evaluate("""
        () => {
            const visible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const links = Array.from(document.querySelectorAll('nav a[href], header a[href], a[href]'))
                .filter(visible)
                .filter((a) => {
                    const href = a.getAttribute('href') || '';
                    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
                    try {
                        const url = new URL(href, location.href);
                        return url.origin === location.origin && url.href !== location.href;
                    } catch {
                        return false;
                    }
                })
                .map((a, index) => ({
                    selector: a.id ? `a#${CSS.escape(a.id)}` : `a[href="${CSS.escape(a.getAttribute('href'))}"]`,
                    href: a.href,
                    text: (a.innerText || a.textContent || '').trim(),
                    index,
                }))
                .sort((a, b) => a.index - b.index);
            return links[0] || null;
        }
    """)
    if not nav_info:
        return {"ok": True, "reason": "검사할 내부 내비게이션 링크가 없습니다."}

    current_offset = int(time.time() - start_time)
    try:
        before_url = page.url
        nav_start = time.time()
        page.locator(nav_info["selector"]).first.click(timeout=3000)
        page.wait_for_load_state("domcontentloaded", timeout=7000)
        elapsed = time.time() - nav_start
        after_url = page.url
        if after_url == before_url:
            add_defect_fn(
                category="EFFICIENCY",
                selector=nav_info["selector"],
                severity="MINOR",
                description="내부 내비게이션 링크 클릭 후 URL 변화가 감지되지 않았습니다.",
                timestamp_offset=current_offset,
                source="PLAYWRIGHT",
                rule_id="navigation-no-url-change",
                evidence={"selector": nav_info["selector"], "href": nav_info["href"], "text": nav_info["text"]},
                recommendation="링크 라우팅 처리와 클릭 이벤트가 정상적으로 동작하는지 확인하세요."
            )
        try:
            page.go_back(timeout=5000, wait_until="domcontentloaded")
        except Exception:
            pass
        return {"ok": True, "selector": nav_info["selector"], "beforeUrl": before_url, "afterUrl": after_url, "elapsed": elapsed}
    except Exception as e:
        add_defect_fn(
            category="EFFICIENCY",
            selector=nav_info["selector"],
            severity="MINOR",
            description="내부 내비게이션 링크 이동에 실패했습니다.",
            timestamp_offset=current_offset,
            source="PLAYWRIGHT",
            rule_id="navigation-click-failed",
            evidence={"selector": nav_info["selector"], "href": nav_info["href"], "error": str(e)},
            recommendation="내비게이션 링크가 실제 이동 가능한 href를 갖고 있는지, 클릭 이벤트가 예외 없이 처리되는지 확인하세요."
        )
        return {"ok": False, "selector": nav_info["selector"], "error": str(e)}

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
        key = (category, selector, description, rule_id)
        if key not in unique_defects:
            unique_defects.add(key)
            defects.append(UIUXTestDefect(
                category=category,
                selector=selector[:100] if selector else "N/A",
                severity=severity,
                description=description,
                timestamp_offset=timestamp_offset,
                source=source,
                rule_id=rule_id,
                evidence=evidence,
                recommendation=recommendation,
                screenshot_url=screenshot_url
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
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            
            nav_start = time.time()
            lighthouse_result = {"available": False, "error": "not-run"}
            axe_result = {"available": False, "error": "not-run"}
            accessibility_score = 80
            accessibility_deductions = []
            try:
                page.goto(target_url, timeout=20000, wait_until="load")
                page.wait_for_timeout(2000)
                performance_times.append(time.time() - nav_start)
            except Exception as e:
                err = f"URL 로드 실패 {target_url}: {str(e)}"
                report_step(request_id, 1, target_url, "LOAD_PAGE", error=err, reason="초기 페이지 로드에 실패했습니다.")
                report_failure(request_id, f"URL 로드 실패: {str(e)}")
                browser.close()
                sys.exit(1)

            report_step(request_id, 1, page.url, "LOAD_PAGE", reason="대상 페이지를 로드하고 기준 화면을 확보했습니다.", screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 1, "url": page.url, "action": "LOAD_PAGE", "reason": "대상 페이지를 로드하고 기준 화면을 확보했습니다."})

            report_step(request_id, 2, page.url, "RUN_LIGHTHOUSE", reason="Lighthouse로 성능, 접근성, 기술 품질 점수를 측정합니다.", screenshot_url=capture_live_frame(page))
            lighthouse_result = run_lighthouse_audit(target_url)
            steps_history.append({
                "step": 2,
                "url": page.url,
                "action": "RUN_LIGHTHOUSE",
                "reason": "Lighthouse 공식 audit 결과를 수집했습니다." if lighthouse_result.get("available") else "Lighthouse 실행에 실패하여 대체 규칙을 사용합니다.",
                "available": lighthouse_result.get("available", False),
                "error": lighthouse_result.get("error")
            })

            report_step(request_id, 3, page.url, "RUN_AXE", reason="axe-core로 WCAG 기반 접근성 위반을 검사합니다.", screenshot_url=capture_live_frame(page))
            axe_result = run_axe_audit(page)
            steps_history.append({
                "step": 3,
                "url": page.url,
                "action": "RUN_AXE",
                "reason": "axe-core 접근성 검사 결과를 수집했습니다." if axe_result.get("available") else "axe-core 실행에 실패하여 대체 규칙을 사용합니다.",
                "available": axe_result.get("available", False),
                "error": axe_result.get("error")
            })

            report_step(request_id, 4, page.url, "CHECK_DOM_RULES", reason="DOM 기반 접근성 및 기본 사용성 규칙을 검사합니다.", screenshot_url=capture_live_frame(page))
            accessibility_score, accessibility_deductions = evaluate_accessibility_rules(page, add_defect, start_time)
            steps_history.append({"step": 4, "url": page.url, "action": "CHECK_DOM_RULES", "reason": "터치 대상 크기, 라벨, 이미지 대체 텍스트 등 DOM 규칙을 검사했습니다."})

            report_step(request_id, 5, page.url, "EXPLORE_PRIMARY_ACTION", reason="우선순위가 높은 주요 CTA 또는 인터랙션을 결정론적으로 선택해 검사합니다.", screenshot_url=capture_live_frame(page))
            primary_result = deterministic_primary_action(page, add_defect, start_time)
            if primary_result.get("elapsed") is not None:
                performance_times.append(primary_result["elapsed"])
            if not primary_result.get("ok") and primary_result.get("selector"):
                failed_selectors.append(primary_result["selector"])
            steps_history.append({"step": 5, "url": page.url, "action": "EXPLORE_PRIMARY_ACTION", "reason": "주요 액션 요소의 클릭 가능 여부를 검사했습니다.", **primary_result})

            report_step(request_id, 6, page.url, "CHECK_FORM_FEEDBACK", reason="입력 필드의 오류 피드백과 검증 안내를 검사합니다.", screenshot_url=capture_live_frame(page))
            form_result = deterministic_form_feedback_check(page, add_defect, start_time)
            if not form_result.get("ok") and form_result.get("inputSelector"):
                failed_selectors.append(form_result["inputSelector"])
            steps_history.append({"step": 6, "url": page.url, "action": "CHECK_FORM_FEEDBACK", "reason": "폼 입력과 오류 피드백 표시 여부를 검사했습니다.", **form_result})

            report_step(request_id, 7, page.url, "CHECK_NAVIGATION", reason="내부 내비게이션 링크의 이동 가능 여부를 검사합니다.", screenshot_url=capture_live_frame(page))
            navigation_result = deterministic_navigation_check(page, add_defect, start_time)
            if navigation_result.get("elapsed") is not None:
                performance_times.append(navigation_result["elapsed"])
            if not navigation_result.get("ok") and navigation_result.get("selector"):
                failed_selectors.append(navigation_result["selector"])
            steps_history.append({"step": 7, "url": page.url, "action": "CHECK_NAVIGATION", "reason": "내부 링크 이동과 복귀 흐름을 검사했습니다.", **navigation_result})
            report_step(request_id, 8, page.url, "CALCULATE_SCORE", reason="수집한 audit과 탐색 결과로 최종 점수를 산정합니다.", screenshot_url=capture_live_frame(page))
            steps_history.append({"step": 8, "url": page.url, "action": "CALCULATE_SCORE", "reason": "수집한 audit과 탐색 결과로 최종 점수를 산정합니다."})

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
                    "performance": "LIGHTHOUSE_PERFORMANCE",
                    "bestPractices": "LIGHTHOUSE_BEST_PRACTICES"
                },
                "engineResults": {
                    "lighthouse": {
                        "available": lighthouse_result.get("available", False),
                        "error": lighthouse_result.get("error"),
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
            
            # 사용자가 최종 화면을 확인할 수 있도록 컨테이너를 잠시 유지합니다.
            keepalive_seconds = int(os.getenv("VNC_KEEPALIVE_SECONDS", "180"))
            print(f"Test finished. Keeping VNC alive for {keepalive_seconds} seconds...")
            time.sleep(keepalive_seconds)

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

            report_step(request_id, 9, final_page_url, "SAVE_REPORT", reason="점수, 결함, 영상 URL을 포함한 최종 보고서를 저장합니다.")
            steps_history.append({"step": 9, "url": final_page_url, "action": "SAVE_REPORT", "reason": "점수, 결함, 영상 URL을 포함한 최종 보고서를 저장합니다."})
            
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
