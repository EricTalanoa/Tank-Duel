import { defineConfig } from 'vitest/config';

export default defineConfig({
  // spec/*.json lives beside src/ and is imported directly by sim/constants.ts.
  // Keeping the Vite root at the project root is what makes that import legal.
  //
  // The shell icons live under `public/assets/icons/` so they are copied into the build
  // verbatim at the exact URLs `spec/shells.json` declares. They were served straight off
  // disk in dev and silently missing from `npm run build` before that.
  publicDir: 'public',
  build: { target: 'es2022' },
  test: {
    // Headless by design: sim/ is pure, so no browser environment is ever needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
