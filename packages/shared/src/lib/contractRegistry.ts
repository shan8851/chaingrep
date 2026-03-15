import type { ChainId } from "./schemas";

export type KnownContract = {
  address: string;
  aliases: string[];
  chainId: ChainId;
  commonEvents: string[];
  name: string;
};

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase().replaceAll(/\s+/g, " ");

const knownContracts = [
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    aliases: ["usdc", "usd coin", "circle usdc", "circle usd"],
    chainId: 1,
    commonEvents: ["Transfer", "Approval"],
    name: "USDC"
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    aliases: ["usdt", "tether", "tether usd", "tether usdt"],
    chainId: 1,
    commonEvents: ["Transfer", "Approval"],
    name: "USDT"
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    aliases: ["dai", "maker dai", "dai stablecoin", "multi collateral dai"],
    chainId: 1,
    commonEvents: ["Transfer", "Approval"],
    name: "DAI"
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    aliases: ["weth", "wrapped eth", "wrapped ether"],
    chainId: 1,
    commonEvents: ["Transfer", "Approval", "Deposit", "Withdrawal"],
    name: "WETH"
  },
  {
    address: "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6",
    aliases: ["pol", "polygon ecosystem token", "polygon token"],
    chainId: 1,
    commonEvents: ["Transfer", "Approval"],
    name: "POL"
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    aliases: ["wbtc", "wrapped btc", "wrapped bitcoin"],
    chainId: 1,
    commonEvents: ["Transfer", "Approval"],
    name: "WBTC"
  },
  {
    address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    aliases: ["uniswap v3 factory", "uni v3 factory", "univ3 factory"],
    chainId: 1,
    commonEvents: ["FeeAmountEnabled", "OwnerChanged", "PoolCreated"],
    name: "Uniswap V3 Factory"
  },
  {
    address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    aliases: ["uniswap v2 factory", "uni v2 factory", "univ2 factory"],
    chainId: 1,
    commonEvents: ["PairCreated"],
    name: "Uniswap V2 Factory"
  },
  {
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    aliases: ["uniswap v2 router", "uniswap router", "uni router", "router02"],
    chainId: 1,
    commonEvents: [],
    name: "Uniswap V2 Router"
  },
  {
    address: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    aliases: [
      "uniswap v3 position manager",
      "position manager",
      "nonfungible position manager",
      "univ3 position manager"
    ],
    chainId: 1,
    commonEvents: ["IncreaseLiquidity", "DecreaseLiquidity", "Collect", "Transfer"],
    name: "Uniswap V3 Position Manager"
  },
  {
    address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    aliases: ["permit2", "uniswap permit2"],
    chainId: 1,
    commonEvents: ["Approval", "Lockdown", "NonceInvalidation", "UnorderedNonceInvalidation"],
    name: "Permit2"
  },
  {
    address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    aliases: ["ens registry", "ethereum name service", "ens"],
    chainId: 1,
    commonEvents: ["ApprovalForAll", "NewOwner", "NewResolver", "Transfer"],
    name: "ENS Registry"
  },
  {
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    aliases: ["usdc", "usd coin", "circle usdc", "polygon usdc"],
    chainId: 137,
    commonEvents: ["Transfer", "Approval"],
    name: "USDC"
  },
  {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    aliases: ["usdc.e", "usdce", "bridged usdc", "polygon usdc.e"],
    chainId: 137,
    commonEvents: ["Transfer", "Approval"],
    name: "USDC.e"
  },
  {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    aliases: ["usdt", "tether", "polygon usdt"],
    chainId: 137,
    commonEvents: ["Transfer", "Approval"],
    name: "USDT"
  },
  {
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    aliases: ["dai", "polygon dai", "maker dai"],
    chainId: 137,
    commonEvents: ["Transfer", "Approval"],
    name: "DAI"
  },
  {
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    aliases: ["wmatic", "wrapped matic", "wrapped polygon"],
    chainId: 137,
    commonEvents: ["Transfer", "Approval", "Deposit", "Withdrawal"],
    name: "WMATIC"
  },
  {
    address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    aliases: ["uniswap v3 factory", "uni v3 factory", "univ3 factory"],
    chainId: 137,
    commonEvents: ["FeeAmountEnabled", "OwnerChanged", "PoolCreated"],
    name: "Uniswap V3 Factory"
  },
  {
    address: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    aliases: [
      "uniswap v3 position manager",
      "position manager",
      "nonfungible position manager",
      "univ3 position manager"
    ],
    chainId: 137,
    commonEvents: ["IncreaseLiquidity", "DecreaseLiquidity", "Collect", "Transfer"],
    name: "Uniswap V3 Position Manager"
  },
  {
    address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    aliases: ["permit2", "uniswap permit2"],
    chainId: 137,
    commonEvents: ["Approval", "Lockdown", "NonceInvalidation", "UnorderedNonceInvalidation"],
    name: "Permit2"
  },
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    aliases: ["usdc", "usd coin", "circle usdc", "base usdc"],
    chainId: 8453,
    commonEvents: ["Transfer", "Approval"],
    name: "USDC"
  },
  {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    aliases: ["usdt", "tether", "base usdt"],
    chainId: 8453,
    commonEvents: ["Transfer", "Approval"],
    name: "USDT"
  },
  {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    aliases: ["dai", "base dai", "maker dai"],
    chainId: 8453,
    commonEvents: ["Transfer", "Approval"],
    name: "DAI"
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    aliases: ["weth", "wrapped eth", "wrapped ether", "base weth"],
    chainId: 8453,
    commonEvents: ["Transfer", "Approval", "Deposit", "Withdrawal"],
    name: "WETH"
  },
  {
    address: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    aliases: ["uniswap v3 factory", "uni v3 factory", "univ3 factory"],
    chainId: 8453,
    commonEvents: ["FeeAmountEnabled", "OwnerChanged", "PoolCreated"],
    name: "Uniswap V3 Factory"
  },
  {
    address: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    aliases: [
      "uniswap v3 position manager",
      "position manager",
      "nonfungible position manager",
      "univ3 position manager"
    ],
    chainId: 8453,
    commonEvents: ["IncreaseLiquidity", "DecreaseLiquidity", "Collect", "Transfer"],
    name: "Uniswap V3 Position Manager"
  },
  {
    address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    aliases: ["permit2", "uniswap permit2"],
    chainId: 8453,
    commonEvents: ["Approval", "Lockdown", "NonceInvalidation", "UnorderedNonceInvalidation"],
    name: "Permit2"
  },
  {
    address: "0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC",
    aliases: ["universal router", "uniswap universal router", "router 2.0"],
    chainId: 8453,
    commonEvents: [],
    name: "Universal Router"
  }
] satisfies KnownContract[];

const createMatchScore = (query: string, knownContract: KnownContract): number => {
  const normalizedName = normalizeSearchText(knownContract.name);
  const normalizedAliases = knownContract.aliases.map(normalizeSearchText);
  const exactAliasMatch = normalizedAliases.some((alias) => alias === query);
  const aliasSubstringLengths = normalizedAliases
    .filter((alias) => query.includes(alias))
    .map((alias) => alias.length);
  const exactAddressMatch = query.includes(knownContract.address.toLowerCase());

  if (exactAddressMatch) {
    return 10_000;
  }

  if (exactAliasMatch || normalizedName === query) {
    return 9_000;
  }

  if (query.includes(normalizedName)) {
    return 8_000 + normalizedName.length;
  }

  const bestAliasLength = Math.max(...aliasSubstringLengths, 0);

  return bestAliasLength > 0 ? 7_000 + bestAliasLength : 0;
};

export { knownContracts };
export const curatedContractRegistry = knownContracts;

export const findKnownContractByAddress = (
  address: string,
  chainId?: ChainId
): KnownContract | null => {
  const normalizedAddress = address.trim().toLowerCase();
  const scopedContracts =
    chainId === undefined
      ? knownContracts
      : knownContracts.filter((c) => c.chainId === chainId);

  return scopedContracts.find(
    (c) => c.address.toLowerCase() === normalizedAddress
  ) ?? null;
};

export const findKnownContract = (
  query: string,
  chainId?: ChainId
): KnownContract | null => {
  const normalizedQuery = normalizeSearchText(query);
  const scopedContracts =
    chainId === undefined
      ? curatedContractRegistry
      : curatedContractRegistry.filter((knownContract) => knownContract.chainId === chainId);
  const bestMatch = scopedContracts.reduce<{
    contract: KnownContract | null;
    score: number;
  }>(
    (currentBestMatch, knownContract) => {
      const matchScore = createMatchScore(normalizedQuery, knownContract);

      if (matchScore <= currentBestMatch.score) {
        return currentBestMatch;
      }

      return {
        contract: knownContract,
        score: matchScore
      };
    },
    {
      contract: null,
      score: 0
    }
  );

  return bestMatch.contract;
};
