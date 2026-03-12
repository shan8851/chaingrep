import { queryInputSchema } from "@chaingrep/shared";

import type { AppMode, ChainId, LogQueryInput } from "@chaingrep/shared";

export type UrlQueryDraft = {
  chainId: ChainId;
  contractAddress: string;
  eventName: string;
  fromBlock: string;
  mode: AppMode;
  toBlock: string;
};

export type SerializableQueryInput = Omit<LogQueryInput, "fromBlock" | "toBlock"> & {
  fromBlock: string;
  toBlock: string;
};

const defaultUrlQueryDraft: UrlQueryDraft = {
  chainId: 1,
  contractAddress: "",
  eventName: "",
  fromBlock: "0",
  mode: "sample",
  toBlock: "0"
};

export const readUrlQueryDraft = (search: string = window.location.search): UrlQueryDraft => {
  const searchParams = new URLSearchParams(search);
  const chainIdValue = Number(searchParams.get("chain"));

  return {
    chainId:
      chainIdValue === 1 ||
      chainIdValue === 8453 ||
      chainIdValue === 11155111 ||
      chainIdValue === 137
        ? chainIdValue
        : defaultUrlQueryDraft.chainId,
    contractAddress: searchParams.get("address") ?? defaultUrlQueryDraft.contractAddress,
    eventName: searchParams.get("event") ?? defaultUrlQueryDraft.eventName,
    fromBlock: searchParams.get("from") ?? defaultUrlQueryDraft.fromBlock,
    mode:
      searchParams.get("mode") === "direct" ? "direct" : defaultUrlQueryDraft.mode,
    toBlock: searchParams.get("to") ?? defaultUrlQueryDraft.toBlock
  };
};

export const writeUrlQueryDraft = (queryDraft: UrlQueryDraft): void => {
  const searchParams = new URLSearchParams();

  searchParams.set("chain", String(queryDraft.chainId));
  searchParams.set("mode", queryDraft.mode);

  if (queryDraft.contractAddress.trim()) {
    searchParams.set("address", queryDraft.contractAddress.trim());
  }

  if (queryDraft.fromBlock.trim()) {
    searchParams.set("from", queryDraft.fromBlock.trim());
  }

  if (queryDraft.toBlock.trim()) {
    searchParams.set("to", queryDraft.toBlock.trim());
  }

  if (queryDraft.eventName.trim()) {
    searchParams.set("event", queryDraft.eventName.trim());
  }

  window.history.replaceState({}, "", `${window.location.pathname}?${searchParams.toString()}`);
};

export const parseQueryDraft = (queryDraft: UrlQueryDraft): LogQueryInput =>
  queryInputSchema.parse({
    chainId: queryDraft.chainId,
    contractAddress: queryDraft.contractAddress.trim(),
    eventName: queryDraft.eventName.trim() || undefined,
    fromBlock: queryDraft.fromBlock.trim(),
    mode: queryDraft.mode,
    toBlock: queryDraft.toBlock.trim()
  });

export const serializeQueryInputForTransport = (
  queryInput: LogQueryInput
): SerializableQueryInput => ({
  chainId: queryInput.chainId,
  contractAddress: queryInput.contractAddress,
  ...(queryInput.eventName ? { eventName: queryInput.eventName } : {}),
  fromBlock: queryInput.fromBlock.toString(),
  mode: queryInput.mode,
  toBlock: queryInput.toBlock.toString()
});
