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
- **TypeScript throughout** for type safety
- **Comprehensive documentation** in `refactor/` folder
- **Easy testing** with automated dev script

See the `refactor/` folder for detailed technical documentation and improvement roadmaps.

---

🏒 Built with ❤️ for the Denver hockey community  
© 2025 Denver Rink Schedule Viewer