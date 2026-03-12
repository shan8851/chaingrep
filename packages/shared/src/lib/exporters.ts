import type { DecodedLog, QueryResult } from "./schemas";

const escapeCsvValue = (value: string): string => {
  const escapedValue = value.replaceAll('"', '""');

  return `"${escapedValue}"`;
};

const formatDecodedArgs = (decodedLog: DecodedLog): string =>
  decodedLog.decodedArgs
    .map(
      ({ indexed, name, type, value }) =>
        `${name || "arg"}:${type}${indexed ? ":indexed" : ""}=${value}`
    )
    .join(" | ");

export const buildCsvExport = (queryResult: QueryResult): string => {
  const header = ["blockNumber", "transactionHash", "logIndex", "eventName", "decodedArgs"];
  const rows = queryResult.logs.map((decodedLog) => [
    decodedLog.blockNumber,
    decodedLog.transactionHash,
    String(decodedLog.logIndex),
    decodedLog.eventName ?? "",
    formatDecodedArgs(decodedLog)
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
};

export const buildJsonExport = (queryResult: QueryResult): string =>
  JSON.stringify(queryResult, null, 2);
