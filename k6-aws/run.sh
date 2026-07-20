#!/bin/sh
set -eu

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${TEST_ID:?TEST_ID is required}"

SCRIPT_LOCAL_PATH="/tmp/script.js"
SUMMARY_LOCAL_PATH="/tmp/summary.json"
METRICS_LOCAL_PATH="/tmp/metrics.json.gz"
EXECUTION_LOCAL_PATH="/tmp/execution.json"

SCRIPT_S3_PATH="s3://${S3_BUCKET}/tasks/${TEST_ID}/script.js"
SUMMARY_S3_PATH="s3://${S3_BUCKET}/tasks/${TEST_ID}/summary.json"
METRICS_S3_PATH="s3://${S3_BUCKET}/tasks/${TEST_ID}/metrics.json.gz"
EXECUTION_S3_PATH="s3://${S3_BUCKET}/tasks/${TEST_ID}/execution.json"

echo "1. Downloading k6 script from S3... ($SCRIPT_S3_PATH)"
aws s3 cp "$SCRIPT_S3_PATH" "$SCRIPT_LOCAL_PATH"

echo "2. Running k6 load test with granular metric output..."
# 임계값 실패처럼 k6가 0이 아닌 종료 코드를 반환하더라도 생성된 측정 결과는 보존합니다.
set +e
k6 run \
    --summary-export="$SUMMARY_LOCAL_PATH" \
    --out "json=$METRICS_LOCAL_PATH" \
    "$SCRIPT_LOCAL_PATH"
K6_EXIT_CODE=$?
set -e
printf '{"exitCode":%s}\n' "$K6_EXIT_CODE" > "$EXECUTION_LOCAL_PATH"

if [ ! -s "$SUMMARY_LOCAL_PATH" ]; then
    echo "k6 did not produce a summary file (exit code: $K6_EXIT_CODE)." >&2
    exit 1
fi

echo "3. Uploading end-of-test summary to S3... ($SUMMARY_S3_PATH)"
aws s3 cp \
    "$SUMMARY_LOCAL_PATH" \
    "$SUMMARY_S3_PATH" \
    --content-type "application/json"

echo "4. Uploading execution metadata to S3... ($EXECUTION_S3_PATH)"
aws s3 cp \
    "$EXECUTION_LOCAL_PATH" \
    "$EXECUTION_S3_PATH" \
    --content-type "application/json"

if [ -s "$METRICS_LOCAL_PATH" ]; then
    echo "5. Uploading measured time-series data to S3... ($METRICS_S3_PATH)"
    aws s3 cp \
        "$METRICS_LOCAL_PATH" \
        "$METRICS_S3_PATH" \
        --content-type "application/x-ndjson" \
        --content-encoding "gzip"
else
    echo "k6 did not produce granular metric output; summary remains available." >&2
fi

echo "6. All result uploads completed (k6 exit code: $K6_EXIT_CODE)."
