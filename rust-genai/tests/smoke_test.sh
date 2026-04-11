#!/bin/bash
# Smoke tests for rust-genai
# Usage: ./tests/smoke_test.sh [PORT]

PORT=${1:-8083}
BASE="http://localhost:$PORT"
PASSED=0
FAILED=0

assert() {
    local name="$1"
    local condition="$2"
    if eval "$condition"; then
        echo "  PASS: $name"
        ((PASSED++))
    else
        echo "  FAIL: $name"
        ((FAILED++))
    fi
}

echo "Testing rust-genai on port $PORT"

# Health endpoint
echo -e "\nTest: Health endpoint"
HEALTH=$(curl -s "$BASE/health")
assert "returns valid JSON" "echo '$HEALTH' | jq -e . > /dev/null 2>&1"
assert "has status healthy" "echo '$HEALTH' | jq -e '.status == \"healthy\"' > /dev/null 2>&1"

# Main page
echo -e "\nTest: Main page"
MAIN=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")
assert "returns 200" "[ '$MAIN' = '200' ]"

# Static files
echo -e "\nTest: Static files"
FAV=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/static/favicon.ico")
assert "favicon returns 200" "[ '$FAV' = '200' ]"

ROB=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/static/robots.txt")
assert "robots.txt returns 200" "[ '$ROB' = '200' ]"

# Security headers
echo -e "\nTest: Security headers"
HEADERS=$(curl -sI "$BASE/health")
assert "has X-Content-Type-Options" "echo '$HEADERS' | grep -qi 'x-content-type-options: nosniff'"
assert "has X-Frame-Options" "echo '$HEADERS' | grep -qi 'x-frame-options: sameorigin'"
assert "has X-XSS-Protection" "echo '$HEADERS' | grep -qi 'x-xss-protection'"

# Model info
echo -e "\nTest: Model info"
MODEL=$(curl -s -X POST "$BASE/api/chat" -H 'Content-Type: application/json' -d '{"message":"!modelinfo"}')
assert "returns model field" "echo '$MODEL' | jq -e '.model' > /dev/null 2>&1"

echo -e "\n--- Results: $PASSED passed, $FAILED failed ---"
[ "$FAILED" -eq 0 ] || exit 1
