import { describe, expect, it } from "vitest";

import { findKnownContract } from "../src/lib/contractRegistry";

describe("findKnownContract", () => {
  it("matches aliases case-insensitively", () => {
    const knownContract = findKnownContract("show me circle usdc transfers", 1);

    expect(knownContract?.name).toBe("USDC");
    expect(knownContract?.chainId).toBe(1);
  });

  it("respects the chain hint when aliases exist on multiple chains", () => {
    const knownContract = findKnownContract("usdc transfers", 8453);

    expect(knownContract?.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });

  it("returns null when nothing matches", () => {
    expect(findKnownContract("totally unknown protocol", 1)).toBeNull();
  });
});
