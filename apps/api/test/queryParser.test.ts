import { describe, expect, it, vi } from "vitest";

import { parseNaturalLanguageQuery } from "../src/queryParser";

const apiEnvFixture = {
  OPENROUTER_MODEL: "google/gemini-2.0-flash-001",
  PORT: 8787,
  SAMPLE_MAX_BLOCK_SPAN: 10_000,
  SAMPLE_MAX_LOGS: 2_000,
  SAMPLE_QUERY_LIMIT: 10,
  SAMPLE_RATE_WINDOW_MS: 900_000
} as const;

describe("parseNaturalLanguageQuery", () => {
  it("parses common token transfer queries locally from the contract registry", async () => {
    const parsedResponse = await parseNaturalLanguageQuery({
      apiEnv: apiEnvFixture,
      chainIdHint: 1,
      query: "USDC transfers over 1M on Ethereum in the last 24 hours"
    });

    expect(parsedResponse).toEqual({
      confidence: "high",
      contractName: "USDC",
      explanation: expect.stringContaining("Ethereum USDC Transfer"),
      params: {
        chainId: 1,
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventName: "Transfer",
        filters: [
          {
            argName: "value",
            operator: ">",
            value: "1000000000000"
          }
        ],
        fromBlock: "auto:24h",
        toBlock: "latest"
      },
      parsed: true
    });
  });

  it("returns a helpful failure when OpenRouter is required but unavailable", async () => {
    const parsedResponse = await parseNaturalLanguageQuery({
      apiEnv: apiEnvFixture,
      query: "Show swaps from 0x0000000000000000000000000000000000000001 on Base"
    });

    expect(parsedResponse).toEqual({
      parsed: false,
      reason: expect.stringContaining("OPENROUTER_API_KEY")
    });
  });

  it("validates and normalizes OpenRouter responses", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  confidence: "medium",
                  explanation: "Searching Base USDC transfers from a specific sender.",
                  params: {
                    chainId: 8453,
                    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    eventName: "Transfer",
                    filters: [
                      {
                        argName: "from",
                        operator: "==",
                        value: "0x0000000000000000000000000000000000000001"
                      }
                    ],
                    fromBlock: "auto:24h",
                    toBlock: "latest"
                  },
                  parsed: true
                })
              }
            }
          ]
        })
      )
    );

    const parsedResponse = await parseNaturalLanguageQuery({
      apiEnv: {
        ...apiEnvFixture,
        OPENROUTER_API_KEY: "test-openrouter-key"
      },
      chainIdHint: 8453,
      fetchImplementation,
      query: "USDC transfers from 0x0000000000000000000000000000000000000001 on Base last 24 hours"
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(parsedResponse).toEqual({
      confidence: "medium",
      contractName: "USDC",
      explanation: "Searching Base USDC transfers from a specific sender.",
      params: {
        chainId: 8453,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        eventName: "Transfer",
        filters: [
          {
            argName: "from",
            operator: "==",
            value: "0x0000000000000000000000000000000000000001"
          }
        ],
        fromBlock: "auto:24h",
        toBlock: "latest"
      },
      parsed: true
    });
  });
});
