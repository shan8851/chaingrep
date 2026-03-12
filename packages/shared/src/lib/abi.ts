import { isAddress } from "viem";

import type { Abi, AbiEvent } from "viem";

import { getChainConfig } from "./chains";
import type { ChainId } from "./schemas";

type AbiResolutionSource = "sourcify" | "etherscan" | "manual" | "none";

export type ResolvedAbi = {
  source: AbiResolutionSource;
  abi: Abi;
  eventOptions: string[];
};

type ResolveContractAbiOptions = {
  address: string;
  chainId: ChainId;
  etherscanApiKey?: string;
  fetchImplementation?: FetchImplementation;
  manualAbiText?: string;
  signal?: AbortSignal;
};

type FetchImplementation = typeof fetch;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAbiArray = (value: unknown): value is Abi =>
  Array.isArray(value) &&
  value.every(
    (abiItem) => typeof abiItem === "object" && abiItem !== null && "type" in abiItem
  );

const isAbiEventItem = (abiItem: Abi[number]): abiItem is AbiEvent => abiItem.type === "event";

export const extractEventOptions = (abi: Abi): string[] =>
  abi.filter(isAbiEventItem).map(({ name }) => name);

const extractAbi = (value: unknown): Abi | null => {
  if (isAbiArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      return extractAbi(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  if ("result" in value) {
    return extractAbi(value.result);
  }

  if ("abi" in value) {
    return extractAbi(value.abi);
  }

  if ("output" in value && isRecord(value.output) && "abi" in value.output) {
    return extractAbi(value.output.abi);
  }

  return null;
};

export const parseManualAbi = (manualAbiText: string): Abi => {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(manualAbiText) as unknown;
  } catch {
    throw new Error(
      "Manual ABI must be a JSON ABI array or a JSON object containing a usable ABI."
    );
  }

  const extractedAbi = extractAbi(parsedValue);

  if (!extractedAbi) {
    throw new Error(
      "Manual ABI must be a JSON ABI array or a JSON object containing a usable ABI."
    );
  }

  return extractedAbi;
};

const fetchSourcifyMetadata = async (
  fetchImplementation: FetchImplementation,
  chainId: ChainId,
  address: string,
  matchLevel: "full_match" | "partial_match",
  signal?: AbortSignal
): Promise<Abi | null> => {
  const requestInit = signal ? { signal } : undefined;
  const response = await fetchImplementation(
    `https://repo.sourcify.dev/contracts/${matchLevel}/${chainId}/${address}/metadata.json`,
    requestInit
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Sourcify request failed with status ${response.status}.`);
  }

  const metadata = (await response.json()) as unknown;

  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "output" in metadata &&
    typeof metadata.output === "object" &&
    metadata.output !== null &&
    "abi" in metadata.output &&
    isAbiArray(metadata.output.abi)
  ) {
    return metadata.output.abi;
  }

  throw new Error("Sourcify returned metadata without a usable ABI.");
};

export const fetchSourcifyAbi = async (
  chainId: ChainId,
  address: string,
  signal?: AbortSignal,
  fetchImplementation: FetchImplementation = fetch
): Promise<Abi | null> => {
  const fullMatchAbi = await fetchSourcifyMetadata(
    fetchImplementation,
    chainId,
    address,
    "full_match",
    signal
  );

  if (fullMatchAbi) {
    return fullMatchAbi;
  }

  return fetchSourcifyMetadata(fetchImplementation, chainId, address, "partial_match", signal);
};

export const fetchEtherscanAbi = async (
  chainId: ChainId,
  address: string,
  apiKey: string,
  signal?: AbortSignal,
  fetchImplementation: FetchImplementation = fetch
): Promise<Abi | null> => {
  if (!apiKey.trim()) {
    return null;
  }

  const etherscanChainId = getChainConfig(chainId).etherscanChainId;
  const endpoint =
    `https://api.etherscan.io/v2/api?chainid=${etherscanChainId}` +
    `&module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
  const requestInit = signal ? { signal } : undefined;
  const response = await fetchImplementation(endpoint, requestInit);

  if (!response.ok) {
    throw new Error(`Etherscan request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;

  if (isRecord(payload) && "result" in payload) {
    const parsedAbi = extractAbi(payload.result);

    if (parsedAbi) {
      return parsedAbi;
    }

    if (payload.status === "0" && typeof payload.result === "string") {
      if (/source code not verified/i.test(payload.result)) {
        return null;
      }

      throw new Error(`Etherscan ABI lookup failed: ${payload.result}`);
    }

    return null;
  }

  return null;
};

const createResolvedAbi = (source: AbiResolutionSource, abi: Abi): ResolvedAbi => ({
  source,
  abi,
  eventOptions: extractEventOptions(abi)
});

export const resolveContractAbi = async ({
  address,
  chainId,
  etherscanApiKey,
  fetchImplementation = fetch,
  manualAbiText,
  signal
}: ResolveContractAbiOptions): Promise<ResolvedAbi> => {
  if (!isAddress(address)) {
    throw new Error("A valid contract address is required for ABI resolution.");
  }

  if (manualAbiText?.trim()) {
    return createResolvedAbi("manual", parseManualAbi(manualAbiText));
  }

  const sourcifyAbi = await fetchSourcifyAbi(
    chainId,
    address,
    signal,
    fetchImplementation
  );

  if (sourcifyAbi) {
    return createResolvedAbi("sourcify", sourcifyAbi);
  }

  if (etherscanApiKey?.trim()) {
    const etherscanAbi = await fetchEtherscanAbi(
      chainId,
      address,
      etherscanApiKey,
      signal,
      fetchImplementation
    );

    if (etherscanAbi) {
      return createResolvedAbi("etherscan", etherscanAbi);
    }
  }

  return {
    source: "none",
    abi: [],
    eventOptions: []
  };
};
