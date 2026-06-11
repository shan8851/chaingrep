type RateLimitEntry = {
  activeRequests: number;
  requestCount: number;
  windowStartedAt: number;
};

export type RateLimiter = {
  begin: (identifier: string) => void;
  finish: (identifier: string) => void;
};

export type RateLimiterOptions = {
  activeRequestMessage?: string;
  maxActiveRequests?: number;
  maxRequestsPerWindow: number;
  maxWindowRequestMessage?: string;
  windowMs: number;
};

const getFreshEntry = (startedAt: number): RateLimitEntry => ({
  activeRequests: 0,
  requestCount: 0,
  windowStartedAt: startedAt
});

export const createRateLimiter = ({
  activeRequestMessage = "A request is already running. Wait for it to finish or cancel it.",
  maxActiveRequests,
  maxRequestsPerWindow,
  maxWindowRequestMessage = "Rate limit hit. Try again later.",
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

      if (
        maxActiveRequests !== undefined &&
        entry.activeRequests >= maxActiveRequests
      ) {
        throw new Error(activeRequestMessage);
      }

      if (entry.requestCount >= maxRequestsPerWindow) {
        throw new Error(maxWindowRequestMessage);
      }

      entry.requestCount += 1;
      entry.activeRequests += 1;
    },
    finish: (identifier) => {
      const entry = getEntry(identifier);

      entry.activeRequests = Math.max(entry.activeRequests - 1, 0);
    }
  };
};
