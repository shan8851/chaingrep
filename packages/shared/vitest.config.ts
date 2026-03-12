import { defineConfig } from "vitest/config";

export const config = defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});

export default config;
