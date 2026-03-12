type RateLimitEntry = {
  activeQueries: number;
  queryCount: number;
  windowStartedAt: number;
};

export type RateLimiter = {
  begin: (identifier: string) => void;
  finish: (identifier: string) => void;
};

export type RateLimiterOptions = {
  maxQueriesPerWindow: number;
  windowMs: number;
};

const getFreshEntry = (startedAt: number): RateLimitEntry => ({
  activeQueries: 0,
  queryCount: 0,
  windowStartedAt: startedAt
});

export const createRateLimiter = ({
  maxQueriesPerWindow,
  windowMs
}: RateLimiterOptions): RateLimiter => {
  const entries = new Map<string, RateLimitEntry>();

  const getEntry = (identifier: string): RateLimitEntry => {
    const currentTimestamp = Date.now();
    const existingEntry = entries.get(identifier);

    if (!existingEntry) {
      const freshEntry = getFreshEntry(currentTimestamp);

      entries.set(identifier, freshEntry);

      return freshEntry;
    }

    if (currentTimestamp - existingEntry.windowStartedAt >= windowMs) {
      const freshEntry = getFreshEntry(currentTimestamp);

      entries.set(identifier, freshEntry);

      return freshEntry;
    }

    return existingEntry;
  };

  return {
    begin: (identifier) => {
      const entry = getEntry(identifier);

      if (entry.activeQueries > 0) {
        throw new Error("A query is already running. Wait for it to finish or cancel it.");
      }

      if (entry.queryCount >= maxQueriesPerWindow) {
        throw new Error("Rate limit hit. Add your own RPC for unlimited queries.");
      }

      entry.queryCount += 1;
      entry.activeQueries += 1;
    },
    finish: (identifier) => {
      const entry = getEntry(identifier);

      entry.activeQueries = Math.max(entry.activeQueries - 1, 0);
    }
  };
};
