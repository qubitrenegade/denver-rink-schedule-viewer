#!/bin/bash

echo "🔍 Checking combined.json for DU events..."
echo "==========================================="

# Check if file exists
if [ ! -f "data/combined.json" ]; then
    echo "❌ data/combined.json not found!"
    exit 1
fi

# Count total events
total_events=$(jq length data/combined.json)
echo "📊 Total events in combined.json: $total_events"

# Count DU events
du_events=$(jq '[.[] | select(.rinkId == "du-ritchie")] | length' data/combined.json)
echo "🏫 DU Ritchie events: $du_events"

if [ $du_events -gt 0 ]; then
    echo ""
    echo "📋 Sample DU events:"
    jq -r '[.[] | select(.rinkId == "du-ritchie")] | .[0:3] | .[] | "  \(.title) - \(.startTime) (\(.category))"' data/combined.json
    
    echo ""
    echo "🗓️ DU events by date (next few days):"
    current_date=$(date -u +%Y-%m-%d)
    jq -r --arg current_date "$current_date" '[.[] | select(.rinkId == "du-ritchie" and .startTime >= $current_date)] | sort_by(.startTime) | .[0:5] | .[] | "  \(.startTime | split("T")[0]) \(.startTime | split("T")[1] | split(".")[0]) - \(.title)"' data/combined.json
else
    echo "❌ No DU events found in combined.json"
fi

echo ""
echo "🔍 All unique rinkIds in combined.json:"
jq -r '[.[] | .rinkId] | unique | .[]' data/combined.json | sed 's/^/  /'

