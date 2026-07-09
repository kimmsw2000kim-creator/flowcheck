#!/bin/sh
set -e

# 환경 변수로 받은 S3 버킷과 테스트 ID를 사용해 경로를 만듭니다.
SCRIPT_S3_PATH="s3://${S3_BUCKET}/tasks/${TEST_ID}/script.js"
RESULT_S3_PATH="s3://${S3_BUCKET}/tasks/${TEST_ID}/summary.json"

echo "1. Downloading k6 script from S3... ($SCRIPT_S3_PATH)"
aws s3 cp $SCRIPT_S3_PATH /tmp/script.js

echo "2. Running k6 load test..."
# 테스트가 실패해도 결과 파일은 S3에 올라가도록 '|| true'를 붙입니다.
k6 run --summary-export=/tmp/summary.json /tmp/script.js || true

echo "3. Uploading result to S3... ($RESULT_S3_PATH)"
aws s3 cp /tmp/summary.json $RESULT_S3_PATH

echo "4. All done."