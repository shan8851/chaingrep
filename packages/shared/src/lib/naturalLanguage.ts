export const latestBlockReference = "latest";
export const autoBlockReferencePattern = /^auto:\d+(?:h|d)$/i;

export const isAutoBlockReference = (value: string): boolean =>
  autoBlockReferencePattern.test(value.trim());

export const isLatestBlockReference = (value: string): boolean =>
  value.trim().toLowerCase() === latestBlockReference;

export const parseAutoBlockReference = (
  value: string
): { amount: number; unit: "d" | "h" } | null => {
  const normalizedValue = value.trim().toLowerCase();
  const matchedValue = normalizedValue.match(/^auto:(\d+)(h|d)$/);

  if (!matchedValue) {
    return null;
  }

  return {
    amount: Number(matchedValue[1]),
    unit: matchedValue[2] as "d" | "h"
  };
};
