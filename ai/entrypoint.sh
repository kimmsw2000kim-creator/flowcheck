#!/bin/bash
set -e

# Playwright가 headful Chromium을 띄울 수 있도록 가상 X 서버를 먼저 실행합니다.
# Fargate/로컬 Docker 컨테이너에는 실제 모니터가 없으므로 Xvfb가 화면 역할을 합니다.
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99

# Xvfb 소켓이 준비되기 전에 Chromium/x11vnc가 붙으면 실패할 수 있어 짧게 대기합니다.
sleep 1

# Xvfb 화면을 VNC 프로토콜로 노출합니다.
# 외부 사용자는 이 포트에 직접 붙지 않고 Spring signed URL 프록시를 통해 접근하므로 컨테이너 내부 VNC에는 비밀번호를 두지 않습니다.
x11vnc -display :99 -forever -shared -nopw &

# noVNC는 브라우저에서 WebSocket으로 VNC를 볼 수 있게 해주는 웹 클라이언트입니다.
# websockify가 6080 포트에서 HTTP asset과 /websockify WebSocket을 제공하고, 실제 VNC 서버(5900)로 중계합니다.
websockify --web /usr/share/novnc 6080 127.0.0.1:5900 &

# Docker CMD 또는 ECS override로 전달된 실제 워커 명령을 실행합니다.
exec "$@"
