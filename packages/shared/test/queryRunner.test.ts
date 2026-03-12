import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  toHex
} from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runLogQuery } from "../src/lib/queryRunner";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const transferAbi = [transferEvent];
const fromAddress = "0x0000000000000000000000000000000000000001";
const toAddress = "0x0000000000000000000000000000000000000002";
const defaultTransactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const alternateTransactionHash =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const blockHash = "0x2222222222222222222222222222222222222222222222222222222222222222";

type JsonRpcRequest = {
  id: number;
  method: string;
  params: unknown[];
};

type DeferredResponse = {
  resolve: () => void;
  requestedRange: string;
};

const createJsonRpcSuccessResponse = (requestId: number, result: unknown): Response =>
  new Response(
    JSON.stringify({
      id: requestId,
      jsonrpc: "2.0",
      result
    })
  );

const createJsonRpcErrorResponse = (requestId: number, message: string): Response =>
  new Response(
    JSON.stringify({
      id: requestId,
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message
      }
    }),
    {
      status: 400
    }
  );

const parseJsonRpcRequest = (init: RequestInit | undefined): JsonRpcRequest => {
  if (typeof init?.body !== "string") {
    throw new Error("Expected the RPC request body to be a JSON string.");
  }

  return JSON.parse(init.body) as JsonRpcRequest;
};

const createTransferRpcLog = (
  blockNumber: bigint,
  transactionHash: string = defaultTransactionHash
): {
  address: string;
  blockHash: string;
  blockNumber: string;
  data: `0x${string}`;
  logIndex: string;
  removed: boolean;
  topics: ReturnType<typeof encodeEventTopics>;
  transactionHash: string;
  transactionIndex: string;
} => ({
  address: "0x00000000000000000000000000000000000000aa",
  blockHash,
  blockNumber: toHex(blockNumber),
  data: encodeAbiParameters([{ type: "uint256" }], [blockNumber]),
  logIndex: "0x0",
  removed: false,
  topics: encodeEventTopics({
    abi: transferAbi,
    eventName: "Transfer",
    args: {
      from: fromAddress,
      to: toAddress
    }
  }),
  transactionHash,
  transactionIndex: "0x0"
});

const waitForCondition = async (
  condition: () => void,
  attempts: number = 50
): Promise<void> => {
  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    try {
      condition();
      return;
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  condition();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runLogQuery", () => {
  it("queries logs, decodes events, and respects adaptive chunking", async () => {
    let getLogCallCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((_input, init) => {
        const jsonRpcRequest = parseJsonRpcRequest(init);

        if (jsonRpcRequest.method === "eth_chainId") {
          return Promise.resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, "0x1"));
        }

        if (jsonRpcRequest.method === "eth_getLogs") {
          getLogCallCount += 1;
          const [filterObject] = jsonRpcRequest.params as Array<{
            fromBlock?: string;
            toBlock?: string;
          }>;

          if (!filterObject) {
            throw new Error("Expected an eth_getLogs filter object.");
          }

          const fromBlock = BigInt(filterObject.fromBlock ?? "0x0");
          const toBlock = BigInt(filterObject.toBlock ?? "0x0");
          const result =
            fromBlock <= 16n && toBlock >= 16n ? [createTransferRpcLog(16n)] : [];

          return Promise.resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, result));
        }

        return Promise.resolve(
          createJsonRpcErrorResponse(
            jsonRpcRequest.id,
            `Unsupported method ${jsonRpcRequest.method}`
          )
        );
      })
    );

    const queryResult = await runLogQuery({
      abi: transferAbi,
      queryInput: {
        chainId: 1,
        contractAddress: "0x00000000000000000000000000000000000000aa",
        fromBlock: 1n,
        toBlock: 600n,
        eventName: "Transfer",
        mode: "direct"
      },
      rpcUrl: "https://rpc.example.com"
    });

    expect(queryResult.totalDecoded).toBe(1);
    expect(queryResult.logs[0]?.eventName).toBe("Transfer");
    expect(queryResult.logs[0]?.decodedArgs[2]?.value).toBe("16");
    expect(getLogCallCount).toBeGreaterThanOrEqual(2);
  });

  it("runs Chainnodes chunks in parallel and sorts completed logs deterministically", async () => {
    const requestedRanges: string[] = [];
    const deferredResponses: DeferredResponse[] = [];
    let activeGetLogsCallCount = 0;
    let maxConcurrentGetLogsCallCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((_input, init) => {
        const jsonRpcRequest = parseJsonRpcRequest(init);

        if (jsonRpcRequest.method === "eth_chainId") {
          return Promise.resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, "0x1"));
        }

        if (jsonRpcRequest.method !== "eth_getLogs") {
          return Promise.resolve(
            createJsonRpcErrorResponse(
              jsonRpcRequest.id,
              `Unsupported method ${jsonRpcRequest.method}`
            )
          );
        }

        const [filterObject] = jsonRpcRequest.params as Array<{
          fromBlock?: string;
          toBlock?: string;
        }>;

        if (!filterObject) {
          throw new Error("Expected an eth_getLogs filter object.");
        }

        const fromBlock = BigInt(filterObject.fromBlock ?? "0x0");
        const toBlock = BigInt(filterObject.toBlock ?? "0x0");
        const requestedRange = `${fromBlock}-${toBlock}`;
        const result =
          requestedRange === "1-2000"
            ? [createTransferRpcLog(16n, defaultTransactionHash)]
            : [createTransferRpcLog(4000n, alternateTransactionHash)];

        requestedRanges.push(requestedRange);
        activeGetLogsCallCount += 1;
        maxConcurrentGetLogsCallCount = Math.max(
          maxConcurrentGetLogsCallCount,
          activeGetLogsCallCount
        );

        return new Promise((resolve) => {
          deferredResponses.push({
            requestedRange,
            resolve: () => {
              activeGetLogsCallCount -= 1;
              resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, result));
            }
          });
        });
      })
    );

    const queryPromise = runLogQuery({
      abi: transferAbi,
      queryInput: {
        chainId: 1,
        contractAddress: "0x00000000000000000000000000000000000000aa",
        fromBlock: 1n,
        toBlock: 4000n,
        eventName: "Transfer",
        mode: "direct"
      },
      rpcUrl: "https://mainnet.chainnodes.org/example"
    });

    await waitForCondition(() => {
      expect(deferredResponses).toHaveLength(2);
    });

    expect(requestedRanges).toEqual(["1-2000", "2001-4000"]);

    deferredResponses.find(({ requestedRange }) => requestedRange === "2001-4000")?.resolve();
    deferredResponses.find(({ requestedRange }) => requestedRange === "1-2000")?.resolve();

    const queryResult = await queryPromise;

    expect(maxConcurrentGetLogsCallCount).toBe(2);
    expect(queryResult.logs.map(({ blockNumber }) => blockNumber)).toEqual(["16", "4000"]);
    expect(queryResult.logs.map(({ transactionHash }) => transactionHash)).toEqual([
      defaultTransactionHash,
      alternateTransactionHash
    ]);
  });

  it("retries shrinkable Chainnodes chunks without losing coverage", async () => {
    const requestedRanges: string[] = [];
    let resolveSecondRange: (() => void) | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((_input, init) => {
        const jsonRpcRequest = parseJsonRpcRequest(init);

        if (jsonRpcRequest.method === "eth_chainId") {
          return Promise.resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, "0x1"));
        }

        if (jsonRpcRequest.method !== "eth_getLogs") {
          return Promise.resolve(
            createJsonRpcErrorResponse(
              jsonRpcRequest.id,
              `Unsupported method ${jsonRpcRequest.method}`
            )
          );
        }

        const [filterObject] = jsonRpcRequest.params as Array<{
          fromBlock?: string;
          toBlock?: string;
        }>;

        if (!filterObject) {
          throw new Error("Expected an eth_getLogs filter object.");
        }

        const fromBlock = BigInt(filterObject.fromBlock ?? "0x0");
        const toBlock = BigInt(filterObject.toBlock ?? "0x0");
        const requestedRange = `${fromBlock}-${toBlock}`;

        requestedRanges.push(requestedRange);

        if (requestedRange === "1-2000") {
          return Promise.resolve(
            createJsonRpcErrorResponse(jsonRpcRequest.id, "block range exceeded")
          );
        }

        if (requestedRange === "2001-4000") {
          return new Promise((resolve) => {
            resolveSecondRange = () => {
              resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, []));
            };
          });
        }

        if (requestedRange === "1-1000") {
          return Promise.resolve(
            createJsonRpcSuccessResponse(jsonRpcRequest.id, [createTransferRpcLog(16n)])
          );
        }

        if (requestedRange === "1001-2000") {
          return Promise.resolve(
            createJsonRpcSuccessResponse(jsonRpcRequest.id, [createTransferRpcLog(1500n)])
          );
        }

        throw new Error(`Unexpected block range ${requestedRange}`);
      })
    );

    const queryPromise = runLogQuery({
      abi: transferAbi,
      queryInput: {
        chainId: 1,
        contractAddress: "0x00000000000000000000000000000000000000aa",
        fromBlock: 1n,
        toBlock: 4000n,
        eventName: "Transfer",
        mode: "direct"
      },
      rpcUrl: "https://mainnet.chainnodes.org/example"
    });

    await waitForCondition(() => {
      expect(requestedRanges).toContain("1-1000");
    });

    resolveSecondRange?.();

    const queryResult = await queryPromise;

    expect(requestedRanges).toEqual(["1-2000", "2001-4000", "1-1000", "1001-2000"]);
    expect(queryResult.logs.map(({ blockNumber }) => blockNumber)).toEqual(["16", "1500"]);
  });

  it("shrinks a stale failed chunk from the chunk size it actually requested", async () => {
    const requestedRanges: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((_input, init) => {
        const jsonRpcRequest = parseJsonRpcRequest(init);

        if (jsonRpcRequest.method === "eth_chainId") {
          return Promise.resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, "0x1"));
        }

        if (jsonRpcRequest.method !== "eth_getLogs") {
          return Promise.resolve(
            createJsonRpcErrorResponse(
              jsonRpcRequest.id,
              `Unsupported method ${jsonRpcRequest.method}`
            )
          );
        }

        const [filterObject] = jsonRpcRequest.params as Array<{
          fromBlock?: string;
          toBlock?: string;
        }>;

        if (!filterObject) {
          throw new Error("Expected an eth_getLogs filter object.");
        }

        const fromBlock = BigInt(filterObject.fromBlock ?? "0x0");
        const toBlock = BigInt(filterObject.toBlock ?? "0x0");
        const requestedRange = `${fromBlock}-${toBlock}`;

        requestedRanges.push(requestedRange);

        if (requestedRange === "1-2000") {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                createJsonRpcErrorResponse(jsonRpcRequest.id, "response size exceeded")
              );
            }, 10);
          });
        }

        if (requestedRange === "2001-4000") {
          return Promise.resolve(createJsonRpcSuccessResponse(jsonRpcRequest.id, []));
        }

        if (requestedRange === "1-1000") {
          return Promise.resolve(
            createJsonRpcSuccessResponse(jsonRpcRequest.id, [createTransferRpcLog(16n)])
          );
        }

        if (requestedRange === "1001-2000") {
          return Promise.resolve(
            createJsonRpcSuccessResponse(jsonRpcRequest.id, [createTransferRpcLog(1500n)])
          );
        }

        throw new Error(`Unexpected block range ${requestedRange}`);
      })
    );

    const queryResult = await runLogQuery({
      abi: transferAbi,
      queryInput: {
        chainId: 1,
        contractAddress: "0x00000000000000000000000000000000000000aa",
        fromBlock: 1n,
        toBlock: 4000n,
        eventName: "Transfer",
        mode: "direct"
      },
      rpcUrl: "https://mainnet.chainnodes.org/example"
    });

    expect(requestedRanges.filter((requestedRange) => requestedRange === "1-2000")).toHaveLength(
      1
    );
    expect(requestedRanges).toContain("1-1000");
    expect(requestedRanges).toContain("1001-2000");
    expect(queryResult.logs.map(({ blockNumber }) => blockNumber)).toEqual(["16", "1500"]);
  });

  it("rejects queries that exceed the enforced block span", async () => {
    await expect(
      runLogQuery({
        queryInput: {
          chainId: 1,
          contractAddress: "0x00000000000000000000000000000000000000aa",
          fromBlock: 1n,
          toBlock: 600n,
          mode: "sample"
        },
        maxBlockSpan: 200,
        rpcUrl: "https://rpc.example.com"
      })
    ).rejects.toThrow("200");
  });
});
