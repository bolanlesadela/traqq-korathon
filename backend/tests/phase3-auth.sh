#!/bin/bash
# ============================================================
# TRAQQ — Phase 3 Auth Tests
# Run these curl commands manually after starting the server.
# npm run dev → then run these in a second terminal.
# ============================================================

BASE="http://localhost:3000"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Health check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s "$BASE/health" | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Register — valid input"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Adaeze Okafor",
    "email": "adaeze@test.com",
    "password": "SecurePass123",
    "business_name": "Adaeze Fashion"
  }' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Register — duplicate email (expect 409)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Adaeze Okafor",
    "email": "adaeze@test.com",
    "password": "SecurePass123"
  }' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Register — weak password (expect 400)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "email": "test2@test.com",
    "password": "weak"
  }' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Login — valid credentials"
echo "(Copy the access_token and refresh_token from output)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adaeze@test.com",
    "password": "SecurePass123"
  }' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Login — wrong password (expect 401)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adaeze@test.com",
    "password": "WrongPassword1"
  }' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: GET /me — no token (expect 401)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s "$BASE/api/auth/me" | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 8: GET /me — with token"
echo "Replace YOUR_ACCESS_TOKEN with token from TEST 5"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "curl -s $BASE/api/auth/me -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' | jq ."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 9: Refresh token"
echo "Replace YOUR_REFRESH_TOKEN with token from TEST 5"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "curl -s -X POST $BASE/api/auth/refresh \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"refresh_token\": \"YOUR_REFRESH_TOKEN\"}' | jq ."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 10: Rate limit — hammer login (expect 429 after 10 req)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "for i in {1..12}; do"
echo "  curl -s -X POST $BASE/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"x@x.com\",\"password\":\"wrong\"}' | jq .message"
echo "done"
