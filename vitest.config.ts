import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'html'],
    },
    // Prevent test cancellation issues
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Add timeouts to prevent hanging tests
    testTimeout: 30000,
    hookTimeout: 30000,
    // Retry flaky tests once
    retry: 1,
    // Run tests sequentially for better stability
    fileParallelism: false,
    // Don't exit on test failure in watch mode
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': '.',
    },
  },
});
