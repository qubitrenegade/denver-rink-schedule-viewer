# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
bun install              # Install dependencies
bun run dev             # Start frontend dev server (localhost:5173)
./scripts/dev-workers.sh # Start all backend workers for development
```

### Testing
```bash
bun test               # Run frontend tests
bun test:watch         # Run tests in watch mode
./scripts/dev-workers.sh --test  # Start workers and run endpoint tests
```

### Build & Deploy
```bash
bun run build         # Build frontend for production
wrangler deploy --config wrangler-scheduler.toml  # Deploy centralized scheduler
wrangler deploy --config wrangler.toml            # Deploy data API
```

## Architecture Overview

This is a Denver ice rink schedule aggregation system with React frontend and Cloudflare Workers backend.

### Key Architectural Patterns

**Centralized Scheduler**: Uses a single cron-triggered scheduler worker to orchestrate all scraper workers, bypassing Cloudflare's 5-cron limit. The scheduler (`workers/scheduler.ts`) calls individual scrapers via HTTP.

**Durable Objects Pattern**: All scrapers use `ScraperHelpers` for consistent scheduling with random splay delays to avoid rate limiting. Each scraper has its own Durable Object for state management.

**Data Flow**: Scrapers → KV Storage → Data API → Frontend. Events are stored in KV with metadata separate from event data.

**Multi-Rink Support**: Some facilities have multiple rinks (e.g., Big Bear North/South, SSPRD facilities). Configuration in `workers/shared/rink-config.ts` handles both individual rinks and facility groupings.

### Frontend Architecture

- **Custom Hooks**: `useEventData.ts` (data fetching), `useEventFiltering.ts` (filtering logic), `useUrlState.ts` (URL sync)
- **Modular Components**: Filter components in `src/components/` with consistent patterns
- **Type System**: Shared types in `src/types.ts` and `workers/shared/rink-config.ts`

### Backend Workers

- `workers/scheduler.ts` - Single cron trigger, manages all scrapers
- `workers/data-api.ts` - Serves aggregated data from KV storage  
- `workers/scrapers/*.ts` - Individual rink scrapers with diverse parsing strategies
- `workers/helpers/scraper-helpers.ts` - Shared utilities and Durable Object patterns

## Configuration Files

- Multiple `wrangler-*.toml` files for different workers
- Only `wrangler-scheduler.toml` has cron triggers
- Individual scrapers are deployed without cron, managed by scheduler
- Environment variables: `SCRAPER_SPLAY_MINUTES` for timing randomization

## Adding New Rinks

1. Create scraper in `workers/scrapers/new-rink.ts`
2. Create `wrangler-new-rink.toml` (no cron triggers)
3. Add to `SCRAPER_ENDPOINTS` in `wrangler-scheduler.toml`
4. Add configuration to `workers/shared/rink-config.ts`
5. Deploy scraper and redeploy scheduler

## Scraping Strategies

The codebase handles diverse data sources:
- **RSS feeds** (Ice Ranch) - XML parsing with timezone conversion
- **HTML APIs** (Big Bear) - Form POST with timezone correction
- **iCal feeds** (DU Ritchie) - Custom iCal parser with line folding
- **JavaScript extraction** (Foothills Edge) - Regex-based object extraction
- **Dynamic HTML** (SSPRD) - Multi-facility data aggregation

All use `ScraperHelpers.parseMountainTime()` for consistent UTC conversion and `ScraperHelpers.categorizeEvent()` for standardized event types.

## Development Workflow

Use `./scripts/dev-workers.sh` for local development - it starts all workers on different ports with comprehensive logging and testing capabilities. The script supports filtering workers with `--include`/`--exclude` patterns.

Frontend connects to `localhost:8787` for development API endpoints. Production uses `api.geticeti.me`.