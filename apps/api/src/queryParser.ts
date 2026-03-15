import {
  averageBlockTimeSecondsByChainId,
  findKnownContract,
  findKnownContractByAddress,
  knownContracts,
  latestBlockReference,
  naturalLanguageQueryResponseSchema,
  supportedChains
} from "@chaingrep/shared";

import type {
  ChainId,
  KnownContract,
  NaturalLanguageQueryResponse,
  NaturalLanguageQuerySuccess
} from "@chaingrep/shared";
import type { ApiEnv } from "./env";

type ParseNaturalLanguageQueryOptions = {
  apiEnv: ApiEnv;
  chainIdHint?: ChainId;
  fetchImplementation?: typeof fetch;
  query: string;
};

type ResolvedParseOptions = {
  apiEnv: ApiEnv;
  chainIdHint: ChainId | undefined;
  fetchImplementation: typeof fetch;
  query: string;
};

type HumanAmountMatch = {
  multiplierPower: number;
  operator: "!=" | "<" | "<=" | "==" | ">" | ">=";
  rawValue: string;
};

const openRouterEndpoint = "https://openrouter.ai/api/v1/chat/completions";

const chainAliasGroups = [
  {
    aliases: ["ethereum", "eth mainnet", "mainnet", "eth"],
    chainId: 1 as ChainId
  },
  {
    aliases: ["sepolia", "eth sepolia"],
    chainId: 11155111 as ChainId
  },
  {
    aliases: ["polygon", "matic", "polygon pos"],
    chainId: 137 as ChainId
  },
  {
    aliases: ["base"],
    chainId: 8453 as ChainId
  }
] as const;

const eventKeywordGroups = [
  {
    eventName: "Transfer",
    keywords: ["transfer", "transfers", "transferred", "sending", "sent"]
  },
  {
    eventName: "Approval",
    keywords: ["approval", "approvals", "approve", "approved"]
  },
  {
    eventName: "Swap",
    keywords: ["swap", "swaps", "swapped"]
  },
  {
    eventName: "Mint",
    keywords: ["mint", "mints", "minted"]
  },
  {
    eventName: "Burn",
    keywords: ["burn", "burns", "burned", "burnt"]
  },
  {
    eventName: "PoolCreated",
    keywords: ["pool created", "pool creation", "new pool"]
  }
] as const;

const complexQueryPatterns = [
  /\bbetween\b/i,
  /\bexcluding\b/i,
  /\bexcept\b/i,
  /\bwithout\b/i,
  /\bafter\b/i,
  /\bbefore\b/i,
  /\bwhere\b/i,
  /\bsender\b/i,
  /\brecipient\b/i,
  /\bcaller\b/i,
  /\bcallee\b/i,
  /0x[a-fA-F0-9]{40}/
] as const;

const integerPattern = /^\d+$/;
const amountPattern =
  /\b(over|above|greater than|more than|under|below|less than|at least|at most|exactly)\s+\$?([\d,.]+(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?\b/i;

const normalizeSearchText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const toReasonResponse = (reason: string): NaturalLanguageQueryResponse => ({
  parsed: false,
  reason
});

const inferChainId = (query: string, chainIdHint?: ChainId): ChainId | undefined => {
  const normalizedQuery = normalizeSearchText(query);
  const matchedChain = chainAliasGroups.find(({ aliases }) =>
    aliases.some((alias) => normalizedQuery.includes(alias))
  );

  return matchedChain?.chainId ?? chainIdHint;
};

const inferEventName = (
  query: string,
  knownContract: KnownContract
): string | undefined => {
  const normalizedQuery = normalizeSearchText(query);
  const matchedEventGroup = eventKeywordGroups.find(({ eventName, keywords }) =>
    knownContract.commonEvents.includes(eventName) &&
    keywords.some((keyword) => normalizedQuery.includes(keyword))
  );

  if (matchedEventGroup) {
    return matchedEventGroup.eventName;
  }

  return knownContract.commonEvents.find((commonEvent) =>
    normalizedQuery.includes(normalizeSearchText(commonEvent))
  );
};

const inferRelativeTimeRange = (
  query: string
): { explicit: boolean; value: string } => {
  const normalizedQuery = normalizeSearchText(query);
  const dayMatch = normalizedQuery.match(/\b(?:last|past)\s+(\d+)\s+d(?:ay|ays)?\b/);

  if (dayMatch?.[1]) {
    return {
      explicit: true,
      value: `auto:${dayMatch[1]}d`
    };
  }

  const hourMatch = normalizedQuery.match(/\b(?:last|past)\s+(\d+)\s+h(?:our|ours|r|rs)?\b/);

  if (hourMatch?.[1]) {
    return {
      explicit: true,
      value: `auto:${hourMatch[1]}h`
    };
  }

  if (normalizedQuery.includes("last day") || normalizedQuery.includes("past day")) {
    return {
      explicit: true,
      value: "auto:24h"
    };
  }

  if (normalizedQuery.includes("last week") || normalizedQuery.includes("past week")) {
    return {
      explicit: true,
      value: "auto:7d"
    };
  }

  if (normalizedQuery.includes("last hour") || normalizedQuery.includes("past hour")) {
    return {
      explicit: true,
      value: "auto:1h"
    };
  }

  return {
    explicit: false,
    value: "auto:24h"
  };
};

const inferHumanAmount = (query: string): HumanAmountMatch | null => {
  const matchedAmount = query.match(amountPattern);

  if (!matchedAmount?.[1] || !matchedAmount[2]) {
    return null;
  }

  const normalizedOperator = matchedAmount[1].toLowerCase();
  const multiplierSuffix = matchedAmount[3]?.toLowerCase() ?? "";
  const multiplierPower =
    multiplierSuffix === "k" || multiplierSuffix === "thousand"
      ? 3
      : multiplierSuffix === "m" || multiplierSuffix === "million"
        ? 6
        : multiplierSuffix === "b" || multiplierSuffix === "billion"
          ? 9
          : 0;
  const operator =
    normalizedOperator === "over" ||
    normalizedOperator === "above" ||
    normalizedOperator === "greater than" ||
    normalizedOperator === "more than"
      ? ">"
      : normalizedOperator === "under" ||
          normalizedOperator === "below" ||
          normalizedOperator === "less than"
        ? "<"
        : normalizedOperator === "at least"
          ? ">="
          : normalizedOperator === "at most"
            ? "<="
            : "==";

  return {
    multiplierPower,
    operator,
    rawValue: matchedAmount[2]
  };
};

const tokenDecimalsByName: Partial<Record<KnownContract["name"], number>> = {
  DAI: 18,
  POL: 18,
  USDC: 6,
  USDT: 6,
  WETH: 18,
  WMATIC: 18
};

const scaleHumanReadableAmount = (
  rawValue: string,
  decimals: number,
  multiplierPower: number
): string | null => {
  const sanitizedValue = rawValue.replace(/,/g, "").trim();

  if (!/^\d+(?:\.\d+)?$/.test(sanitizedValue)) {
    return null;
  }

  const [wholePart, fractionalPart = ""] = sanitizedValue.split(".");
  const scaledExponent = decimals + multiplierPower;
  const significantDigits = `${wholePart}${fractionalPart}`.replace(/^0+/, "") || "0";
  const zeroPadding = scaledExponent - fractionalPart.length;

  if (zeroPadding >= 0) {
    return `${significantDigits}${"0".repeat(zeroPadding)}`;
  }

  const trimmedDigitCount = significantDigits.length + zeroPadding;

  if (trimmedDigitCount <= 0) {
    return "0";
  }

  return significantDigits.slice(0, trimmedDigitCount);
};

const looksComplexQuery = (query: string): boolean =>
  complexQueryPatterns.some((complexQueryPattern) => complexQueryPattern.test(query));

const formatTimeWindowExplanation = (timeRangeReference: string): string =>
  timeRangeReference.startsWith("auto:")
    ? `using ${timeRangeReference.replace("auto:", "the last ")}`
    : `from block ${timeRangeReference}`;

const buildLocalRegistryParse = (
  query: string,
  chainIdHint: ChainId | undefined
): NaturalLanguageQuerySuccess | null => {
  const resolvedChainId = inferChainId(query, chainIdHint);
  const knownContract = findKnownContract(query, resolvedChainId);

  if (!knownContract) {
    return null;
  }

  const timeRange = inferRelativeTimeRange(query);
  const inferredEventName = inferEventName(query, knownContract);
  const humanAmount = inferHumanAmount(query);
  const impliedEventName =
    inferredEventName ??
    (humanAmount !== null &&
    knownContract.commonEvents.includes("Transfer")
      ? "Transfer"
      : undefined);
  const tokenDecimals = tokenDecimalsByName[knownContract.name];

  if (humanAmount && (!impliedEventName || tokenDecimals === undefined)) {
    return null;
  }

  const scaledFilterValue =
    humanAmount && tokenDecimals !== undefined
      ? scaleHumanReadableAmount(
          humanAmount.rawValue,
          tokenDecimals,
          humanAmount.multiplierPower
        )
      : null;

  if (humanAmount && scaledFilterValue === null) {
    return null;
  }

  const chainName =
    supportedChains.find((supportedChain) => supportedChain.id === knownContract.chainId)?.name ??
    `chain ${knownContract.chainId}`;
  const confidence =
    !timeRange.explicit || !inferredEventName
      ? inferredEventName || humanAmount
        ? "medium"
        : "low"
      : "high";
  const amountExplanation =
    humanAmount && scaledFilterValue
      ? ` with ${impliedEventName} value ${humanAmount.operator} ${humanAmount.rawValue}`
      : "";
  const assumptionExplanation = !timeRange.explicit
    ? " I assumed the last 24 hours because no time window was specified."
    : "";

  return naturalLanguageQueryResponseSchema.parse({
    confidence,
    contractName: knownContract.name,
    explanation:
      `Searching ${chainName} ${knownContract.name}` +
      `${impliedEventName ? ` ${impliedEventName}` : " events"}` +
      `${amountExplanation}, ${formatTimeWindowExplanation(timeRange.value)}.` +
      assumptionExplanation,
    params: {
      chainId: knownContract.chainId,
      contractAddress: knownContract.address,
      ...(impliedEventName ? { eventName: impliedEventName } : {}),
      filters:
        humanAmount && scaledFilterValue
          ? [
              {
                argName: "value",
                operator: humanAmount.operator,
                value: scaledFilterValue
              }
            ]
          : [],
      fromBlock: timeRange.value,
      toBlock: latestBlockReference
    },
    parsed: true
  }) as NaturalLanguageQuerySuccess;
};

const buildKnownContractContext = (): string =>
  supportedChains
    .map((supportedChain) => {
      const chainContracts = knownContracts.filter(
        (knownContract) => knownContract.chainId === supportedChain.id
      );

      return [
        `${supportedChain.name} (${supportedChain.id})`,
        ...chainContracts.map(
          (knownContract) =>
            `- ${knownContract.name} | aliases: ${knownContract.aliases.join(", ")} | address: ${knownContract.address} | common events: ${knownContract.commonEvents.join(", ")}`
        )
      ].join("\n");
    })
    .join("\n\n");

const buildSystemPrompt = (): string =>
  [
    "You translate natural-language EVM event search requests into chaingrep query JSON.",
    "Return JSON only. No markdown, no prose outside the JSON payload.",
    "Supported chains:",
    ...supportedChains.map(
      (supportedChain) =>
        `- ${supportedChain.name}: chainId ${supportedChain.id}, avg block time ${averageBlockTimeSecondsByChainId[supportedChain.id]} seconds`
    ),
    "Use fromBlock values like auto:1h, auto:24h, auto:7d for relative time windows.",
    'Use toBlock "latest" unless the user explicitly asked for a fixed ending block.',
    "Common decimals: USDC and USDT use 6 decimals. Most ERC20s use 18 decimals, including DAI, WETH, WMATIC, and POL.",
    "If you infer a numeric token threshold for Transfer or Approval, scale it into raw token units and use an arg filter on value.",
    "Only use known contract addresses when the name or alias matches. Do not guess addresses.",
    'If you can produce a complete query but there are assumptions, set confidence to "low" and explain them.',
    'If you cannot produce a complete query confidently enough to fill required params, return {"parsed":false,"reason":"..."} instead.',
    "JSON shape when parsed is true:",
    '{"parsed":true,"params":{"chainId":1,"contractAddress":"0x...","eventName":"Transfer","fromBlock":"auto:24h","toBlock":"latest","filters":[{"argName":"value","operator":">","value":"1000000"}]},"contractName":"USDC","confidence":"high","explanation":"..."}',
    "JSON shape when parsed is false:",
    '{"parsed":false,"reason":"..."}',
    "Known contract registry:",
    buildKnownContractContext()
  ].join("\n");

const extractMessageContent = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((contentPart) => {
      if (
        typeof contentPart === "object" &&
        contentPart !== null &&
        "text" in contentPart &&
        typeof contentPart.text === "string"
      ) {
        return contentPart.text;
      }

      return "";
    })
    .join("");
};

const callOpenRouterParser = async ({
  apiEnv,
  chainIdHint,
  fetchImplementation,
  query
}: ResolvedParseOptions): Promise<NaturalLanguageQueryResponse> => {
  const response = await fetchImplementation(openRouterEndpoint, {
    body: JSON.stringify({
      messages: [
        {
          content: buildSystemPrompt(),
          role: "system"
        },
        {
          content: JSON.stringify({
            chainIdHint: chainIdHint ?? null,
            query
          }),
          role: "user"
        }
      ],
      model: apiEnv.OPENROUTER_MODEL,
      response_format: {
        type: "json_object"
      },
      temperature: 0
    }),
    headers: {
      authorization: `Bearer ${apiEnv.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "http-referer": "https://chaingrep.xyz",
      "x-title": "chaingrep"
    },
    method: "POST"
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | {
          error?: {
            message?: string;
          };
        }
      | null;

    throw new Error(
      errorBody?.error?.message ??
        `OpenRouter request failed with status ${response.status}.`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };
  const responseText = extractMessageContent(payload.choices?.[0]?.message?.content);

  if (!responseText.trim()) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return naturalLanguageQueryResponseSchema.parse(JSON.parse(responseText) as unknown) as NaturalLanguageQueryResponse;
};

export const parseNaturalLanguageQuery = async ({
  apiEnv,
  chainIdHint,
  fetchImplementation = fetch,
  query
}: ParseNaturalLanguageQueryOptions): Promise<NaturalLanguageQueryResponse> => {
  const localRegistryParse = buildLocalRegistryParse(query, chainIdHint);
  const queryNeedsLlm = localRegistryParse === null || looksComplexQuery(query);

  if (!queryNeedsLlm && localRegistryParse) {
    return localRegistryParse;
  }

  if (!apiEnv.OPENROUTER_API_KEY) {
    return (
      localRegistryParse ??
      toReasonResponse(
        "This query needs OpenRouter parsing, but OPENROUTER_API_KEY is not configured."
      )
    );
  }

  try {
    const parsedResponse = await callOpenRouterParser({
      apiEnv,
      chainIdHint,
      fetchImplementation,
      query
    });

    if (!parsedResponse.parsed) {
      return parsedResponse;
    }

    const knownContract =
      findKnownContractByAddress(
        parsedResponse.params.contractAddress,
        parsedResponse.params.chainId
      ) ?? findKnownContract(query, parsedResponse.params.chainId);

    return knownContract
      ? {
          ...parsedResponse,
          contractName: parsedResponse.contractName ?? knownContract.name
        }
      : parsedResponse;
  } catch (error) {
    return toReasonResponse(
      error instanceof Error
        ? `Natural language parsing failed: ${error.message}`
        : "Natural language parsing failed."
    );
  }
};
