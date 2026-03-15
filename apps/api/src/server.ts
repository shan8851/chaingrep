import { resolve } from "node:path";
import { existsSync } from "node:fs";

import { serve } from "@hono/node-server";
import { config } from "dotenv";

import { createApp } from "./createApp";
import { readApiEnv } from "./env";
import { createRateLimiter } from "./rateLimiter";

const localApiEnvPath = resolve(import.meta.dirname, "../.env");
const rootEnvPath = resolve(import.meta.dirname, "../../.env");

if (existsSync(localApiEnvPath)) {
  config({
    path: localApiEnvPath
  });
}

if (existsSync(rootEnvPath)) {
  config({
    path: rootEnvPath
  });
}

const apiEnv = readApiEnv();
const app = createApp(apiEnv, {
  parseQueryLimiter: createRateLimiter({
    maxRequestsPerWindow: 5,
    maxWindowRequestMessage:
      "Parse rate limit hit. Try again in a few minutes or use the manual query builder.",
    windowMs: 900_000
  }),
  sampleQueryLimiter: createRateLimiter({
    activeRequestMessage:
      "A query is already running. Wait for it to finish or cancel it.",
    maxActiveRequests: 1,
    maxRequestsPerWindow: apiEnv.SAMPLE_QUERY_LIMIT,
    maxWindowRequestMessage: "Rate limit hit. Add your own RPC for unlimited queries.",
    windowMs: apiEnv.SAMPLE_RATE_WINDOW_MS
  })
});

serve(
  {
    fetch: app.fetch,
    port: apiEnv.PORT
  },
  (serverInfo) => {
    console.log(`chaingrep API listening on http://localhost:${serverInfo.port}`);
  }
);
