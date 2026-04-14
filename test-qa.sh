#!/bin/bash
# ==============================================================================
# Repayment Tracker API — Automated QA Test Suite
# Date: 2026-04-14
# ==============================================================================

set -euo pipefail

BASE_URL="http://localhost:3001/api/v1"
SERVER_DIR="D:/Claude/repayment-tracker/server"
SERVER_PID=""

TOTAL=0
PASSED=0
FAILED=0
RESULTS=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper: extract JSON field using node
json_field() {
  local json="$1"
  local field="$2"
  echo "$json" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const o=JSON.parse(d);
        const parts='$field'.split('.');
        let v=o;
        for(const p of parts) v=v?.[p];
        process.stdout.write(String(v??''));
      }catch(e){process.stdout.write('');}
    });
  "
}

# Helper: get HTTP status code
http_status() {
  local json="$1"
  # We'll capture status separately
  echo "$json"
}

# Run a single test
# Usage: run_test "ID" "Description" "Expected" HTTP_STATUS RESPONSE_BODY
run_test() {
  local id="$1"
  local desc="$2"
  local expected="$3"
  local actual_status="$4"
  local response="$5"
  local check_fn="${6:-}"

  TOTAL=$((TOTAL + 1))

  local result="PASS"
  local detail=""

  # Check status code
  if [[ "$expected" == *"$actual_status"* ]]; then
    # Additional check function
    if [[ -n "$check_fn" ]]; then
      eval "$check_fn" && result="PASS" || { result="FAIL"; detail="Custom check failed"; }
    fi
  else
    result="FAIL"
    detail="Expected status $expected, got $actual_status"
  fi

  if [[ "$result" == "PASS" ]]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}[PASS]${NC} $id: $desc"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} $id: $desc"
    echo -e "       Expected: $expected | Actual status: $actual_status"
    if [[ -n "$detail" ]]; then
      echo -e "       Detail: $detail"
    fi
  fi
  echo "       Response: $(echo "$response" | head -c 200)"
  echo ""

  RESULTS="${RESULTS}${result}|${id}|${desc}|${expected}|${actual_status}\n"
}

# Curl helper that captures both status and body
do_curl() {
  local tmpfile=$(mktemp)
  local status
  status=$(curl -s -o "$tmpfile" -w "%{http_code}" "$@")
  local body
  body=$(cat "$tmpfile")
  rm -f "$tmpfile"
  echo "${status}|||${body}"
}

cleanup() {
  echo ""
  echo -e "${YELLOW}Cleaning up...${NC}"
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    echo "Server (PID $SERVER_PID) stopped."
  fi
  # Also kill any leftover node processes on port 3001
  # Use lsof or fuser if available, otherwise just best-effort
}

trap cleanup EXIT

# ==============================================================================
# SETUP: Reset database and start server
# ==============================================================================
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  Repayment Tracker API — QA Test Suite${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

echo -e "${YELLOW}[SETUP] Killing any existing server on port 3001...${NC}"
# Try to kill existing processes on port 3001
taskkill //F //PID $(netstat -ano 2>/dev/null | grep ':3001' | grep 'LISTEN' | awk '{print $5}' | head -1) 2>/dev/null || true
sleep 1

echo -e "${YELLOW}[SETUP] Resetting database...${NC}"
cd "$SERVER_DIR"
rm -f prisma/dev.db
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes" npx prisma db push --force-reset --accept-data-loss 2>&1 | tail -3
node prisma/seed.js 2>&1

echo -e "${YELLOW}[SETUP] Starting server...${NC}"
node src/index.js &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 3

# Verify server is up
echo -e "${YELLOW}[SETUP] Verifying server health...${NC}"
HEALTH=$(curl -s "$BASE_URL/health" || echo '{"error":"connection refused"}')
echo "Health check: $HEALTH"
echo ""

# ==============================================================================
# TC-A: Authentication Module
# ==============================================================================
echo -e "${CYAN}=== TC-A: Authentication Module ===${NC}"
echo ""

# A-01: Register user
RESP=$(do_curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test1234","name":"測試當事人","role":"USER"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-01" "Register user (USER role)" "201" "$STATUS" "$BODY"

# A-02: Register supervisor
RESP=$(do_curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"super@test.com","password":"Test1234","name":"測試監督人","role":"SUPERVISOR"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-02" "Register supervisor (SUPERVISOR role)" "201" "$STATUS" "$BODY"

# A-03: Duplicate email
RESP=$(do_curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test1234","name":"重複","role":"USER"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-03" "Register duplicate email — should fail" "409" "$STATUS" "$BODY"

# A-04: Password too short
RESP=$(do_curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"short@test.com","password":"Ab1","name":"短密碼","role":"USER"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-04" "Password too short — should fail" "400" "$STATUS" "$BODY"

# A-05: Password missing uppercase
RESP=$(do_curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"nocase@test.com","password":"abcd1234","name":"無大寫","role":"USER"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-05" "Password missing uppercase — should fail" "400" "$STATUS" "$BODY"

# A-07: Login success (USER)
RESP=$(do_curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test1234"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
USER_TOKEN=$(json_field "$BODY" "data.accessToken")
run_test "A-07" "Login success (USER)" "200" "$STATUS" "$BODY"
echo -e "       ${YELLOW}USER_TOKEN extracted: ${USER_TOKEN:0:20}...${NC}"
echo ""

# A-08: Wrong password
RESP=$(do_curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"WrongPass1"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-08" "Login with wrong password — should fail" "401" "$STATUS" "$BODY"

# A-09: Non-existent account
RESP=$(do_curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexist@test.com","password":"Test1234"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "A-09" "Login non-existent account — should fail" "401" "$STATUS" "$BODY"

# Login as supervisor
RESP=$(do_curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"super@test.com","password":"Test1234"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
SUPER_TOKEN=$(json_field "$BODY" "data.accessToken")
echo -e "       ${YELLOW}SUPER_TOKEN extracted: ${SUPER_TOKEN:0:20}...${NC}"
echo ""

# ==============================================================================
# TC-B: Pairing Module
# ==============================================================================
echo -e "${CYAN}=== TC-B: Pairing Module ===${NC}"
echo ""

# B-01: Supervisor generates invite code
RESP=$(do_curl -X POST "$BASE_URL/pairing/invite" \
  -H "Authorization: Bearer $SUPER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
INVITE_CODE=$(json_field "$BODY" "data.inviteCode")
run_test "B-01" "Supervisor generates invite code" "201" "$STATUS" "$BODY"
echo -e "       ${YELLOW}INVITE_CODE: $INVITE_CODE${NC}"
echo ""

# B-02: User joins with invite code
RESP=$(do_curl -X POST "$BASE_URL/pairing/join" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"inviteCode\":\"$INVITE_CODE\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "B-02" "User joins with invite code" "200" "$STATUS" "$BODY"

# B-05: Already-paired supervisor tries to generate new invite
RESP=$(do_curl -X POST "$BASE_URL/pairing/invite" \
  -H "Authorization: Bearer $SUPER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "B-05" "Already-paired supervisor re-invites — should fail" "400" "$STATUS" "$BODY"

# B-07: User tries to generate invite code
RESP=$(do_curl -X POST "$BASE_URL/pairing/invite" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "B-07" "User tries to generate invite — should fail (role)" "403" "$STATUS" "$BODY"

# B-09: Query pairing status
RESP=$(do_curl "$BASE_URL/pairing" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
PAIRING_STATUS=$(json_field "$BODY" "data.status")
run_test "B-09" "Query pairing status (expect ACTIVE)" "200" "$STATUS" "$BODY"
echo -e "       ${YELLOW}Pairing status: $PAIRING_STATUS${NC}"
echo ""

# ==============================================================================
# TC-C: Transactions — Get Categories first
# ==============================================================================
echo -e "${CYAN}=== TC-C: Transactions ===${NC}"
echo ""

# Get categories
RESP=$(do_curl "$BASE_URL/categories" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
echo -e "${YELLOW}[INFO] Categories response status: $STATUS${NC}"

# Extract an EXPENSE category ID and an INCOME category ID
EXPENSE_CAT_ID=$(echo "$BODY" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const o=JSON.parse(d);
      const cats=o.data||o;
      const exp=Array.isArray(cats)?cats.find(c=>c.type==='EXPENSE'):null;
      process.stdout.write(exp?.id||'');
    }catch(e){process.stdout.write('');}
  });
")

INCOME_CAT_ID=$(echo "$BODY" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const o=JSON.parse(d);
      const cats=o.data||o;
      const inc=Array.isArray(cats)?cats.find(c=>c.type==='INCOME'):null;
      process.stdout.write(inc?.id||'');
    }catch(e){process.stdout.write('');}
  });
")

echo -e "       ${YELLOW}EXPENSE_CAT_ID: $EXPENSE_CAT_ID${NC}"
echo -e "       ${YELLOW}INCOME_CAT_ID: $INCOME_CAT_ID${NC}"
echo ""

# C-01: Create expense
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":500,\"categoryId\":\"$EXPENSE_CAT_ID\",\"description\":\"lunch\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
EXPENSE_TX_ID=$(json_field "$BODY" "data.id")
run_test "C-01" "Create expense transaction" "201" "$STATUS" "$BODY"
echo -e "       ${YELLOW}EXPENSE_TX_ID: $EXPENSE_TX_ID${NC}"
echo ""

# C-02: Create income
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-14\",\"type\":\"INCOME\",\"amount\":30000,\"categoryId\":\"$INCOME_CAT_ID\",\"description\":\"salary\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
INCOME_TX_ID=$(json_field "$BODY" "data.id")
run_test "C-02" "Create income transaction" "201" "$STATUS" "$BODY"
echo -e "       ${YELLOW}INCOME_TX_ID: $INCOME_TX_ID${NC}"
echo ""

# C-04: Amount is 0
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":0,\"categoryId\":\"$EXPENSE_CAT_ID\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "C-04" "Amount is 0 — should fail validation" "400" "$STATUS" "$BODY"

# C-05: Amount is negative
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":-100,\"categoryId\":\"$EXPENSE_CAT_ID\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "C-05" "Amount is negative — should fail validation" "400" "$STATUS" "$BODY"

# C-07: Future date
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2030-01-01\",\"type\":\"EXPENSE\",\"amount\":100,\"categoryId\":\"$EXPENSE_CAT_ID\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "C-07" "Future date — should fail validation" "400" "$STATUS" "$BODY"

# C-19: List filter by type
RESP=$(do_curl "$BASE_URL/transactions?type=EXPENSE" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "C-19" "List transactions filtered by type=EXPENSE" "200" "$STATUS" "$BODY"

# C-22: Pagination
RESP=$(do_curl "$BASE_URL/transactions?page=1&limit=10" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
HAS_PAGINATION=$(json_field "$BODY" "pagination.page")
run_test "C-22" "Pagination (page=1, limit=10)" "200" "$STATUS" "$BODY"

# C-23: Supervisor views user's transactions
RESP=$(do_curl "$BASE_URL/transactions" \
  -H "Authorization: Bearer $SUPER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "C-23" "Supervisor views user's transactions" "200" "$STATUS" "$BODY"

# ==============================================================================
# TC-E: Debt Module
# ==============================================================================
echo -e "${CYAN}=== TC-E: Debt Module ===${NC}"
echo ""

# E-01: Create debt
RESP=$(do_curl -X POST "$BASE_URL/debts" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"信用卡A","creditor":"銀行A","originalAmount":50000,"monthlyDue":5000,"dueDay":15}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
DEBT_ID=$(json_field "$BODY" "data.id")
run_test "E-01" "Create debt" "201" "$STATUS" "$BODY"
echo -e "       ${YELLOW}DEBT_ID: $DEBT_ID${NC}"
echo ""

# E-02: dueDay > 31
RESP=$(do_curl -X POST "$BASE_URL/debts" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","creditor":"test","originalAmount":1000,"monthlyDue":100,"dueDay":32}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "E-02" "dueDay > 31 — should fail validation" "400" "$STATUS" "$BODY"

# E-04: Negative amount
RESP=$(do_curl -X POST "$BASE_URL/debts" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","creditor":"test","originalAmount":-1000,"monthlyDue":100,"dueDay":15}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "E-04" "Negative originalAmount — should fail validation" "400" "$STATUS" "$BODY"

# ==============================================================================
# TC-C (continued): Repayment transactions
# ==============================================================================
echo -e "${CYAN}=== TC-C (cont): Repayment Transactions ===${NC}"
echo ""

# C-03: Create repayment
C03_PAYLOAD=$(node -e "process.stdout.write(JSON.stringify({date:'2026-04-14',type:'REPAYMENT',amount:1000,categoryId:'$EXPENSE_CAT_ID',debtId:'$DEBT_ID',description:'repayment'}))")
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$C03_PAYLOAD")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
REPAYMENT_TX_ID=$(json_field "$BODY" "data.id")
run_test "C-03" "Create repayment transaction" "201" "$STATUS" "$BODY"
echo -e "       ${YELLOW}REPAYMENT_TX_ID: $REPAYMENT_TX_ID${NC}"
echo ""

# C-08: Repayment exceeds balance
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-14\",\"type\":\"REPAYMENT\",\"amount\":999999,\"categoryId\":\"$EXPENSE_CAT_ID\",\"debtId\":\"$DEBT_ID\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "C-08" "Repayment exceeds debt balance — should fail" "400" "$STATUS" "$BODY"

# ==============================================================================
# TC-D: Review Flow
# ==============================================================================
echo -e "${CYAN}=== TC-D: Review Flow ===${NC}"
echo ""

# D-01: Supervisor approves expense
RESP=$(do_curl -X PATCH "$BASE_URL/transactions/$EXPENSE_TX_ID/review" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"APPROVE"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
APPROVED_STATUS=$(json_field "$BODY" "data.status")
run_test "D-01" "Supervisor approves expense (expect APPROVED)" "200" "$STATUS" "$BODY"
echo -e "       ${YELLOW}Transaction status after approval: $APPROVED_STATUS${NC}"
echo ""

# D-02: Supervisor approves repayment — check debt balance deduction
RESP=$(do_curl -X PATCH "$BASE_URL/transactions/$REPAYMENT_TX_ID/review" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"APPROVE"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "D-02" "Supervisor approves repayment (balance should decrease)" "200" "$STATUS" "$BODY"

# Check debt balance after repayment approval
RESP=$(do_curl "$BASE_URL/debts/$DEBT_ID" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
DEBT_BALANCE=$(json_field "$BODY" "data.currentBalance")
echo -e "       ${YELLOW}Debt balance after 1000 repayment: $DEBT_BALANCE (expected: 49000)${NC}"
if [[ "$DEBT_BALANCE" == "49000" ]]; then
  TOTAL=$((TOTAL + 1)); PASSED=$((PASSED + 1))
  echo -e "${GREEN}[PASS]${NC} D-02b: Debt balance correctly reduced to 49000"
else
  TOTAL=$((TOTAL + 1)); FAILED=$((FAILED + 1))
  echo -e "${RED}[FAIL]${NC} D-02b: Debt balance expected 49000, got $DEBT_BALANCE"
fi
echo ""

# D-04: Reject income with note
RESP=$(do_curl -X PATCH "$BASE_URL/transactions/$INCOME_TX_ID/review" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"REJECT","reviewNote":"金額需確認"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
REJECT_STATUS=$(json_field "$BODY" "data.status")
run_test "D-04" "Supervisor rejects income with note" "200" "$STATUS" "$BODY"
echo -e "       ${YELLOW}Transaction status: $REJECT_STATUS${NC}"
echo ""

# D-05: Reject without note — should fail validation
# First create another transaction to have a PENDING one
D05_PAYLOAD=$(node -e "process.stdout.write(JSON.stringify({date:'2026-04-14',type:'EXPENSE',amount:200,categoryId:'$EXPENSE_CAT_ID',description:'test-pending'}))")
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$D05_PAYLOAD")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
PENDING_TX_ID=$(json_field "$BODY" "data.id")

RESP=$(do_curl -X PATCH "$BASE_URL/transactions/$PENDING_TX_ID/review" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"REJECT"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "D-05" "Reject without reviewNote — should fail validation" "400" "$STATUS" "$BODY"

# D-08: User tries to review — should be forbidden
RESP=$(do_curl -X PATCH "$BASE_URL/transactions/$PENDING_TX_ID/review" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"APPROVE"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "D-08" "User tries to review — should be forbidden" "403" "$STATUS" "$BODY"

# ==============================================================================
# TC-J: Security Tests
# ==============================================================================
echo -e "${CYAN}=== TC-J: Security Tests ===${NC}"
echo ""

# J-01: Unauthenticated access
RESP=$(do_curl "$BASE_URL/transactions")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "J-01" "Unauthenticated access — should fail" "401" "$STATUS" "$BODY"

# J-03: Fake token
RESP=$(do_curl "$BASE_URL/transactions" \
  -H "Authorization: Bearer fake.jwt.token")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "J-03" "Fake JWT token — should fail" "401" "$STATUS" "$BODY"

# J-06: User tries to review (role escalation)
RESP=$(do_curl -X PATCH "$BASE_URL/transactions/$PENDING_TX_ID/review" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"APPROVE"}')
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "J-06" "Role escalation: user tries to review" "403" "$STATUS" "$BODY"

# J-07: Supervisor tries to create transaction
RESP=$(do_curl -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":100,\"categoryId\":\"$EXPENSE_CAT_ID\"}")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "J-07" "Role escalation: supervisor creates transaction" "403" "$STATUS" "$BODY"

# ==============================================================================
# TC-H: Dashboard
# ==============================================================================
echo -e "${CYAN}=== TC-H: Dashboard ===${NC}"
echo ""

# H-01: User dashboard
RESP=$(do_curl "$BASE_URL/dashboard/summary" \
  -H "Authorization: Bearer $USER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "H-01" "User dashboard summary" "200" "$STATUS" "$BODY"

# H-03: Supervisor dashboard
RESP=$(do_curl "$BASE_URL/dashboard/summary" \
  -H "Authorization: Bearer $SUPER_TOKEN")
STATUS="${RESP%%|||*}"
BODY="${RESP#*|||}"
run_test "H-03" "Supervisor dashboard summary" "200" "$STATUS" "$BODY"

# ==============================================================================
# SUMMARY
# ==============================================================================
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  TEST SUMMARY${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "  Total:  ${TOTAL}"
echo -e "  ${GREEN}Passed: ${PASSED}${NC}"
echo -e "  ${RED}Failed: ${FAILED}${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}ALL TESTS PASSED!${NC}"
else
  echo -e "${RED}${FAILED} TEST(S) FAILED${NC}"
fi

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  DETAILED RESULTS${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "Result | ID    | Description                               | Expected | Actual"
echo -e "-------|-------|-------------------------------------------|----------|-------"
echo -e "$RESULTS" | while IFS='|' read -r result id desc expected actual; do
  if [[ -n "$result" ]]; then
    printf "%-6s | %-5s | %-41s | %-8s | %s\n" "$result" "$id" "$desc" "$expected" "$actual"
  fi
done

echo ""
echo "Test run completed at $(date)"
