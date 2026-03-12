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
const rateLimiter = createRateLimiter({
  maxQueriesPerWindow: apiEnv.SAMPLE_QUERY_LIMIT,
  windowMs: apiEnv.SAMPLE_RATE_WINDOW_MS
});
const app = createApp(apiEnv, rateLimiter);

serve(
  {
    fetch: app.fetch,
    port: apiEnv.PORT
  },
  (serverInfo) => {
    console.log(`Chaingrep sample API listening on http://localhost:${serverInfo.port}`);
  }
);
