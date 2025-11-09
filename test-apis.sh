#!/bin/bash

# API Testing Script for Phase 1 & 2
# Usage: ./test-apis.sh <staging-url> <session-cookie>

STAGING_URL="${1:-http://localhost:5000}"
SESSION_COOKIE="${2}"

echo "🧪 Testing Phase 1 & 2 APIs"
echo "Staging URL: $STAGING_URL"
echo "-----------------------------------"

if [ -z "$SESSION_COOKIE" ]; then
    echo "⚠️  No session cookie provided. Some tests will fail."
    echo "Usage: ./test-apis.sh <url> <session-cookie>"
    echo ""
fi

# Test 1: Health Check
echo "📍 Test 1: Health Check"
curl -s "$STAGING_URL/api/health" | head -c 200
echo ""
echo ""

# Test 2: Driver Current Location
if [ -n "$SESSION_COOKIE" ]; then
    echo "📍 Test 2: Get Driver Current Location"
    curl -s "$STAGING_URL/api/driver/location/current" \
        -H "Cookie: connect.sid=$SESSION_COOKIE" | head -c 200
    echo ""
    echo ""
fi

# Test 3: Driver Stats
if [ -n "$SESSION_COOKIE" ]; then
    echo "📍 Test 3: Get Driver Stats"
    curl -s "$STAGING_URL/api/driver/stats" \
        -H "Cookie: connect.sid=$SESSION_COOKIE" | head -c 200
    echo ""
    echo ""
fi

# Test 4: Driver Capabilities (Phase 2)
if [ -n "$SESSION_COOKIE" ]; then
    echo "📍 Test 4: Get Driver Capabilities (Phase 2)"
    curl -s "$STAGING_URL/api/driver/capabilities" \
        -H "Cookie: connect.sid=$SESSION_COOKIE" | head -c 200
    echo ""
    echo ""
fi

# Test 5: Basic Route Optimization
if [ -n "$SESSION_COOKIE" ]; then
    echo "📍 Test 5: Basic Route Optimization"
    curl -s -X POST "$STAGING_URL/api/driver/route/batch" \
        -H "Content-Type: application/json" \
        -H "Cookie: connect.sid=$SESSION_COOKIE" \
        -d '{"orderIds":[1,2],"optimizeFor":"time"}' | head -c 300
    echo ""
    echo ""
fi

# Test 6: Advanced Route Optimization (Phase 2)
if [ -n "$SESSION_COOKIE" ]; then
    echo "📍 Test 6: Advanced Route Optimization (Phase 2)"
    curl -s -X POST "$STAGING_URL/api/driver/route/batch/advanced" \
        -H "Content-Type: application/json" \
        -H "Cookie: connect.sid=$SESSION_COOKIE" \
        -d '{"orderIds":[1,2],"optimizeFor":"time","respectConstraints":true}' | head -c 300
    echo ""
    echo ""
fi

echo "-----------------------------------"
echo "✅ API tests completed!"
echo ""
echo "Next steps:"
echo "1. Check for any error messages above"
echo "2. Review PHASE_1_2_TEST_PLAN.md for full testing"
echo "3. Test UI in browser at $STAGING_URL/driver/dashboard"
