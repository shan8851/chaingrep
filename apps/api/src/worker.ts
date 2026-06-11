import { createApp } from "./createApp";
import { readApiEnv } from "./env";
import { createRateLimiter } from "./rateLimiter";

const workerAppCache = new Map<string, ReturnType<typeof createApp>>();

const getWorkerCacheKey = (environment: Record<string, unknown>): string =>
  JSON.stringify(environment);

export default {
  fetch(request: Request, cfEnv: Record<string, unknown>): Response | Promise<Response> {
    const cacheKey = getWorkerCacheKey(cfEnv);
    const cachedApp = workerAppCache.get(cacheKey);

    if (cachedApp) {
      return cachedApp.fetch(request);
    }

    const apiEnv = readApiEnv(cfEnv);
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

    workerAppCache.set(cacheKey, app);

    return app.fetch(request);
  }
};
