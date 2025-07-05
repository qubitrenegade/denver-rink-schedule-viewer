// Vitest setup file for React Testing Library
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import '@testing-library/jest-dom';

// Extend Vitest's expect with React Testing Library matchers
expect.extend(matchers);

// Set up the React environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Clean up after each test
afterEach(() => {
  cleanup();
});
