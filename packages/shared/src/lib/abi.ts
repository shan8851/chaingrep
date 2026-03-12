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

const isAbiArray = (value: unknown): value is Abi =>
  Array.isArray(value) &&
  value.every(
    (abiItem) => typeof abiItem === "object" && abiItem !== null && "type" in abiItem
  );

const isAbiEventItem = (abiItem: Abi[number]): abiItem is AbiEvent => abiItem.type === "event";

export const extractEventOptions = (abi: Abi): string[] =>
  abi.filter(isAbiEventItem).map(({ name }) => name);

export const parseManualAbi = (manualAbiText: string): Abi => {
  const parsedValue = JSON.parse(manualAbiText) as unknown;

  if (!isAbiArray(parsedValue)) {
    throw new Error("Manual ABI must be a JSON array of ABI items.");
  }

  return parsedValue;
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

  if (
    typeof payload === "object" &&
    payload !== null &&
    "result" in payload &&
    typeof payload.result === "string"
  ) {
    const parsedAbi = JSON.parse(payload.result) as unknown;

    if (isAbiArray(parsedAbi)) {
      return parsedAbi;
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
