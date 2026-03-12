import { createPublicClient, decodeEventLog, http } from "viem";

import type { Abi, AbiEvent } from "viem";

import { getChainConfig } from "./chains";
import { detectProviderProfile } from "./providerProfiles";
import { queryInputSchema } from "./schemas";

import type {
  DecodedArgument,
  DecodedLog,
  LogQueryInput,
  QueryProgressEvent,
  QueryResult
} from "./schemas";
import type { ProviderProfile } from "./providerProfiles";

type RunLogQueryOptions = {
  abi?: Abi;
  maxBlockSpan?: number;
  maxDecodedLogs?: number;
  onProgress?: (progressEvent: QueryProgressEvent) => void | Promise<void>;
  queryInput: LogQueryInput;
  rpcUrl: string;
  signal?: AbortSignal;
};

type RpcLogRecord = {
  address: string;
  blockNumber: bigint | null;
  transactionHash: string | null;
  logIndex: number | null;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
  removed: boolean;
};

type BlockRange = {
  fromBlock: bigint;
  toBlock: bigint;
};

type ScheduledChunk = BlockRange & {
  chunkIndex: number;
  requestedChunkSize: number;
};

const maxRetryAttempts = 3;

const retryableErrorPatterns = [
  "429",
  "rate limit",
  "timeout",
  "timed out",
  "temporarily unavailable",
  "socket hang up"
];

const shrinkableErrorPatterns = [
  "block range",
  "query returned more than",
  "response size exceeded",
  "too many results",
  "result exceeds",
  "please limit"
];

const emitProgress = async (
  onProgress: RunLogQueryOptions["onProgress"],
  progressEvent: QueryProgressEvent
): Promise<void> => {
  if (!onProgress) {
    return;
  }

  await onProgress(progressEvent);
};

const sleep = async (durationMs: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, durationMs);

    const handleAbort = (): void => {
      clearTimeout(timeout);
      reject(new Error("Query aborted."));
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }
  });

const formatAbiValue = (value: unknown): string => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value.map((arrayValue) => formatAbiValue(arrayValue)));
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value).map(([objectKey, objectValue]) => [
          objectKey,
          formatAbiValue(objectValue)
        ])
      )
    );
  }

  return String(value);
};

const isAbiEventItem = (abiItem: Abi[number]): abiItem is AbiEvent => abiItem.type === "event";

const findAbiEventByName = (
  abi: Abi | undefined,
  eventName: string | undefined
): AbiEvent | undefined => {
  if (!abi || !eventName) {
    return undefined;
  }

  return abi.filter(isAbiEventItem).find((abiItem) => abiItem.name === eventName);
};

const createDecodedArgs = (
  abiEvent: AbiEvent | undefined,
  decodedArgs: unknown
): DecodedArgument[] => {
  if (!abiEvent) {
    return [];
  }

  if (Array.isArray(decodedArgs)) {
    return abiEvent.inputs.map((input, inputIndex) => ({
      indexed: Boolean(input.indexed),
      name: input.name || `arg${inputIndex}`,
      type: input.type,
      value: formatAbiValue(decodedArgs[inputIndex])
    }));
  }

  if (typeof decodedArgs === "object" && decodedArgs !== null) {
    return abiEvent.inputs.map((input, inputIndex) => {
      const namedValue =
        input.name && input.name in decodedArgs
          ? (decodedArgs as Record<string, unknown>)[input.name]
          : undefined;

      return {
        indexed: Boolean(input.indexed),
        name: input.name || `arg${inputIndex}`,
        type: input.type,
        value: formatAbiValue(namedValue)
      };
    });
  }

  return [];
};

const decodeLogRecord = (rpcLogRecord: RpcLogRecord, abi: Abi | undefined): DecodedLog => {
  if (!abi?.length) {
    return {
      id: `${rpcLogRecord.transactionHash ?? "pending"}:${rpcLogRecord.logIndex ?? 0}`,
      address: rpcLogRecord.address,
      blockNumber: rpcLogRecord.blockNumber?.toString() ?? "0",
      transactionHash: rpcLogRecord.transactionHash ?? "0x",
      logIndex: rpcLogRecord.logIndex ?? 0,
      eventName: null,
      decodedArgs: [],
      topics: [...rpcLogRecord.topics],
      data: rpcLogRecord.data,
      removed: rpcLogRecord.removed
    };
  }

  try {
    if (rpcLogRecord.topics.length === 0) {
      throw new Error("Cannot decode a log without topics.");
    }

    const decodedLog = decodeEventLog({
      abi,
      data: rpcLogRecord.data,
      topics: [...rpcLogRecord.topics] as [`0x${string}`, ...`0x${string}`[]],
      strict: false
    });
    const abiEvent = abi
      .filter(isAbiEventItem)
      .find((abiItem) => abiItem.name === decodedLog.eventName);

    return {
      id: `${rpcLogRecord.transactionHash ?? "pending"}:${rpcLogRecord.logIndex ?? 0}`,
      address: rpcLogRecord.address,
      blockNumber: rpcLogRecord.blockNumber?.toString() ?? "0",
      transactionHash: rpcLogRecord.transactionHash ?? "0x",
      logIndex: rpcLogRecord.logIndex ?? 0,
      eventName: decodedLog.eventName ?? null,
      decodedArgs: createDecodedArgs(abiEvent, decodedLog.args),
      topics: [...rpcLogRecord.topics],
      data: rpcLogRecord.data,
      removed: rpcLogRecord.removed
    };
  } catch {
    return {
      id: `${rpcLogRecord.transactionHash ?? "pending"}:${rpcLogRecord.logIndex ?? 0}`,
      address: rpcLogRecord.address,
      blockNumber: rpcLogRecord.blockNumber?.toString() ?? "0",
      transactionHash: rpcLogRecord.transactionHash ?? "0x",
      logIndex: rpcLogRecord.logIndex ?? 0,
      eventName: null,
      decodedArgs: [],
      topics: [...rpcLogRecord.topics],
      data: rpcLogRecord.data,
      removed: rpcLogRecord.removed
    };
  }
};

const isRetryableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return retryableErrorPatterns.some((pattern) => message.includes(pattern));
};

const isShrinkableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return shrinkableErrorPatterns.some((pattern) => message.includes(pattern));
};

const clampChunkSize = (
  providerProfile: ProviderProfile,
  requestedChunkSize: number
): number =>
  Math.min(
    providerProfile.maxChunkSize,
    Math.max(providerProfile.minChunkSize, requestedChunkSize)
  );

const estimateChunkCount = (
  fromBlock: bigint,
  toBlock: bigint,
  initialChunkSize: number
): number => Number((toBlock - fromBlock) / BigInt(initialChunkSize)) + 1;

const assertWithinBlockSpan = (
  queryInput: LogQueryInput,
  maxBlockSpan: number | undefined
): void => {
  if (!maxBlockSpan) {
    return;
  }

  const requestedSpan = queryInput.toBlock - queryInput.fromBlock + 1n;

  if (requestedSpan > BigInt(maxBlockSpan)) {
    throw new Error(`Query block span exceeds the current limit of ${maxBlockSpan} blocks.`);
  }
};

const growChunkSize = (currentChunkSize: number, providerProfile: ProviderProfile): number =>
  clampChunkSize(providerProfile, currentChunkSize * 2);

const shrinkChunkSize = (currentChunkSize: number, providerProfile: ProviderProfile): number =>
  clampChunkSize(providerProfile, Math.floor(currentChunkSize / 2));

const splitBlockRange = (blockRange: BlockRange, chunkSize: number): BlockRange[] => {
  const splitRanges: BlockRange[] = [];
  let currentRangeStart = blockRange.fromBlock;

  while (currentRangeStart <= blockRange.toBlock) {
    const currentRangeEnd =
      currentRangeStart + BigInt(chunkSize - 1) > blockRange.toBlock
        ? blockRange.toBlock
        : currentRangeStart + BigInt(chunkSize - 1);

    splitRanges.push({
      fromBlock: currentRangeStart,
      toBlock: currentRangeEnd
    });

    currentRangeStart = currentRangeEnd + 1n;
  }

  return splitRanges;
};

const compareBigIntValues = (leftValue: bigint, rightValue: bigint): number =>
  leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;

const sortDecodedLogs = (decodedLogs: DecodedLog[]): DecodedLog[] =>
  [...decodedLogs].sort((leftLog, rightLog) => {
    const blockComparison = compareBigIntValues(
      BigInt(leftLog.blockNumber),
      BigInt(rightLog.blockNumber)
    );

    if (blockComparison !== 0) {
      return blockComparison;
    }

    const logIndexComparison = leftLog.logIndex - rightLog.logIndex;

    if (logIndexComparison !== 0) {
      return logIndexComparison;
    }

    const transactionHashComparison = leftLog.transactionHash.localeCompare(
      rightLog.transactionHash
    );

    if (transactionHashComparison !== 0) {
      return transactionHashComparison;
    }

    return leftLog.id.localeCompare(rightLog.id);
  });

export const runLogQuery = async ({
  abi,
  maxBlockSpan,
  maxDecodedLogs = 10_000,
  onProgress,
  queryInput,
  rpcUrl,
  signal
}: RunLogQueryOptions): Promise<QueryResult> => {
  const validatedQueryInput = queryInputSchema.parse(queryInput);

  assertWithinBlockSpan(validatedQueryInput, maxBlockSpan);

  if (validatedQueryInput.eventName && !findAbiEventByName(abi, validatedQueryInput.eventName)) {
    throw new Error(
      "An ABI containing the selected event is required before filtering by event name."
    );
  }

  const providerProfile = detectProviderProfile(rpcUrl);
  const chainConfig = getChainConfig(validatedQueryInput.chainId);
  const publicClient = createPublicClient({
    chain: chainConfig.viemChain,
    transport: http(rpcUrl, {
      retryCount: 0,
      timeout: 20_000
    })
  });
  const selectedEvent = findAbiEventByName(abi, validatedQueryInput.eventName);
  const totalChunks = estimateChunkCount(
    validatedQueryInput.fromBlock,
    validatedQueryInput.toBlock,
    providerProfile.initialChunkSize
  );
  const decodedLogs: DecodedLog[] = [];
  let totalFetched = 0;
  let completedChunks = 0;
  let nextChunkIndex = 0;
  let currentChunkSize = clampChunkSize(
    providerProfile,
    Number(validatedQueryInput.toBlock - validatedQueryInput.fromBlock + 1n)
  );
  currentChunkSize = Math.min(currentChunkSize, providerProfile.initialChunkSize);
  let nextChunkStart = validatedQueryInput.fromBlock;
  let pendingBlockRanges: BlockRange[] = [];
  let activeChunks = 0;
  let truncated = false;
  let cappedProgressEmitted = false;
  let stopScheduling = false;
  let fatalError: Error | null = null;

  await emitProgress(onProgress, {
    type: "started",
    totalChunks,
    chunkSize: currentChunkSize,
    providerLabel: providerProfile.label,
    mode: validatedQueryInput.mode
  });

  const prependPendingBlockRanges = (blockRanges: BlockRange[]): void => {
    pendingBlockRanges = [...blockRanges, ...pendingBlockRanges];
  };

  const dequeueNextChunk = (): ScheduledChunk | null => {
    if (fatalError || stopScheduling) {
      return null;
    }

    signal?.throwIfAborted();

    const [pendingBlockRange, ...remainingPendingBlockRanges] = pendingBlockRanges;

    if (pendingBlockRange) {
      const pendingChunkEnd =
        pendingBlockRange.fromBlock + BigInt(currentChunkSize - 1) > pendingBlockRange.toBlock
          ? pendingBlockRange.toBlock
          : pendingBlockRange.fromBlock + BigInt(currentChunkSize - 1);

      pendingBlockRanges =
        pendingChunkEnd < pendingBlockRange.toBlock
          ? [
              {
                fromBlock: pendingChunkEnd + 1n,
                toBlock: pendingBlockRange.toBlock
              },
              ...remainingPendingBlockRanges
            ]
          : remainingPendingBlockRanges;

      return {
        chunkIndex: nextChunkIndex++,
        fromBlock: pendingBlockRange.fromBlock,
        toBlock: pendingChunkEnd,
        requestedChunkSize: Number(pendingChunkEnd - pendingBlockRange.fromBlock + 1n)
      };
    }

    if (nextChunkStart > validatedQueryInput.toBlock) {
      return null;
    }

    const currentChunkEnd =
      nextChunkStart + BigInt(currentChunkSize - 1) > validatedQueryInput.toBlock
        ? validatedQueryInput.toBlock
        : nextChunkStart + BigInt(currentChunkSize - 1);
    const nextScheduledChunk = {
      chunkIndex: nextChunkIndex++,
      fromBlock: nextChunkStart,
      toBlock: currentChunkEnd,
      requestedChunkSize: Number(currentChunkEnd - nextChunkStart + 1n)
    } satisfies ScheduledChunk;

    nextChunkStart = currentChunkEnd + 1n;

    return nextScheduledChunk;
  };

  const executeChunk = async (scheduledChunk: ScheduledChunk): Promise<void> => {
    let attemptCount = 0;

    while (true) {
      signal?.throwIfAborted();
      attemptCount += 1;

      try {
        const rpcLogs = (await publicClient.getLogs({
          address: validatedQueryInput.contractAddress as `0x${string}`,
          event: selectedEvent,
          fromBlock: scheduledChunk.fromBlock,
          toBlock: scheduledChunk.toBlock
        })) as RpcLogRecord[];

        signal?.throwIfAborted();

        if (fatalError) {
          return;
        }

        totalFetched += rpcLogs.length;

        if (!stopScheduling) {
          const decodedChunkLogs = rpcLogs.map((rpcLogRecord) =>
            decodeLogRecord(rpcLogRecord, abi)
          );
          const remainingSlots = Math.max(maxDecodedLogs - decodedLogs.length, 0);
          const logsToAppend = decodedChunkLogs.slice(0, remainingSlots);

          decodedLogs.push(...logsToAppend);

          if (decodedChunkLogs.length > remainingSlots) {
            truncated = true;
            stopScheduling = true;

            if (!cappedProgressEmitted) {
              cappedProgressEmitted = true;

              await emitProgress(onProgress, {
                type: "capped",
                reason: `Reached the decoded log cap of ${maxDecodedLogs}.`,
                totalDecoded: decodedLogs.length
              });
            }
          }
        }

        completedChunks += 1;

        await emitProgress(onProgress, {
          type: "chunkCompleted",
          chunkIndex: scheduledChunk.chunkIndex,
          chunkStartBlock: scheduledChunk.fromBlock.toString(),
          chunkEndBlock: scheduledChunk.toBlock.toString(),
          fetchedLogs: rpcLogs.length,
          totalDecoded: decodedLogs.length,
          completedChunks
        });

        if (!stopScheduling) {
          if (
            rpcLogs.length < 25 &&
            currentChunkSize === scheduledChunk.requestedChunkSize
          ) {
            currentChunkSize = growChunkSize(
              scheduledChunk.requestedChunkSize,
              providerProfile
            );
          }

          if (rpcLogs.length > 1_000) {
            currentChunkSize = Math.min(
              currentChunkSize,
              shrinkChunkSize(scheduledChunk.requestedChunkSize, providerProfile)
            );
          }
        }

        return;
      } catch (error) {
        if (fatalError) {
          throw fatalError;
        }

        if (
          isShrinkableError(error) &&
          scheduledChunk.requestedChunkSize > providerProfile.minChunkSize
        ) {
          const nextChunkSize = shrinkChunkSize(
            scheduledChunk.requestedChunkSize,
            providerProfile
          );

          currentChunkSize = Math.min(currentChunkSize, nextChunkSize);
          prependPendingBlockRanges(
            splitBlockRange(
              {
                fromBlock: scheduledChunk.fromBlock,
                toBlock: scheduledChunk.toBlock
              },
              nextChunkSize
            )
          );

          await emitProgress(onProgress, {
            type: "retrying",
            chunkIndex: scheduledChunk.chunkIndex,
            chunkStartBlock: scheduledChunk.fromBlock.toString(),
            chunkEndBlock: scheduledChunk.toBlock.toString(),
            nextChunkSize,
            reason: error instanceof Error ? error.message : "Chunk was too large."
          });

          return;
        }

        if (isRetryableError(error) && attemptCount < maxRetryAttempts) {
          await emitProgress(onProgress, {
            type: "retrying",
            chunkIndex: scheduledChunk.chunkIndex,
            chunkStartBlock: scheduledChunk.fromBlock.toString(),
            chunkEndBlock: scheduledChunk.toBlock.toString(),
            nextChunkSize: null,
            reason: error instanceof Error ? error.message : "Transient RPC error."
          });

          await sleep(providerProfile.backoffMs * attemptCount, signal);

          continue;
        }

        const message = error instanceof Error ? error.message : "Unknown RPC error";

        fatalError = new Error(message);
        stopScheduling = true;

        await emitProgress(onProgress, {
          type: "failed",
          message
        });

        throw fatalError;
      }
    }
  };

  const runChunkWorker = async (): Promise<void> => {
    while (true) {
      const scheduledChunk = dequeueNextChunk();

      if (!scheduledChunk) {
        return;
      }

      activeChunks += 1;

      try {
        await emitProgress(onProgress, {
          type: "chunkStarted",
          chunkIndex: scheduledChunk.chunkIndex,
          chunkStartBlock: scheduledChunk.fromBlock.toString(),
          chunkEndBlock: scheduledChunk.toBlock.toString(),
          activeChunks
        });

        await executeChunk(scheduledChunk);
      } finally {
        activeChunks -= 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(providerProfile.concurrency, 1) }, () => runChunkWorker())
  );

  await emitProgress(onProgress, {
    type: "completed",
    totalDecoded: decodedLogs.length,
    truncated
  });

  const sortedDecodedLogs = sortDecodedLogs(decodedLogs);

  return {
    logs: sortedDecodedLogs,
    truncated,
    totalFetched,
    totalDecoded: sortedDecodedLogs.length,
    exportable: sortedDecodedLogs.length > 0
  };
};
