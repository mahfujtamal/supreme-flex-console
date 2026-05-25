import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: false,
  test: {
    globals: true,
    environment: 'node',
    env: {
      JWT_SECRET: 'test_jwt_secret_for_ci',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'clover'],
    },
  },
});
