#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/server"
pkill -f "node src/index.js" 2>/dev/null
sleep 1
node src/index.js &
SERVER_PID=$!
sleep 3

BASE="http://localhost:3001/api/v1"
PASS=0
FAIL=0

check() {
  local id="$1" desc="$2" expected="$3" actual="$4"
  if echo "$actual" | grep -q "$expected"; then
    echo "PASS [$id] $desc"
    PASS=$((PASS+1))
  else
    echo "FAIL [$id] $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL+1))
  fi
}

echo "=============================="
echo "  Phase 2-4 QA Test Suite"
echo "=============================="

# Setup
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"u@t.com","password":"Test1234","name":"u","role":"USER"}' > /dev/null
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"s@t.com","password":"Test1234","name":"s","role":"SUPERVISOR"}' > /dev/null

UBODY=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"u@t.com","password":"Test1234"}')
UT=$(echo "$UBODY" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
SBODY=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"s@t.com","password":"Test1234"}')
ST=$(echo "$SBODY" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)

IBODY=$(curl -s -X POST $BASE/pairing/invite -H "Authorization: Bearer $ST")
IC=$(echo "$IBODY" | grep -o '"inviteCode":"[^"]*"' | cut -d'"' -f4)
curl -s -X POST $BASE/pairing/join -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d "{\"inviteCode\":\"$IC\"}" > /dev/null

# === Phase 2: Profile / Password ===
# P2-01 Update profile
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/auth/profile -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d '{"name":"Updated Name","monthlyIncome":50000}')
check "P2-01" "Update profile" "200" "$R"

# P2-02 Change password (correct current)
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/auth/password -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d '{"currentPassword":"Test1234","newPassword":"NewPass1234"}')
check "P2-02" "Change password" "200" "$R"

# P2-03 Change password with wrong current
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/auth/password -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d '{"currentPassword":"WrongPass1","newPassword":"NewPass1234"}')
# Note: refresh tokens are invalidated after password change, but the JWT access token still works for 15min
# Actually the change above already invalidated refresh tokens but access token still valid. Let me re-login.
ULOGIN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"u@t.com","password":"NewPass1234"}')
UT=$(echo "$ULOGIN" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/auth/password -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d '{"currentPassword":"WrongPass1","newPassword":"NewPass5678"}')
check "P2-03" "Change password wrong current" "401" "$R"

# P2-04 Change password too short
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/auth/password -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d '{"currentPassword":"NewPass1234","newPassword":"abc"}')
check "P2-04" "Change password too short" "400" "$R"

# === Phase 4: Login Lockout ===
# Trigger 5 failed logins for s@t.com
for i in 1 2 3 4 5; do
  curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"s@t.com","password":"Wrong123!"}' > /dev/null
done

# P4-01 Account locked after 5 failed attempts
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"s@t.com","password":"Test1234"}')
check "P4-01" "Account locked after 5 failures" "429" "$R"

# === Phase 4: Forgot/Reset password ===
# P4-02 Forgot password
R=$(curl -s -X POST $BASE/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"u@t.com"}')
RESET_TOKEN=$(echo "$R" | grep -o '"devToken":"[^"]*"' | cut -d'"' -f4)
if [ ${#RESET_TOKEN} -gt 20 ]; then
  echo "PASS [P4-02] Forgot password (token obtained)"
  PASS=$((PASS+1))
else
  echo "FAIL [P4-02] Forgot password"
  FAIL=$((FAIL+1))
fi

# P4-03 Reset password
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/reset-password -H "Content-Type: application/json" -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"Reset1234\"}")
check "P4-03" "Reset password" "200" "$R"

# P4-04 Login with new password
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"u@t.com","password":"Reset1234"}')
check "P4-04" "Login with reset password" "200" "$R"

# Re-login to get fresh token
UBODY=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"u@t.com","password":"Reset1234"}')
UT=$(echo "$UBODY" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)

# P4-05 Reset with invalid token
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/reset-password -H "Content-Type: application/json" -d '{"token":"invalid_token","newPassword":"Test1234"}')
check "P4-05" "Reset with invalid token" "400" "$R"

# === Phase 3: Reports ===
# Create a transaction first
CATS=$(curl -s $BASE/categories -H "Authorization: Bearer $UT")
EC=$(echo "$CATS" | grep -o '"id":"[^"]*","name":"[^"]*","type":"EXPENSE"' | head -1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X POST $BASE/transactions -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":500,\"categoryId\":\"$EC\"}" > /dev/null

# P3-01 Monthly report (need fresh supervisor token since locked)
sleep 1
# Direct DB unlock by re-creating (since the test is brittle) - skip if locked
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/reports/monthly?year=2026&month=4" -H "Authorization: Bearer $UT")
check "P3-01" "Monthly report" "200" "$R"

# P3-02 Export CSV
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/reports/export?year=2026&month=4&format=csv" -H "Authorization: Bearer $UT")
check "P3-02" "Export CSV" "200" "$R"

# P3-03 Export CSV content (check BOM)
R=$(curl -s "$BASE/reports/export?year=2026&month=4&format=csv" -H "Authorization: Bearer $UT" | head -c 3 | xxd | head -1)
if echo "$R" | grep -q "efbb bf"; then
  echo "PASS [P3-03] CSV has UTF-8 BOM"
  PASS=$((PASS+1))
else
  echo "FAIL [P3-03] CSV missing BOM (got: $R)"
  FAIL=$((FAIL+1))
fi

# === Phase 3: Upload ===
# P3-04 Upload (no file) - should fail 400
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/upload -H "Authorization: Bearer $UT")
check "P3-04" "Upload no file" "400" "$R"

# P3-05 Upload jpg
cd "$SCRIPT_DIR"
echo -n "fake-jpg-content" > test_upload.jpg
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3001/api/v1/upload -H "Authorization: Bearer $UT" -F "file=@test_upload.jpg;type=image/jpeg")
check "P3-05" "Upload jpg" "201" "$R"
rm -f test_upload.jpg

# P3-06 Upload disallowed type
echo -n "fake-exe" > test_upload.exe
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3001/api/v1/upload -H "Authorization: Bearer $UT" -F "file=@test_upload.exe;type=application/octet-stream")
check "P3-06" "Upload disallowed type" "400" "$R"
rm -f test_upload.exe
cd "$SCRIPT_DIR/server"

# === Phase 2: Atomic optimistic lock ===
# Create a transaction
TXBODY=$(curl -s -X POST $BASE/transactions -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":100,\"categoryId\":\"$EC\"}")
TXID=$(echo "$TXBODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# P2-05 Update with correct version (1)
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/transactions/$TXID" -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d "{\"amount\":200,\"version\":1}")
check "P2-05" "Update with correct version" "200" "$R"

# P2-06 Update with stale version (1) - should be 409 since version is now 2
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/transactions/$TXID" -H "Authorization: Bearer $UT" -H "Content-Type: application/json" -d "{\"amount\":300,\"version\":1}")
check "P2-06" "Update with stale version" "409" "$R"

echo ""
echo "=============================="
echo "  SUMMARY"
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo "  TOTAL:  $((PASS+FAIL))"
echo "=============================="

kill $SERVER_PID 2>/dev/null
