import type {
  LogQueryInput,
  QueryResult,
  ResolvedAbi
} from "@chaingrep/shared";

const loadSharedModule = () => import("@chaingrep/shared");

export const resolveContractAbiRuntime = async (input: {
  address: string;
  chainId: LogQueryInput["chainId"];
  etherscanApiKey?: string;
  manualAbiText?: string;
}): Promise<ResolvedAbi> => {
  const { resolveContractAbi } = await loadSharedModule();

  return resolveContractAbi(input);
};

export const runLogQueryRuntime = async (input: {
  abi?: ResolvedAbi["abi"];
  maxBlockSpan?: number;
  maxDecodedLogs?: number;
  onProgress?: (progressEvent: import("@chaingrep/shared").QueryProgressEvent) => void | Promise<void>;
  queryInput: LogQueryInput;
  rpcUrl: string;
  signal?: AbortSignal;
}): Promise<QueryResult> => {
  const { runLogQuery } = await loadSharedModule();

  return runLogQuery(input);
};

export const buildCsvExportRuntime = async (queryResult: QueryResult): Promise<string> => {
  const { buildCsvExport } = await loadSharedModule();

  return buildCsvExport(queryResult);
};

export const buildJsonExportRuntime = async (queryResult: QueryResult): Promise<string> => {
  const { buildJsonExport } = await loadSharedModule();

  return buildJsonExport(queryResult);
};
