import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    test: {
      environment: "node",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      // Exclude Playwright E2E specs from vitest. They live under
      // tests/e2e/ and are picked up by `pnpm test:e2e` instead. Without
      // this exclude, vitest tries to run them as node tests and fails
      // because the @playwright/test `test`/`expect` globals don't exist
      // in the vitest environment.
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/tests/e2e/**",
        "playwright-report/**",
        "test-results/**",
      ],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  };
});
