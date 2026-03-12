import { getChainConfig, queryInputSchema, runLogQuery } from "@chaingrep/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import type { Abi } from "viem";
import { getConfiguredSampleChainIds, getSampleRpcUrlForChain } from "./env";
import type { QueryStreamMessage } from "@chaingrep/shared";
import type { ApiEnv } from "./env";
import type { RateLimiter } from "./rateLimiter";

const sampleQueryRequestSchema = z.object({
  abi: z.array(z.unknown()).optional(),
  queryInput: queryInputSchema
});

type AppBindings = {
  Variables: {
    env: ApiEnv;
    rateLimiter: RateLimiter;
  };
};

const getClientIdentifier = (requestHeaders: Headers): string =>
  requestHeaders.get("cf-connecting-ip") ??
  requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

const encodeStreamMessage = (message: QueryStreamMessage): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(message)}\n`);

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown server error";

export const createApp = (environment: ApiEnv, rateLimiter: RateLimiter): Hono<AppBindings> => {
  const app = new Hono<AppBindings>();

  app.use(
    "*",
    cors({
      allowHeaders: ["content-type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      origin: environment.CORS_ORIGIN ?? "*"
    })
  );

  app.use("*", async (context, next) => {
    context.set("env", environment);
    context.set("rateLimiter", rateLimiter);
    await next();
  });

  app.get("/health", (context) =>
    context.json({
      configuredSampleChains: getConfiguredSampleChainIds(context.var.env).map((chainId) => ({
        chainId,
        name: getChainConfig(chainId).name
      })),
      ok: true,
      timestamp: new Date().toISOString()
    })
  );

  app.post("/api/sample/query/stream", async (context) => {
    const requestBody = sampleQueryRequestSchema.parse(await context.req.json());
    const sampleRpcUrl = getSampleRpcUrlForChain(
      context.var.env,
      requestBody.queryInput.chainId
    );

    if (!sampleRpcUrl) {
      return context.json(
        {
          error: `Not configured for ${getChainConfig(requestBody.queryInput.chainId).name}. The operator needs to add an RPC URL in the API env.`
        },
        503
      );
    }

    const clientIdentifier = getClientIdentifier(context.req.raw.headers);

    try {
      context.var.rateLimiter.begin(clientIdentifier);
    } catch (error) {
      return context.json(
        {
          error: toMessage(error)
        },
        429
      );
    }

    const maxBlockSpan = Math.min(
      context.var.env.SAMPLE_MAX_BLOCK_SPAN,
      getChainConfig(requestBody.queryInput.chainId).sampleBlockSpan
    );
    const sharedAbi = requestBody.abi as Abi | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const closeStream = (): void => {
          controller.close();
          context.var.rateLimiter.finish(clientIdentifier);
        };
        const safeWrite = (message: QueryStreamMessage): void => {
          controller.enqueue(encodeStreamMessage(message));
        };

        void runLogQuery({
          ...(sharedAbi ? { abi: sharedAbi } : {}),
          maxBlockSpan,
          maxDecodedLogs: context.var.env.SAMPLE_MAX_LOGS,
          onProgress: (progressEvent) => {
            safeWrite({
              kind: "progress",
              progress: progressEvent
            });
          },
          queryInput: {
            ...requestBody.queryInput,
            mode: "sample"
          },
          rpcUrl: sampleRpcUrl,
          signal: context.req.raw.signal
        })
          .then((queryResult) => {
            safeWrite({
              kind: "result",
              result: queryResult
            });
            closeStream();
          })
          .catch((error) => {
            safeWrite({
              kind: "error",
              error: toMessage(error)
            });
            closeStream();
          });
      },
      cancel: () => {
        context.var.rateLimiter.finish(clientIdentifier);
      }
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/x-ndjson; charset=utf-8",
        "x-content-type-options": "nosniff"
      }
    });
  });

  return app;
};
