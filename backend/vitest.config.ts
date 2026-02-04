import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30000,
    env: {
      DATABASE_URL: 'postgresql://hilt:localdev@localhost:5433/hilt_review',
    },
  },
});
