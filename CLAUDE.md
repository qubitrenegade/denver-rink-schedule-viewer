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

- **Custom Hooks**: 
  - `useEventData.ts` (data fetching with 5-minute caching)
  - Modular filtering hooks: `useDateFiltering.ts`, `useTimeFiltering.ts`, `useRinkFiltering.ts`, `useCategoryFiltering.ts`, `useEventDeduplication.ts`
  - `useUrlState.ts` (URL sync)
- **Modular Components**: 
  - Filter components in `src/components/` with consistent patterns
  - Header components: `AppHeader.tsx`, `HeaderActions.tsx`, `StatusIndicator.tsx`
- **Utilities**: `src/utils/constants.ts` (shared constants), `src/utils/filterUtils.ts` (filter utilities)
- **Type System**: Shared types in `src/types.ts` and `workers/shared/rink-config.ts`

### PWA Implementation

- **Full offline support** with service worker (`public/sw.js`)
- **Web app manifest** (`public/manifest.json`) with proper icons and shortcuts
- **Smart install button** that only appears when app is installable (Chrome/Edge)
- **Background sync** for fresh data updates while app is cached
- **Cross-browser compatibility** (gracefully handles Firefox's limited PWA support)
- **Icons**: Generated from `favicon.ico` → `icon-192x192.png`, `icon-512x512.png`

### Backend Workers

- `workers/scheduler.ts` - Single cron trigger, manages all scrapers
- `workers/data-api.ts` - Serves aggregated data from KV storage with HTTP caching
- `workers/scrapers/*.ts` - Individual rink scrapers with diverse parsing strategies
- `workers/helpers/scraper-helpers.ts` - Shared utilities and Durable Object patterns
- `workers/shared/constants.ts` - Centralized constants (facility IDs, CORS headers, cache durations)

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

## Code Quality & Patterns

### Recent Improvements (Latest Session)
- **Hook Refactoring**: Split large `useEventFiltering` into 5 focused hooks for better maintainability
- **Constants Centralization**: Moved facility IDs, CORS headers, and config to shared utilities
- **Component Extraction**: Broke down large components into focused, reusable pieces
- **PWA Architecture**: Full offline-first Progressive Web App implementation

### Important Notes
- **PWA Testing**: Must access via `localhost:5173` (not IP address) for proper PWA functionality
- **Install Button Logic**: Only shows when Chrome/Edge fires `beforeinstallprompt` event
- **Firefox Handling**: PWA features gracefully degrade (no install button, but app still works)
- **Service Worker**: Implements stale-while-revalidate caching strategy for optimal UX