#!/bin/bash
cd D:/Claude/repayment-tracker/server

# Kill any existing server
pkill -f "node src/index.js" 2>/dev/null
sleep 1

# Start server
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
echo "  QA Test Suite"
echo "=============================="

# A-01
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"Test1234","name":"user","role":"USER"}')
check "A-01" "Register USER" "201" "$R"

# A-02
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"super@test.com","password":"Test1234","name":"super","role":"SUPERVISOR"}')
check "A-02" "Register SUPERVISOR" "201" "$R"

# A-03
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"Test1234","name":"dup","role":"USER"}')
check "A-03" "Duplicate email" "409" "$R"

# A-04
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"x@t.com","password":"Ab1","name":"x","role":"USER"}')
check "A-04" "Short password" "400" "$R"

# A-05
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"email":"y@t.com","password":"abcd1234","name":"y","role":"USER"}')
check "A-05" "No uppercase in password" "400" "$R"

# A-07 Login USER
BODY=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"Test1234"}')
USER_TOKEN=$(echo "$BODY" | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
if [ ${#USER_TOKEN} -gt 20 ]; then
  echo "PASS [A-07] Login USER (token ok)"
  PASS=$((PASS+1))
else
  echo "FAIL [A-07] Login USER"
  FAIL=$((FAIL+1))
fi

# A-08
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"Wrong123"}')
check "A-08" "Wrong password" "401" "$R"

# A-09
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"none@t.com","password":"Test1234"}')
check "A-09" "Account not exist" "401" "$R"

# Login SUPERVISOR
BODY=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"super@test.com","password":"Test1234"}')
SUPER_TOKEN=$(echo "$BODY" | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

# B-01 Invite
BODY=$(curl -s -X POST $BASE/pairing/invite -H "Authorization: Bearer $SUPER_TOKEN")
INVITE=$(echo "$BODY" | sed 's/.*"inviteCode":"\([^"]*\)".*/\1/')
if [ ${#INVITE} -eq 6 ]; then
  echo "PASS [B-01] Generate invite code ($INVITE)"
  PASS=$((PASS+1))
else
  echo "FAIL [B-01] Generate invite code"
  FAIL=$((FAIL+1))
fi

# B-07
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/pairing/invite -H "Authorization: Bearer $USER_TOKEN")
check "B-07" "USER cannot invite" "403" "$R"

# B-02 Join
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/pairing/join -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"inviteCode\":\"$INVITE\"}")
check "B-02" "Join pairing" "200" "$R"

# B-05
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/pairing/invite -H "Authorization: Bearer $SUPER_TOKEN")
check "B-05" "Already paired supervisor invite" "400" "$R"

# Get categories
CATS=$(curl -s $BASE/categories -H "Authorization: Bearer $USER_TOKEN")
EXP_CAT=$(echo "$CATS" | grep -o '"id":"[^"]*","name":"[^"]*","type":"EXPENSE"' | head -1 | sed 's/.*"id":"\([^"]*\)".*/\1/')
INC_CAT=$(echo "$CATS" | grep -o '"id":"[^"]*","name":"[^"]*","type":"INCOME"' | head -1 | sed 's/.*"id":"\([^"]*\)".*/\1/')

# C-01 Expense
BODY=$(curl -s -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":500,\"categoryId\":\"$EXP_CAT\",\"description\":\"lunch\"}")
R=$(echo "$BODY" | grep -c '"status":"PENDING"')
TX_EXP=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "C-01" "Create expense" "1" "$R"

# C-02 Income
BODY=$(curl -s -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"INCOME\",\"amount\":30000,\"categoryId\":\"$INC_CAT\",\"description\":\"salary\"}")
R=$(echo "$BODY" | grep -c '"status":"PENDING"')
TX_INC=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "C-02" "Create income" "1" "$R"

# C-04 amount 0
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":0,\"categoryId\":\"$EXP_CAT\"}")
check "C-04" "Amount zero" "400" "$R"

# C-05 amount negative
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":-100,\"categoryId\":\"$EXP_CAT\"}")
check "C-05" "Amount negative" "400" "$R"

# C-07 future date
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2030-01-01\",\"type\":\"EXPENSE\",\"amount\":100,\"categoryId\":\"$EXP_CAT\"}")
check "C-07" "Future date" "400" "$R"

# E-01 Create debt
BODY=$(curl -s -X POST $BASE/debts -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{"name":"CardA","creditor":"BankA","originalAmount":50000,"monthlyDue":5000,"dueDay":15}')
R=$(echo "$BODY" | grep -c '"currentBalance":50000')
DEBT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "E-01" "Create debt" "1" "$R"

# E-04 negative amount
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/debts -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{"name":"x","creditor":"x","originalAmount":-1000,"monthlyDue":100,"dueDay":15}')
check "E-04" "Debt negative amount" "400" "$R"

# C-03 Repayment
BODY=$(curl -s -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"REPAYMENT\",\"amount\":1000,\"categoryId\":\"$EXP_CAT\",\"debtId\":\"$DEBT_ID\"}")
R=$(echo "$BODY" | grep -c '"status":"PENDING"')
TX_REP=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "C-03" "Create repayment" "1" "$R"

# C-08 Repayment exceeds balance
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"REPAYMENT\",\"amount\":999999,\"categoryId\":\"$EXP_CAT\",\"debtId\":\"$DEBT_ID\"}")
check "C-08" "Repayment exceeds balance" "400" "$R"

# C-23 Supervisor view
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/transactions -H "Authorization: Bearer $SUPER_TOKEN")
check "C-23" "Supervisor view transactions" "200" "$R"

# D-01 Approve expense
R=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/transactions/$TX_EXP/review" -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" -d '{"action":"APPROVE"}')
check "D-01" "Approve expense" "200" "$R"

# D-02 Approve repayment
R=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/transactions/$TX_REP/review" -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" -d '{"action":"APPROVE"}')
check "D-02" "Approve repayment" "200" "$R"

# D-02b Check balance deducted
BODY=$(curl -s "$BASE/debts/$DEBT_ID" -H "Authorization: Bearer $USER_TOKEN")
BAL=$(echo "$BODY" | grep -o '"currentBalance":[0-9]*' | cut -d: -f2)
check "D-02b" "Balance deducted to 49000" "49000" "$BAL"

# D-04 Reject
R=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/transactions/$TX_INC/review" -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" -d '{"action":"REJECT","reviewNote":"check amount"}')
check "D-04" "Reject transaction" "200" "$R"

# D-05 Reject without note - need a new PENDING tx
BODY2=$(curl -s -X POST $BASE/transactions -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":200,\"categoryId\":\"$EXP_CAT\"}")
TX2=$(echo "$BODY2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
R=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/transactions/$TX2/review" -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" -d '{"action":"REJECT"}')
check "D-05" "Reject without note" "400" "$R"

# D-08 User try review
R=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/transactions/$TX2/review" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{"action":"APPROVE"}')
check "D-08" "User cannot review" "403" "$R"

# J-01 No auth
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/transactions)
check "J-01" "No auth" "401" "$R"

# J-03 Fake token
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/transactions -H "Authorization: Bearer fake.jwt.token")
check "J-03" "Fake token" "401" "$R"

# J-07 Supervisor create tx
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/transactions -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"2026-04-14\",\"type\":\"EXPENSE\",\"amount\":100,\"categoryId\":\"$EXP_CAT\"}")
check "J-07" "Supervisor cannot create tx" "403" "$R"

# H-01 User dashboard
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/dashboard/summary -H "Authorization: Bearer $USER_TOKEN")
check "H-01" "User dashboard" "200" "$R"

# H-03 Supervisor dashboard
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/dashboard/summary -H "Authorization: Bearer $SUPER_TOKEN")
check "H-03" "Supervisor dashboard" "200" "$R"

# E-07 Delete debt with repayments
R=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/debts/$DEBT_ID" -H "Authorization: Bearer $USER_TOKEN")
check "E-07" "Cannot delete debt with repayments" "400" "$R"

# C-15 Edit APPROVED tx
R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/transactions/$TX_EXP" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{"amount":999,"version":1}')
check "C-15" "Cannot edit APPROVED tx" "400" "$R"

echo ""
echo "=============================="
echo "  SUMMARY"
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo "  TOTAL:  $((PASS+FAIL))"
echo "=============================="

kill $SERVER_PID 2>/dev/null
