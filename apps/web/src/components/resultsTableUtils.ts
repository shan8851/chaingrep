import type { DecodedLog } from "@chaingrep/shared";

export type SortKey = "blockNumber" | "eventName" | "transactionHash";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export const sortLogRows = (
  logRows: DecodedLog[],
  sortKey: SortKey,
  descending: boolean
): DecodedLog[] =>
  [...logRows].sort((leftLog, rightLog) => {
    const comparisonValue =
      sortKey === "blockNumber"
        ? Number(BigInt(leftLog.blockNumber) - BigInt(rightLog.blockNumber))
        : (leftLog[sortKey] ?? "").localeCompare(rightLog[sortKey] ?? "");

    return descending ? comparisonValue * -1 : comparisonValue;
  });

export const isCopyableAddressValue = (type: string, value: string): boolean =>
  type.startsWith("address") || addressPattern.test(value);

export const updateExpandedLogIds = (
  currentExpandedLogIds: Set<string>,
  logId: string,
  expanded: boolean
): Set<string> => {
  const nextExpandedLogIds = new Set(currentExpandedLogIds);

  if (expanded) {
    nextExpandedLogIds.add(logId);
  } else {
    nextExpandedLogIds.delete(logId);
  }

  return nextExpandedLogIds;
};
