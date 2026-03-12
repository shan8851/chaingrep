import { describe, expect, it } from "vitest";

import { detectProviderProfile } from "../src/lib/providerProfiles";

describe("provider profiles", () => {
  it("detects Chainnodes URLs", () => {
    const providerProfile = detectProviderProfile("https://mainnet.chainnodes.org/example");

    expect(providerProfile.label).toBe("Chainnodes");
    expect(providerProfile.concurrency).toBe(2);
    expect(providerProfile.initialChunkSize).toBe(2000);
  });

  it("falls back for unknown providers", () => {
    const providerProfile = detectProviderProfile("https://rpc.example.com");

    expect(providerProfile.label).toBe("Custom RPC");
    expect(providerProfile.minChunkSize).toBe(50);
  });
});
