import { userConnectionSettingsSchema } from "@chaingrep/shared";

import type { ChainId, UserConnectionSettings } from "@chaingrep/shared";

const storageKey = "chaingrep:connections";

export const emptyConnectionSettings: UserConnectionSettings = {
  rpcUrlsByChainId: {}
};

export const readConnectionSettings = (): UserConnectionSettings => {
  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return emptyConnectionSettings;
  }

  try {
    return userConnectionSettingsSchema.parse(JSON.parse(rawValue) as unknown);
  } catch {
    return emptyConnectionSettings;
  }
};

export const saveConnectionSettings = (settings: UserConnectionSettings): void => {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
};

export const clearConnectionSettings = (): void => {
  window.localStorage.removeItem(storageKey);
};

export const getChainRpcUrl = (
  settings: UserConnectionSettings,
  chainId: ChainId
): string | undefined => settings.rpcUrlsByChainId[String(chainId)];
