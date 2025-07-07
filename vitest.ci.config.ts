import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'html'],
    },
    // CI-specific settings to prevent cancellations
    poolOptions: {
      threads: {
        singleThread: true,  // Single-threaded for CI stability
        maxThreads: 1,
        minThreads: 1,
      },
    },
    // Longer timeouts for CI
    testTimeout: 60000,
    hookTimeout: 60000,
    // Retry flaky tests in CI
    retry: 2,
    // Run tests in sequence for better stability
    fileParallelism: false,
    // More verbose output for CI
    reporter: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results.xml',
    },
  },
  resolve: {
    alias: {
      '@': '.',
    },
  },
});