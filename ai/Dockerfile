FROM python:3.11-slim

WORKDIR /app

# 파이썬 및 플레이라이트 환경 변수 설정
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# 플레이라이트 브라우저가 저장될 시스템 공용 경로 지정
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY requirements.txt .

# 🔹 [문법 패치] 역슬래시(\)와 && 체인을 올바르게 연결하여 의존성 및 브라우저 강제 설치
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]