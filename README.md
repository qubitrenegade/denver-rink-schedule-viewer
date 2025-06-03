# Denver Rink Schedule Viewer

A modern, scalable web app and data pipeline for viewing and filtering public ice rink schedules in the Denver metro area. Built with React frontend and Cloudflare Workers backend for global edge deployment.

## Features
- **Fast, filterable schedule viewer** for multiple rinks with real-time data
- **Modular React frontend** with custom hooks, filter components, and URL state management
- **Robust Cloudflare Workers backend** with automated scraping and edge caching
- **Durable Objects scheduling** for reliable, distributed scraper orchestration
- **KV storage** for fast, globally distributed data access
- **Mobile-friendly, accessible UI** with modern design
- **Automated data freshness** with configurable splay timing to avoid rate limiting

## Architecture

### Frontend (React + Vite)
- Deployed to GitHub Pages
- Fetches data from Cloudflare Workers API
- Modular component architecture with TypeScript

### Backend (Cloudflare Workers)
- **Data API Worker** (`workers/data-api.ts`) - Serves aggregated data from KV storage
- **Scraper Workers** - Individual workers for each rink with Durable Object scheduling
- **ScraperHelpers** (`workers/helpers/scraper-helpers.ts`) - Shared utilities and patterns

### Scrapers (Current Rinks)
- 🧊 **Ice Ranch** (Littleton - South Park) - RSS feed scraper
- 🐻 **Big Bear Ice Arena** (Lowry) - HTML scraper  
- 🏫 **DU Ritchie Center** (University of Denver) - HTML scraper
- ⛸️ **Foothills Edge Ice Arena** (Littleton - Ken Caryl) - HTML scraper
- 🏢 **SSPRD Ice Center** (Englewood/Highlands Ranch) - HTML scraper

## Installation

```bash
bun install
```

## Development

### Frontend Development
```bash
bun run dev  # Start Vite dev server on http://localhost:5173
```

### Worker Development  
```bash
# Start all workers for development
./scripts/dev-workers.sh

# Advanced options
./scripts/dev-workers.sh --port-start 9000 --test
./scripts/dev-workers.sh --include "data-api" --include "ice-ranch"
./scripts/dev-workers.sh --exclude "big-bear" --exclude "ssprd"
```

### Manual Worker Testing
```bash
# Test data API
curl http://localhost:8787/api/health
curl http://localhost:8787/api/all-events

# Trigger individual scrapers  
curl -X POST http://localhost:8788  # Ice Ranch
curl -X POST http://localhost:8789  # Big Bear
# etc.
```

## Deployment

### Frontend Deployment
The frontend automatically deploys to GitHub Pages when changes are pushed to the main branch.

### Worker Deployment
```bash
# Deploy data API
wrangler deploy --config wrangler.toml

# Deploy individual scrapers
wrangler deploy --config wrangler-ice-ranch.toml
wrangler deploy --config wrangler-big-bear.toml
wrangler deploy --config wrangler-du-ritchie.toml
wrangler deploy --config wrangler-foothills-edge.toml
wrangler deploy --config wrangler-ssprd.toml
```

## Project Structure

### Frontend (`src/`)
- `App.tsx` — Main app component with routing
- `components/` — Modular React components
  - `EventList.tsx`, `EventCard.tsx` — Event display components
  - `FilterControls.tsx` — Master filter component
  - `CategoryFilter.tsx`, `DateFilter.tsx`, `TimeFilter.tsx` — Individual filters
  - `RinkFilter.tsx`, `RinkTabs.tsx` — Rink selection components
  - `ErrorBoundary.tsx` — Error handling component
- `hooks/` — Custom React hooks
  - `useEventData.ts` — Data fetching and management
  - `useEventFiltering.ts` — Event filtering logic
  - `useUrlState.ts` — URL state synchronization
- `rinkConfig.ts` — Rink metadata and configuration
- `types.ts` — Shared TypeScript definitions

### Backend (`workers/`)
- `data-api.ts` — Main API worker for serving aggregated data
- `helpers/scraper-helpers.ts` — Shared utilities and Durable Object patterns
- `scrapers/` — Individual scraper workers
  - `ice-ranch.ts` — RSS feed scraper with Durable Object scheduling
  - `big-bear.ts` — HTML scraper with Durable Object scheduling  
  - `du-ritchie.ts` — HTML scraper with Durable Object scheduling
  - `foothills-edge.ts` — HTML scraper with Durable Object scheduling
  - `ssprd.ts` — HTML scraper with Durable Object scheduling

### Configuration
- `wrangler*.toml` — Cloudflare Worker configurations for each service
- `scripts/dev-workers.sh` — Development script for running all workers locally
- `refactor/` — Technical documentation and improvement plans

## Key Technical Features

### Durable Objects Pattern
All scrapers use a consistent Durable Object pattern abstracted into `ScraperHelpers`:
- `handleSchedulerFetch()` — Common request handling with status endpoints
- `handleSchedulerAlarm()` — Automatic rescheduling with configurable splay timing
- `getAlarmTime()` — Random delay calculation to avoid rate limiting

### Environment Configuration
Scrapers use environment variables for timing configuration:
- `SCRAPER_SPLAY_MINUTES` — Maximum random delay between scrapes (default: 360 minutes)

### Data Flow
1. **Durable Objects** schedule scraper execution with random splay delays
2. **Scrapers** fetch data from rink websites and parse into standardized format
3. **KV Storage** stores both events data and metadata for each rink
4. **Data API** aggregates data from KV storage and serves to frontend
5. **Frontend** displays real-time data with client-side filtering

## API Endpoints

### Data API Worker
- `GET /api/health` — Health check
- `GET /api/all-events` — All events from all rinks
- `GET /api/all-metadata` — Metadata for all rinks
- `GET /data/{rinkId}.json` — Events for specific rink
- `GET /data/{rinkId}-metadata.json` — Metadata for specific rink

### Scraper Workers  
- `GET /status` — Scheduler status and next run time
- `POST /` — Manually trigger scraper execution

## Testing

### Frontend Tests
```bash
bun test          # Run all tests
bun test:watch    # Run tests in watch mode
```

### Worker Testing
```bash
# Automated testing with dev script
./scripts/dev-workers.sh --test

# Manual endpoint testing
curl http://localhost:8787/api/health
curl -X POST http://localhost:8788  # Trigger scraper
```

## Adding New Rinks

1. **Create scraper worker** in `workers/scrapers/new-rink.ts`
2. **Use ScraperHelpers pattern**:
   ```typescript
   export class NewRinkScheduler {
     async fetch(request: Request): Promise<Response> {
       return ScraperHelpers.handleSchedulerFetch(/*...*/);
     }
     async alarm(): Promise<void> {
       return ScraperHelpers.handleSchedulerAlarm(/*...*/);
     }
   }
   ```
3. **Create wrangler config** `wrangler-new-rink.toml`
4. **Add to frontend** `rinkConfig.ts`
5. **Update dev script** (automatic detection)

## Performance & Reliability

- **Edge deployment** via Cloudflare Workers for global low latency
- **Automatic retries** and error handling in scrapers
- **Rate limiting protection** with random splay delays
- **Data caching** at edge locations via KV storage
- **Graceful degradation** if individual scrapers fail
- **Real-time updates** with configurable refresh intervals

## Contributing

Contributions welcome! The codebase is designed for maintainability:

- **Modular architecture** with clear separation of concerns
- **Shared patterns** via ScraperHelpers reduce code duplication

## Web Scraping Lessons Learned

This project has provided valuable insights into scraping different types of websites for ice rink schedules. Here are the key challenges, solutions, and lessons learned:

### Data Source Types & Approaches

#### 1. RSS Feeds (Ice Ranch)
**Approach:** RSS feed parsing with XML string manipulation  
**Challenges:**
- No `xml2js` library available in Cloudflare Workers runtime
- CDATA sections and HTML entities requiring manual cleaning
- Inconsistent date formats and timezone handling

**Solutions:**
- Custom XML parsing using regex patterns
- Manual HTML entity decoding (`&amp;`, `&lt;`, etc.)
- Robust timezone conversion for Mountain Time to UTC
- Tag-based event categorization from RSS metadata

**Key Code Pattern:**
```typescript
private parseBasicXML(xml: string): any[] {
  const itemRegex = /<item>(.*?)<\/item>/gs;
  // Extract title with CDATA handling
  let titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s);
  if (!titleMatch) {
    titleMatch = itemContent.match(/<title>(.*?)<\/title>/s);
  }
}
```

#### 2. HTML Form POST APIs (Big Bear)
**Approach:** Reverse-engineered API calls with form data  
**Challenges:**
- Complex form parameters with multiple reservation types and resources
- Server-side timezone assumptions (Mountain Time returned as UTC)
- API responses requiring time zone correction

**Solutions:**
- Form data analysis to identify required parameters
- Manual timezone adjustment (+6 hours for MT to UTC conversion)
- Comprehensive form field mapping for all event types

**Key Code Pattern:**
```typescript
const formData = new URLSearchParams({
  'ReservationTypes[0].Selected': 'true',
  'ReservationTypes[0].Id': '-1',
  // ... 14 more reservation types
  'Resources[0].Id': '-1', 
  // ... 6 more resources
});
```

#### 3. iCal/Calendar Feeds (DU Ritchie)
**Approach:** Google Calendar iCal parsing  
**Challenges:**
- Complex iCal format with multi-line folding
- Timezone data blocks requiring parsing
- HTML descriptions needing cleaning
- Multiple calendar aggregation

**Solutions:**
- Custom iCal parser handling line folding and escaping
- HTML description cleaning with essential info extraction
- Event deduplication across multiple calendars
- Selective event filtering (basketball vs. ice events)

**Key Code Pattern:**
```typescript
// Handle iCal line folding
while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
  i++;
  line += lines[i].substring(1);
}
```

#### 4. JavaScript-Embedded Data (Foothills Edge)
**Approach:** Extract JSON data from inline JavaScript  
**Challenges:**
- JavaScript object parsing without `eval()`
- Dynamic event object structure
- Time parsing from various formats
- Fallback parsing when JavaScript extraction fails

**Solutions:**
- Regex-based JavaScript object extraction
- Brace counting for proper JSON boundary detection
- Multiple time format parsing (12-hour with AM/PM)
- DOM parsing fallback for robust data extraction

**Key Code Pattern:**
```typescript
const eventsStartMatch = html.match(/events\s*=\s*\{"[0-9]{4}-[0-9]{2}-[0-9]{2}"/);
let braceCount = 0;
for (let i = startIndex; i < html.length; i++) {
  if (html[i] === '{') braceCount++;
  if (html[i] === '}') braceCount--;
  if (braceCount === 0) break;
}
```

#### 5. Dynamic JavaScript Applications (SSPRD)
**Approach:** Server-side rendered data extraction  
**Challenges:**
- JavaScript variable extraction from HTML
- Multi-facility data aggregation
- Facility ID to rink mapping
- Event categorization without explicit tags

**Solutions:**
- Regex extraction of `_onlineScheduleList` JavaScript array
- Facility-based event routing and aggregation
- Custom facility metadata for each location
- Heuristic event categorization

### Common Parsing Challenges

#### Timezone Handling
**Problem:** Websites assume local timezone (Mountain Time) but don't specify  
**Solution:** Standardized UTC conversion in ScraperHelpers
```typescript
static parseMountainTime(dateStr: string, timeStr: string): Date {
  // Convert MT to UTC by adding 6-7 hours depending on DST
}
```

#### Event Categorization
**Problem:** Inconsistent event naming across venues  
**Solution:** Shared categorization logic with keyword matching
```typescript
static categorizeEvent(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('public') || lower.includes('open')) return 'Public Skate';
  if (lower.includes('hockey')) return 'Hockey';
  // ... more patterns
}
```

#### HTML Cleanup
**Problem:** Event descriptions contain HTML tags and entities  
**Solution:** Progressive HTML cleaning with essential info preservation
```typescript
private cleanHtmlDescription(htmlDescription: string): string {
  return htmlDescription
    .replace(/&amp;/g, '&')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<[^>]*>/g, '')  // Remove all tags
    .replace(/\n{3,}/g, '\n\n'); // Collapse newlines
}
```

### Reliability Patterns

#### Error Handling & Retries
- **Graceful degradation** when individual scrapers fail
- **Specific error logging** for debugging different website issues
- **Automatic retry logic** with exponential backoff (planned)
- **Fallback parsing methods** when primary extraction fails

#### Rate Limiting Protection
- **Random splay delays** (0-360 minutes default) to avoid detection
- **Respectful User-Agent strings** mimicking real browsers
- **Configurable timing** via environment variables
- **Distributed scheduling** via Durable Objects

#### Data Validation
- **Event date filtering** (next 30 days only)
- **Duplicate removal** across multiple data sources
- **Required field validation** (title, start/end times)
- **Timezone consistency** (all stored as UTC)

### Performance Optimizations

#### Parsing Efficiency
- **Regex-based extraction** instead of full DOM parsing where possible
- **Stream processing** for large data sets
- **Early termination** on parsing errors
- **Minimal memory allocation** in Workers environment

#### Caching Strategy
- **KV storage** for globally distributed event data
- **Metadata separation** for status and error information
- **Incremental updates** rather than full rebuilds
- **Edge caching** via Cloudflare infrastructure

### Development Best Practices

#### Debugging Techniques
1. **Comprehensive logging** with emoji prefixes for easy identification
2. **HTML snapshot saving** during development for offline testing
3. **Response validation** to catch API changes early
4. **Error context preservation** for remote debugging

#### Testing Strategies
1. **Local HTML files** for testing parsing logic
2. **Mock data generation** for consistent testing
3. **Integration tests** with real endpoints (limited)
4. **Fallback validation** ensuring robustness

#### Maintainability Patterns
1. **Shared helper functions** for common operations
2. **Consistent error handling** across all scrapers
3. **Configuration externalization** via environment variables
4. **Clear separation** between parsing and scheduling logic

### Website-Specific Gotchas

#### Ice Ranch (RSS)
- RSS feed sometimes includes HTML in descriptions requiring cleaning
- Event tags are encoded as URL parameters, not in RSS categories
- Date formats inconsistent between title and pubDate fields

#### Big Bear (API)
- API returns times in Mountain Time but parses as UTC
- Complex reservation type system requiring specific ID mapping
- Resource allocation affects which events are visible

#### DU Ritchie (iCal)
- Multiple calendars require aggregation and deduplication
- HTML descriptions need aggressive cleaning for mobile display
- Basketball events mixed with ice events requiring filtering

#### Foothills Edge (JavaScript)
- Event data embedded in page JavaScript, not API
- Time formats vary between "12:00 PM" and "12:00PM"
- Calendar system occasionally changes JavaScript structure

#### SSPRD (Dynamic)
- Multi-facility site requiring event routing by facility ID
- JavaScript variables change names between updates
- Event names often include program codes requiring cleanup

These lessons learned have shaped the robust, maintainable scraping architecture that can adapt to website changes and handle edge cases gracefully.

---

🏒 Built with ❤️ for the Denver hockey community  
© 2025 Denver Rink Schedule Viewer