/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true
  },
});

// Common configuration for both environments
export const commonConfig = {
  globals: true,
  coverage: {
    provider: 'v8' as const,
    reporter: ['text', 'json', 'html'],
    exclude: ['node_modules/**', 'dist/**', '**/*.spec.{js,ts,jsx,tsx}'],
  },
  testTimeout: 10_000,
  hookTimeout: 10_000,
  isolate: true,
  env: {
    NODE_ENV: 'test',
  },
  
};
