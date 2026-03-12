import { describe, expect, it } from "vitest";

import { createRateLimiter } from "../src/rateLimiter";

describe("createRateLimiter", () => {
  it("blocks concurrent queries from the same client", () => {
    const rateLimiter = createRateLimiter({
      maxQueriesPerWindow: 2,
      windowMs: 1_000
    });

    rateLimiter.begin("client-1");

    expect(() => rateLimiter.begin("client-1")).toThrow("already running");
  });

  it("enforces the window query limit", () => {
    const rateLimiter = createRateLimiter({
      maxQueriesPerWindow: 1,
      windowMs: 100_000
    });

    rateLimiter.begin("client-1");
    rateLimiter.finish("client-1");

    expect(() => rateLimiter.begin("client-1")).toThrow("limit reached");
  });
});
