import { base, mainnet, polygon, sepolia } from "viem/chains";

import type { Chain } from "viem";

import type { ChainId } from "./schemas";

export const averageBlockTimeSecondsByChainId: Record<ChainId, number> = {
  1: 12,
  8453: 2,
  11155111: 12,
  137: 2
};

export type SupportedChainConfig = {
  averageBlockTimeSeconds: number;
  id: ChainId;
  name: string;
  shortName: string;
  sampleBlockSpan: number;
  viemChain: Chain;
  etherscanChainId: string;
};

export const supportedChains = [
  {
    averageBlockTimeSeconds: 12,
    id: 1,
    name: "Ethereum",
    shortName: "eth",
    sampleBlockSpan: 10_000,
    viemChain: mainnet,
    etherscanChainId: "1"
  },
  {
    averageBlockTimeSeconds: 12,
    id: 11155111,
    name: "Sepolia",
    shortName: "sep",
    sampleBlockSpan: 10_000,
    viemChain: sepolia,
    etherscanChainId: "11155111"
  },
  {
    averageBlockTimeSeconds: 2,
    id: 137,
    name: "Polygon",
    shortName: "matic",
    sampleBlockSpan: 10_000,
    viemChain: polygon,
    etherscanChainId: "137"
  },
  {
    averageBlockTimeSeconds: 2,
    id: 8453,
    name: "Base",
    shortName: "base",
    sampleBlockSpan: 10_000,
    viemChain: base,
    etherscanChainId: "8453"
  }
] satisfies SupportedChainConfig[];

export const supportedChainMap = supportedChains.reduce<Record<number, SupportedChainConfig>>(
  (chainMap, chainConfig) => ({
    ...chainMap,
    [chainConfig.id]: chainConfig
  }),
  {}
);

export const getChainConfig = (chainId: ChainId): SupportedChainConfig => {
  const chainConfig = supportedChainMap[chainId];

  if (!chainConfig) {
    throw new Error(`Unsupported chain id: ${chainId}`);
  }

  return chainConfig;
};
