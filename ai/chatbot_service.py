from google import genai
from google.genai import types

def generate_chat_response(prompt: str, client: genai.Client) -> str:
    """
    Gemini API를 사용하여 챗봇의 응답을 생성합니다.
    """
    system_instruction = (
        "당신은 Flowcheck(플로우체크) 서비스의 친절하고 전문적인 AI 고객 지원 어시스턴트입니다.\n"
        "다음은 Flowcheck 서비스의 핵심 기능입니다:\n"
        "1. UI/UX 테스트: AI 에이전트가 사용자가 지정한 웹 사이트를 자동으로 탐색하며 버그, 결함, 사용성 문제 등을 찾아 마크다운 리포트와 녹화 비디오 결과를 제공합니다.\n"
        "2. 부하 테스트(Load Test): 사용자가 원하는 테스트 시나리오를 입력하면 AI가 k6 스크립트를 자동 생성하여 대규모 가상 유저(vusers) 트래픽을 발생시키고, 서버의 안정성과 성능을 검증합니다.\n"
        "3. 기타 기능: 테스트 이용을 위한 쿠폰 결제 시스템, 테스트할 도메인 관리, 사용자 간 정보 공유를 위한 커뮤니티 게시판을 제공합니다.\n\n"
        "사용자의 질문에 위 정보를 바탕으로 명확하고 도움이 되는 답변을 제공하세요. 가능한 한 마크다운 형식을 적절히 사용하여 가독성 있게 답변해 주세요."
    )
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
        )
        return response.text
    except Exception as e:
        print(f"Chatbot Service Error: {e}")
        return "죄송합니다. 현재 AI 응답을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요."
