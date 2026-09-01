import { defineConfig } from 'vitest/config';

export default defineConfig({
  // spec/*.json lives beside src/ and is imported directly by sim/constants.ts.
  // Keeping the Vite root at the project root is what makes that import legal.
  build: { target: 'es2022' },
  test: {
    // Headless by design: sim/ is pure, so no browser environment is ever needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
