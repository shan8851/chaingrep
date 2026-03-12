import { describe, expect, it, vi } from "vitest";

import { extractEventOptions, parseManualAbi, resolveContractAbi } from "../src/lib/abi";

const transferAbiJson = JSON.stringify([
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "Transfer",
    type: "event"
  }
]);

describe("abi helpers", () => {
  it("parses a manual ABI and extracts event names", () => {
    const parsedAbi = parseManualAbi(transferAbiJson);

    expect(extractEventOptions(parsedAbi)).toEqual(["Transfer"]);
  });

  it("prefers manual ABI when provided", async () => {
    const resolvedAbi = await resolveContractAbi({
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      etherscanApiKey: "should-not-be-used",
      manualAbiText: transferAbiJson
    });

    expect(resolvedAbi.source).toBe("manual");
    expect(resolvedAbi.eventOptions).toEqual(["Transfer"]);
  });

  it("falls back from Sourcify to Etherscan", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "1",
            message: "OK",
            result: transferAbiJson
          })
        )
      );

    const resolvedAbi = await resolveContractAbi({
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      etherscanApiKey: "etherscan-key",
      fetchImplementation
    });

    expect(resolvedAbi.source).toBe("etherscan");
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
  });
});
