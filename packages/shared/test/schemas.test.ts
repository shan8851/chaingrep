import { describe, expect, it } from "vitest";

import { queryInputSchema } from "../src/lib/schemas";

describe("queryInputSchema", () => {
  it("rejects unsupported chain ids", () => {
    expect(() =>
      queryInputSchema.parse({
        chainId: 999999,
        contractAddress: "0x0000000000000000000000000000000000000001",
        fromBlock: "1",
        toBlock: "2",
        mode: "direct"
      })
    ).toThrow();
  });
});
