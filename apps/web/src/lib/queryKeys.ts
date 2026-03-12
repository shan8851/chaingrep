export const queryKeys = {
  abiPreview: (chainId: number, contractAddress: string, manualAbiText: string) =>
    ["abiPreview", chainId, contractAddress.trim().toLowerCase(), manualAbiText.trim()] as const,
  rpcTest: (chainId: number, rpcUrl: string) =>
    ["rpcTest", chainId, rpcUrl.trim().toLowerCase()] as const
};
