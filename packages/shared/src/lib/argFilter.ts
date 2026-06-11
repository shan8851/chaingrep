import type { ArgFilter, DecodedArgument, DecodedLog } from "./schemas";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const integerPattern = /^-?\d+$/;

const findDecodedArgument = (
  decodedLog: DecodedLog,
  argName: string
): DecodedArgument | undefined => {
  const normalizedArgName = argName.trim().toLowerCase();

  return decodedLog.decodedArgs.find(
    ({ name }) => name.trim().toLowerCase() === normalizedArgName
  );
};

const isIntegerString = (value: string): boolean => integerPattern.test(value.trim());

const isAddressComparison = (
  decodedArgument: DecodedArgument,
  filterValue: string
): boolean =>
  decodedArgument.type.toLowerCase().startsWith("address") ||
  addressPattern.test(decodedArgument.value) ||
  addressPattern.test(filterValue);

const compareBigIntValues = (leftValue: bigint, rightValue: bigint): number =>
  leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;

const compareNormalizedStrings = (leftValue: string, rightValue: string): number =>
  leftValue.localeCompare(rightValue, undefined, {
    sensitivity: "accent"
  });

const matchesOrderedComparison = (
  comparisonResult: number,
  operator: ArgFilter["operator"]
): boolean => {
  switch (operator) {
    case ">":
      return comparisonResult > 0;
    case "<":
      return comparisonResult < 0;
    case ">=":
      return comparisonResult >= 0;
    case "<=":
      return comparisonResult <= 0;
    case "==":
      return comparisonResult === 0;
    case "!=":
      return comparisonResult !== 0;
  }
};

const matchesFilter = (decodedArgument: DecodedArgument, filter: ArgFilter): boolean => {
  const decodedValue = decodedArgument.value.trim();
  const filterValue = filter.value.trim();

  if (isIntegerString(decodedValue) && isIntegerString(filterValue)) {
    return matchesOrderedComparison(
      compareBigIntValues(BigInt(decodedValue), BigInt(filterValue)),
      filter.operator
    );
  }

  if (filter.operator !== "==" && filter.operator !== "!=") {
    return false;
  }

  if (isAddressComparison(decodedArgument, filterValue)) {
    return matchesOrderedComparison(
      compareNormalizedStrings(decodedValue.toLowerCase(), filterValue.toLowerCase()),
      filter.operator
    );
  }

  return matchesOrderedComparison(
    compareNormalizedStrings(decodedValue.toLowerCase(), filterValue.toLowerCase()),
    filter.operator
  );
};

export const filterDecodedLogs = (
  decodedLogs: DecodedLog[],
  filters: ArgFilter[]
): DecodedLog[] => {
  if (filters.length === 0) {
    return decodedLogs;
  }

  return decodedLogs.filter((decodedLog) =>
    filters.every((filter) => {
      const decodedArgument = findDecodedArgument(decodedLog, filter.argName);

      if (!decodedArgument) {
        return false;
      }

      return matchesFilter(decodedArgument, filter);
    })
  );
};
