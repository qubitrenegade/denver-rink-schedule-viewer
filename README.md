# Denver Rink Schedule Viewer

A modern web app and data pipeline for viewing and filtering public ice rink schedules in the Denver metro area.

## Features
- Fast, filterable schedule viewer for multiple rinks
- Modular React frontend with custom hooks and filter components
- Robust, modular TypeScript scrapers for each rink
- Per-rink JSON data files and metadata
- Mobile-friendly, accessible UI

## Installation

```bash
bun install
```

## Scraping Data

To fetch the latest rink schedules:

```bash
bun scrape                  # Scrape all rinks
dbun scrape:ice-ranch        # Scrape only Ice Ranch
bun scrape:big-bear          # Scrape only Big Bear
# ...and so on for other rinks
```

Advanced: You can also run the underlying script directly:

```bash
bun run scripts/scraper.ts --rink <rink-id>
```

Scraped data is saved to `public/data/{rink}.json` and metadata to `public/data/{rink}-metadata.json`.

## Running the App

```bash
bun run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

- `src/` — React app source code
  - `App.tsx` — Main app entry, now minimal and composed of modular components
  - `components/` — Filter controls, event list, tabs, error boundary, etc.
  - `hooks/` — Custom hooks for event data, filtering, and URL state
  - `rinkConfig.ts` — Rink metadata/configuration
  - `types.ts` — Shared type definitions
- `scripts/` — Scraper and data pipeline scripts
  - `scraper.ts` — Orchestrates all rink scrapes
  - `rinks/` — Individual rink scrapers (e.g. `ice-ranch.ts`, `big-bear.ts`)
  - `base-scraper.ts` — Shared scraper base class/utilities
- `public/data/` — Output JSON data and metadata for each rink
- `refactor/` — Documentation and roadmap for ongoing improvements

## Development

- Modular, maintainable codebase (see `refactor/` docs for roadmap)
- TypeScript throughout (frontend and scrapers)
- Linting and type checks enabled
- Easy to add new rinks: just add a new scraper in `scripts/rinks/`

## Testing

- (TODO) Add tests for filter components and custom hooks
- (TODO) Add end-to-end tests for scrapers

## Contributing

Contributions and bug reports are welcome! See the `refactor/` folder for design notes and improvement plans.

---

© 2025 Denver Rink Schedule Viewer