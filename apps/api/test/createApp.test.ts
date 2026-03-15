import { describe, expect, it } from "vitest";

import { createApp } from "../src/createApp";
import { createRateLimiter } from "../src/rateLimiter";

const apiEnvFixture = {
  OPENROUTER_MODEL: "google/gemini-2.0-flash-001",
  PORT: 8787,
  SAMPLE_MAX_BLOCK_SPAN: 10_000,
  SAMPLE_MAX_LOGS: 2_000,
  SAMPLE_QUERY_LIMIT: 10,
  SAMPLE_RATE_WINDOW_MS: 900_000
} as const;

const createParseTestApp = () =>
  createApp(apiEnvFixture, {
    parseQueryLimiter: createRateLimiter({
      maxRequestsPerWindow: 5,
      maxWindowRequestMessage: "Parse rate limit hit",
      windowMs: 900_000
    }),
    sampleQueryLimiter: createRateLimiter({
      maxActiveRequests: 1,
      maxRequestsPerWindow: 10,
      windowMs: 900_000
    })
  });

describe("createApp", () => {
  it("rate limits parse-query requests by IP", async () => {
    const app = createParseTestApp();
    const requestHeaders = new Headers({
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.8"
    });

    const successfulResponses = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.request("/api/parse-query", {
          body: JSON.stringify({
            chainId: 1,
            query: "USDC transfers over 1M on Ethereum in the last 24 hours"
          }),
          headers: requestHeaders,
          method: "POST"
        })
      )
    );

    expect(successfulResponses.every((response) => response.status === 200)).toBe(true);

    const rateLimitedResponse = await app.request("/api/parse-query", {
      body: JSON.stringify({
        chainId: 1,
        query: "USDC transfers over 1M on Ethereum in the last 24 hours"
      }),
      headers: requestHeaders,
      method: "POST"
    });
    const responseBody = (await rateLimitedResponse.json()) as {
      error?: string;
    };

    expect(rateLimitedResponse.status).toBe(429);
    expect(responseBody.error).toContain("Parse rate limit hit");
  });
});
