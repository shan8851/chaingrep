import { createApp } from "./createApp";
import { readApiEnv } from "./env";
import { createRateLimiter } from "./rateLimiter";

export default {
  fetch(request: Request, cfEnv: Record<string, unknown>): Response | Promise<Response> {
    const apiEnv = readApiEnv(cfEnv);
    const rateLimiter = createRateLimiter({
      maxQueriesPerWindow: apiEnv.SAMPLE_QUERY_LIMIT,
      windowMs: apiEnv.SAMPLE_RATE_WINDOW_MS
    });
    const app = createApp(apiEnv, rateLimiter);

    return app.fetch(request);
  }
};
