import { describe, expect, it } from "vitest";

import { createRateLimiter } from "../src/rateLimiter";

describe("createRateLimiter", () => {
  it("blocks concurrent queries from the same client", () => {
    const rateLimiter = createRateLimiter({
      activeRequestMessage: "already running",
      maxActiveRequests: 1,
      maxRequestsPerWindow: 2,
      windowMs: 1_000
    });

    rateLimiter.begin("client-1");

    expect(() => rateLimiter.begin("client-1")).toThrow("already running");
  });

  it("enforces the window query limit", () => {
    const rateLimiter = createRateLimiter({
      maxRequestsPerWindow: 1,
      maxWindowRequestMessage: "Rate limit hit",
      windowMs: 100_000
    });

    rateLimiter.begin("client-1");
    rateLimiter.finish("client-1");

    expect(() => rateLimiter.begin("client-1")).toThrow("Rate limit hit");
  });
});
