#!/bin/bash

# Simple test to ensure tests don't cancel each other
# This script runs multiple test suites in parallel to verify they don't interfere

echo "🧪 Testing parallel execution stability..."

# Run multiple test suites in parallel
bun run test:timezone &
PID1=$!

sleep 2

bun run test:critical &
PID2=$!

sleep 2

# Wait for both to complete
wait $PID1
EXIT1=$?

wait $PID2
EXIT2=$?

echo ""
echo "📊 Test Results:"
echo "  Timezone tests: $([ $EXIT1 -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "  Critical tests: $([ $EXIT2 -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"

if [ $EXIT1 -eq 0 ] && [ $EXIT2 -eq 0 ]; then
    echo "🎉 All parallel tests passed - no cancellation issues!"
    exit 0
else
    echo "❌ Some tests failed - potential cancellation issues"
    exit 1
fi