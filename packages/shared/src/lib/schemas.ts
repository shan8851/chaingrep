import { z } from "zod";

export const modeSchema = z.enum(["sample", "direct"]);
export const parseConfidenceSchema = z.enum(["high", "medium", "low"]);
export const argFilterOperatorSchema = z.enum([">", "<", ">=", "<=", "==", "!="]);

export const chainIdSchema = z.union([
  z.literal(1),
  z.literal(8453),
  z.literal(11155111),
  z.literal(137)
]);

export const blockBoundarySchema = z
  .union([z.bigint(), z.number().int().nonnegative(), z.string().min(1)])
  .transform((value) => BigInt(value));

export const queryInputSchema = z
  .object({
    chainId: chainIdSchema,
    contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    fromBlock: blockBoundarySchema,
    toBlock: blockBoundarySchema,
    eventName: z.string().min(1).optional(),
    mode: modeSchema
  })
  .refine(
    ({ fromBlock, toBlock }) => fromBlock <= toBlock,
    "fromBlock must be less than or equal to toBlock"
  );

export const userConnectionSettingsSchema = z.object({
  rpcUrlsByChainId: z.record(z.string().regex(/^\d+$/), z.string().url()).catch({}),
  etherscanApiKey: z.string().trim().min(1).optional()
});

export const argFilterSchema = z.object({
  argName: z.string().trim().min(1),
  operator: argFilterOperatorSchema,
  value: z.string().trim().min(1)
});

const autoBlockBoundarySchema = z.string().regex(/^auto:\d+(h|d)$/i);
const numericBlockBoundarySchema = z.string().regex(/^\d+$/);

export const naturalLanguageQueryParamsSchema = z.object({
  chainId: chainIdSchema,
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  eventName: z.string().trim().min(1).optional(),
  filters: z.array(argFilterSchema).default([]),
  fromBlock: z.union([numericBlockBoundarySchema, autoBlockBoundarySchema]),
  toBlock: z.union([numericBlockBoundarySchema, z.literal("latest")])
});

export const naturalLanguageQueryRequestSchema = z.object({
  chainId: chainIdSchema.optional(),
  query: z.string().trim().min(1)
});

export const naturalLanguageQuerySuccessSchema = z.object({
  confidence: parseConfidenceSchema,
  contractName: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1),
  params: naturalLanguageQueryParamsSchema,
  parsed: z.literal(true)
});

export const naturalLanguageQueryFailureSchema = z.object({
  parsed: z.literal(false),
  reason: z.string().trim().min(1)
});

export const naturalLanguageQueryResponseSchema = z.discriminatedUnion("parsed", [
  naturalLanguageQuerySuccessSchema,
  naturalLanguageQueryFailureSchema
]);

export const queryProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    totalChunks: z.number().int().positive(),
    chunkSize: z.number().int().positive(),
    providerLabel: z.string(),
    mode: modeSchema
  }),
  z.object({
    type: z.literal("chunkStarted"),
    chunkIndex: z.number().int().nonnegative(),
    chunkStartBlock: z.string(),
    chunkEndBlock: z.string(),
    activeChunks: z.number().int().positive()
  }),
  z.object({
    type: z.literal("chunkCompleted"),
    chunkIndex: z.number().int().nonnegative(),
    chunkStartBlock: z.string(),
    chunkEndBlock: z.string(),
    fetchedLogs: z.number().int().nonnegative(),
    totalDecoded: z.number().int().nonnegative(),
    completedChunks: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("retrying"),
    chunkIndex: z.number().int().nonnegative(),
    chunkStartBlock: z.string(),
    chunkEndBlock: z.string(),
    nextChunkSize: z.number().int().positive().nullable(),
    reason: z.string()
  }),
  z.object({
    type: z.literal("capped"),
    reason: z.string(),
    totalDecoded: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("completed"),
    totalDecoded: z.number().int().nonnegative(),
    truncated: z.boolean()
  }),
  z.object({
    type: z.literal("failed"),
    message: z.string()
  })
]);

export const decodedArgumentSchema = z.object({
  name: z.string(),
  type: z.string(),
  indexed: z.boolean(),
  value: z.string()
});

export const decodedLogSchema = z.object({
  id: z.string(),
  address: z.string(),
  blockNumber: z.string(),
  transactionHash: z.string(),
  logIndex: z.number().int().nonnegative(),
  eventName: z.string().nullable(),
  decodedArgs: z.array(decodedArgumentSchema),
  topics: z.array(z.string()),
  data: z.string(),
  removed: z.boolean()
});

export const queryResultSchema = z.object({
  logs: z.array(decodedLogSchema),
  truncated: z.boolean(),
  totalFetched: z.number().int().nonnegative(),
  totalDecoded: z.number().int().nonnegative(),
  exportable: z.boolean()
});

export const abiResolutionResultSchema = z.object({
  source: z.enum(["sourcify", "etherscan", "manual", "none"]),
  abi: z.array(z.unknown()),
  eventOptions: z.array(z.string())
});

export type AppMode = z.infer<typeof modeSchema>;
export type ParseConfidence = z.infer<typeof parseConfidenceSchema>;
export type ChainId = z.infer<typeof chainIdSchema>;
export type LogQueryInput = z.infer<typeof queryInputSchema>;
export type UserConnectionSettings = z.infer<typeof userConnectionSettingsSchema>;
export type ArgFilterOperator = z.infer<typeof argFilterOperatorSchema>;
export type ArgFilter = z.infer<typeof argFilterSchema>;
export type NaturalLanguageQueryParams = z.infer<typeof naturalLanguageQueryParamsSchema>;
export type NaturalLanguageQueryRequest = z.infer<typeof naturalLanguageQueryRequestSchema>;
export type NaturalLanguageQuerySuccess = z.infer<typeof naturalLanguageQuerySuccessSchema>;
export type NaturalLanguageQueryFailure = z.infer<typeof naturalLanguageQueryFailureSchema>;
export type NaturalLanguageQueryResponse = z.infer<typeof naturalLanguageQueryResponseSchema>;
export type QueryProgressEvent = z.infer<typeof queryProgressEventSchema>;
export type DecodedArgument = z.infer<typeof decodedArgumentSchema>;
export type DecodedLog = z.infer<typeof decodedLogSchema>;
export type QueryResult = z.infer<typeof queryResultSchema>;
export type AbiResolutionResult = z.infer<typeof abiResolutionResultSchema>;

export type QueryStreamMessage =
  | {
      kind: "progress";
      progress: QueryProgressEvent;
    }
  | {
      kind: "result";
      result: QueryResult;
    }
  | {
      kind: "error";
      error: string;
    };
