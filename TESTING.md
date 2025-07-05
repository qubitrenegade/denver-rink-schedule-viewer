# Testing Guide

## Running Tests

### All Tests
```bash
bun run test
```

### CI-Optimized Tests (recommended for CI/CD)
```bash
bun run test:ci
```

### Critical Tests Only (recommended for PR checks)
```bash
bun run test:critical
```

### Timezone Tests (most important)
```bash
bun run test:timezone
```

### Watch Mode (for development)
```bash
bun run test:watch
```

### Parallel Test Safety Check
```bash
./scripts/test-parallel.sh
```

## Test Categories

### 🕐 Timezone Tests (`workers/scrapers/apex-ice.test.ts`, `workers/shared/timezone-utils.test.ts`)
**Critical for data accuracy** - These tests ensure that ice rink schedule times are converted correctly from Mountain Time to UTC and displayed properly.

**Key test**: "prevents midnight time display bug" - Ensures 5:30 AM MDT events don't show as 12:45 AM.

### 🛠️ Utility Tests (`src/utils/`, `workers/shared/`)
**Core functionality** - Tests for deduplication, regex patterns, and data filtering utilities.

### 🧪 Component Tests (`src/components/`, `src/hooks/`)
**UI functionality** - Tests for React components and hooks. Some may be flaky due to timing issues.

## CI/CD Integration

### GitHub Workflows

1. **PR Checks** (`.github/workflows/pr-checks.yml`)
   - Runs on every pull request
   - **Required tests must pass** before merge is allowed
   - Includes timezone verification and build checks

2. **General Tests** (`.github/workflows/test.yml`)
   - Runs on push to main branches
   - Comprehensive test coverage

### Branch Protection

To require tests before merging, add branch protection rules in GitHub:

1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable "Require status checks to pass before merging"
4. Select "required-checks" from PR Checks workflow

## Common Issues

### ❌ Test Cancellation Issues
**Problem**: Tests appear to be "failing" because they're being canceled for no apparent reason
**Root Cause**: GitHub Actions workflow with `cancel-in-progress: true` and overlapping test runs
**Solution**: 
- Disabled cancellation in PR workflow: `cancel-in-progress: false`
- Added dedicated `test:ci` command with CI-optimized Vitest configuration
- Eliminated overlapping test runs in the same workflow
- Added proper test isolation with `fileParallelism: false` and retry logic
**Test**: `./scripts/test-parallel.sh` should show parallel tests don't interfere

### ❌ "Midnight Time Bug"
**Problem**: Events showing at 12:45 AM instead of 5:30 AM
**Solution**: Use `ColoradoTimezone.parseMountainTime()` instead of `new Date()` + manual offset
**Test**: `bun run test:timezone` should pass

### ❌ Test Environment Issues
**Problem**: `document is not defined` or similar
**Solution**: Tests run in happy-dom environment - check `vitest.config.ts`

### ❌ Flaky Component Tests
**Problem**: React component tests timing out or failing intermittently
**Solution**: 
- Use `test:ci` command for CI environments (single-threaded, longer timeouts)
- Tests have retry logic built-in
- Sequential file execution prevents resource conflicts

## Writing New Tests

### For Timezone/Scraper Logic:
```typescript
import { ColoradoTimezone } from '../shared/timezone-utils';

test('converts time correctly', () => {
  const result = ColoradoTimezone.parseMountainTime('2024-07-15 05:30:00');
  expect(result.getUTCHours()).toBe(11); // 5:30 AM MDT = 11:30 AM UTC
});
```

### For Components:
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

test('renders correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

## Manual Testing

For manual verification of timezone fixes:
1. Check that events display at correct local times (not midnight)
2. Verify summer vs winter time handling (MDT vs MST)
3. Test with actual API data from scrapers

---

🏒 **Ready to develop your Android app!** The timezone handling is now robust and tested.