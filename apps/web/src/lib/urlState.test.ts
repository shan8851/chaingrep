import { describe, expect, it } from "vitest";

import { parseQueryDraft, readUrlQueryDraft, serializeQueryInputForTransport } from "./urlState";

describe("url state", () => {
  it("reads URL params into a query draft", () => {
    const queryDraft = readUrlQueryDraft(
      "?chain=8453&mode=direct&address=0x0000000000000000000000000000000000000001&from=10&to=20&event=Transfer"
    );

    expect(queryDraft.chainId).toBe(8453);
    expect(queryDraft.mode).toBe("direct");
    expect(queryDraft.eventName).toBe("Transfer");
  });

  it("falls back to the default chain for unsupported chain ids", () => {
    const queryDraft = readUrlQueryDraft("?chain=999999&mode=sample");

    expect(queryDraft.chainId).toBe(1);
    expect(queryDraft.fromBlock).toBe("");
    expect(queryDraft.toBlock).toBe("");
  });

  it("parses a valid query draft into query input", () => {
    const queryInput = parseQueryDraft({
      chainId: 1,
      contractAddress: "0x0000000000000000000000000000000000000001",
      eventName: "",
      fromBlock: "100",
      mode: "sample",
      toBlock: "200"
    });

    expect(queryInput.fromBlock).toBe(100n);
    expect(queryInput.toBlock).toBe(200n);
  });

  it("requires a from block before parsing", () => {
    expect(() =>
      parseQueryDraft({
        chainId: 1,
        contractAddress: "0x0000000000000000000000000000000000000001",
        eventName: "",
        fromBlock: "",
        mode: "sample",
        toBlock: "200"
      })
    ).toThrow("From block is required.");
  });

  it("requires a to block before parsing", () => {
    expect(() =>
      parseQueryDraft({
        chainId: 1,
        contractAddress: "0x0000000000000000000000000000000000000001",
        eventName: "",
        fromBlock: "100",
        mode: "sample",
        toBlock: ""
      })
    ).toThrow("To block is required.");
  });

  it("serializes query input for transport without bigint values", () => {
    const serializedQueryInput = serializeQueryInputForTransport({
      chainId: 1,
      contractAddress: "0x0000000000000000000000000000000000000001",
      eventName: "Transfer",
      fromBlock: 100n,
      mode: "sample",
      toBlock: 200n
    });

    expect(serializedQueryInput.fromBlock).toBe("100");
    expect(serializedQueryInput.toBlock).toBe("200");
    expect(() => JSON.stringify(serializedQueryInput)).not.toThrow();
  });
});
