# 측정 결과 포맷이 예고 없이 바뀌지 않도록 검증된 k6 버전을 고정합니다.
ARG K6_VERSION=1.5.0
FROM grafana/k6:${K6_VERSION} AS k6-base

# 2. 공식 AWS CLI 이미지를 뼈대로 사용합니다. (aws-cli 설치 에러 원천 차단)
FROM amazon/aws-cli:latest

# 3. 아까 빌려온 k6 이미지를 AWS 이미지 안으로 복사합니다.
COPY --from=k6-base /usr/bin/k6 /usr/bin/k6

# 4. 방금 만든 run.sh 파일을 컨테이너 안으로 복사
COPY run.sh /run.sh

# 5. 윈도우 줄바꿈 오류 방지 및 실행 권한 부여
RUN sed -i 's/\r$//' /run.sh && chmod +x /run.sh

# 6. 컨테이너가 켜지면 무조건 run.sh 실행
ENTRYPOINT ["/run.sh"]
