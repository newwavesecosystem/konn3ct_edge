import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts', './test/setup.ts'],
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/.next/**', 
      '**/frontend/e2e/**', 
      '**/*.spec.ts' // Playwright tests use spec.ts, Vitest will use test.ts
    ],
    include: ['test/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
