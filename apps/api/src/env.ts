import { z } from "zod";

import type { ChainId } from "@chaingrep/shared";

const envSchema = z.object({
  CORS_ORIGIN: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(8787),
  SAMPLE_BASE_RPC_URL: z.string().url().optional(),
  SAMPLE_ETHEREUM_RPC_URL: z.string().url().optional(),
  SAMPLE_MAX_BLOCK_SPAN: z.coerce.number().int().positive().default(10000),
  SAMPLE_MAX_LOGS: z.coerce.number().int().positive().default(2000),
  SAMPLE_POLYGON_RPC_URL: z.string().url().optional(),
  SAMPLE_QUERY_LIMIT: z.coerce.number().int().positive().default(10),
  SAMPLE_RATE_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  SAMPLE_SEPOLIA_RPC_URL: z.string().url().optional()
});

export type ApiEnv = z.infer<typeof envSchema>;

export const readApiEnv = (environment: Record<string, unknown> = process.env): ApiEnv =>
  envSchema.parse(environment);

export const getSampleRpcUrlForChain = (
  apiEnv: ApiEnv,
  chainId: number
): string | null => {
  switch (chainId) {
    case 1:
      return apiEnv.SAMPLE_ETHEREUM_RPC_URL ?? null;
    case 8453:
      return apiEnv.SAMPLE_BASE_RPC_URL ?? null;
    case 11155111:
      return apiEnv.SAMPLE_SEPOLIA_RPC_URL ?? null;
    case 137:
      return apiEnv.SAMPLE_POLYGON_RPC_URL ?? null;
    default:
      return null;
  }
};

export const getConfiguredSampleChainIds = (apiEnv: ApiEnv): ChainId[] =>
  [1, 11155111, 137, 8453].filter(
    (chainId) => getSampleRpcUrlForChain(apiEnv, chainId) !== null
  ) as ChainId[];
