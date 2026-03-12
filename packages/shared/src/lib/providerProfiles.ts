export type ProviderProfile = {
  label: string;
  initialChunkSize: number;
  maxChunkSize: number;
  minChunkSize: number;
  concurrency: number;
  backoffMs: number;
};

const providerProfiles = [
  {
    label: "Chainnodes",
    hostnamePatterns: ["chainnodes.org"],
    initialChunkSize: 2_000,
    maxChunkSize: 20_000,
    minChunkSize: 50,
    concurrency: 2,
    backoffMs: 600
  },
  {
    label: "Alchemy",
    hostnamePatterns: ["alchemy.com"],
    initialChunkSize: 100,
    maxChunkSize: 5_000,
    minChunkSize: 10,
    concurrency: 1,
    backoffMs: 750
  },
  {
    label: "Infura",
    hostnamePatterns: ["infura.io", "metamask.io"],
    initialChunkSize: 500,
    maxChunkSize: 5_000,
    minChunkSize: 25,
    concurrency: 1,
    backoffMs: 750
  }
] satisfies Array<ProviderProfile & { hostnamePatterns: string[] }>;

export const fallbackProviderProfile = {
  label: "Custom RPC",
  initialChunkSize: 500,
  maxChunkSize: 5_000,
  minChunkSize: 50,
  concurrency: 1,
  backoffMs: 650
} satisfies ProviderProfile;

export const detectProviderProfile = (rpcUrl: string): ProviderProfile => {
  const hostname = new URL(rpcUrl).hostname.toLowerCase();
  const matchingProfile = providerProfiles.find(({ hostnamePatterns }) =>
    hostnamePatterns.some((hostnamePattern) => hostname.includes(hostnamePattern))
  );

  if (!matchingProfile) {
    return fallbackProviderProfile;
  }

  return {
    backoffMs: matchingProfile.backoffMs,
    concurrency: matchingProfile.concurrency,
    initialChunkSize: matchingProfile.initialChunkSize,
    label: matchingProfile.label,
    maxChunkSize: matchingProfile.maxChunkSize,
    minChunkSize: matchingProfile.minChunkSize
  };
};
