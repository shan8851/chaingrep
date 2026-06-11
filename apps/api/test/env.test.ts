import { describe, expect, it } from "vitest";

import { getConfiguredSampleChainIds, getSampleRpcUrlForChain, readApiEnv } from "../src/env";

describe("api env helpers", () => {
  it("maps chain ids to chain-specific RPC URLs", () => {
    const apiEnv = readApiEnv({
      SAMPLE_BASE_RPC_URL: "https://base.example",
      SAMPLE_ETHEREUM_RPC_URL: "https://eth.example",
      SAMPLE_POLYGON_RPC_URL: "https://polygon.example",
      SAMPLE_SEPOLIA_RPC_URL: "https://sepolia.example"
    });

    expect(getSampleRpcUrlForChain(apiEnv, 1)).toBe("https://eth.example");
    expect(getSampleRpcUrlForChain(apiEnv, 8453)).toBe("https://base.example");
    expect(getSampleRpcUrlForChain(apiEnv, 137)).toBe("https://polygon.example");
    expect(getSampleRpcUrlForChain(apiEnv, 11155111)).toBe("https://sepolia.example");
  });

  it("returns the configured chain ids", () => {
    const apiEnv = readApiEnv({
      SAMPLE_BASE_RPC_URL: "https://base.example",
      SAMPLE_ETHEREUM_RPC_URL: "https://eth.example"
    });

    expect(getConfiguredSampleChainIds(apiEnv)).toEqual([1, 8453]);
  });

  it("applies the default OpenRouter model", () => {
    const apiEnv = readApiEnv({});

    expect(apiEnv.OPENROUTER_MODEL).toBe("google/gemini-2.0-flash-001");
  });
});
