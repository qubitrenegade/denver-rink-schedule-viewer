# Apex Timezone Bug Fix Guide

## Problem
Apex Ice Arena events are showing incorrect times like "12:45 AM - 1:45 AM" when they should show "5:30 AM - 6:30 AM".

## Root Cause
The Apex scraper was storing Mountain Time as UTC in the KV database. When the frontend displays these times, it treats them as UTC and converts to local time, causing the wrong display.

## Solution Status
✅ **Scraper Fixed** - New data will be correct  
❌ **Existing Data** - Still shows wrong times (needs re-scraping)

## Quick Fix Options

### Option 1: Trigger Re-scrape (Recommended)
```bash
# This will trigger the Apex scraper to run with the fixed timezone logic
node scripts/fix-apex-timezone.js --trigger
```

### Option 2: Wait for Automatic Update
The scrapers run every 6 hours automatically. The next run will store correct data.

### Option 3: Manual Worker Trigger
1. Go to Cloudflare Workers dashboard
2. Find the `rink-scraper-apex-ice` worker
3. Click "Send Request" with POST method

## Verification

### Test if Fix Worked
```bash
# Run timezone tests
bun run test:timezone

# Check for midnight time bug prevention
bun test workers/scrapers/apex-ice.test.ts --reporter=verbose
```

### Expected Results
- ✅ Events should show times like "5:30 AM - 6:30 AM"  
- ❌ Should NOT show times like "12:45 AM - 1:45 AM"

## Technical Details

### What Changed in the Fix
```typescript
// OLD (buggy) - double conversion
const startDate = new Date(event.start_time); // Treats as local time
const startUtc = ColoradoTimezone.mountainTimeToUTC(startDate); // Adds MT offset

// NEW (fixed) - direct conversion  
const startUtc = ColoradoTimezone.parseMountainTime(event.start_time);
```

### Data Format
```javascript
// WRONG data in KV (old)
{
  "startTime": "2024-07-15T05:30:00.000Z", // 5:30 UTC → shows as midnight MT
  "endTime": "2024-07-15T06:30:00.000Z"
}

// CORRECT data in KV (new)
{
  "startTime": "2024-07-15T11:30:00.000Z", // 11:30 UTC → shows as 5:30 AM MT
  "endTime": "2024-07-15T12:30:00.000Z"   // 12:30 UTC → shows as 6:30 AM MT
}
```

## Prevention
- ✅ Tests added to prevent regression (`workers/scrapers/apex-ice.test.ts`)
- ✅ GitHub workflows will catch timezone bugs in PRs
- ✅ DST-aware timezone handling for all seasons

## Troubleshooting

### Still Seeing Wrong Times?
1. Check if re-scrape completed: Look for recent "last updated" times
2. Clear browser cache: Force reload (Ctrl+F5)
3. Wait 5-10 minutes after triggering re-scrape

### Re-scrape Failed?
```bash
# Check scraper status
curl https://rink-scraper-apex-ice.qbrd.workers.dev/status

# Check data API
curl https://api.geticeti.me/data/apex-ice-east.json
```

---

🕐 **Once fixed, all Apex times will display correctly in both summer (MDT) and winter (MST)!**