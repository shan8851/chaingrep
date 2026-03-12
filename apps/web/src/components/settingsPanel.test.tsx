// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { SettingsPanel } from "./settingsPanel";

import type { UserConnectionSettings } from "@chaingrep/shared";
import type { Root } from "react-dom/client";

const savedSettingsFixture: UserConnectionSettings = {
  etherscanApiKey: "etherscan-saved-key",
  rpcUrlsByChainId: {
    "1": "https://ethereum.example-rpc.com"
  }
};

const draftSettingsFixture: UserConnectionSettings = {
  rpcUrlsByChainId: {
    "1": "https://ethereum.example-rpc.com",
    "8453": "https://base.example-rpc.com"
  }
};

let containerElement: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  }

  containerElement?.remove();
  containerElement = null;
});

const renderSettingsPanel = async (): Promise<HTMLDivElement> => {
  containerElement = document.createElement("div");
  document.body.appendChild(containerElement);
  root = createRoot(containerElement);

  await act(async () => {
    root?.render(
      <SettingsPanel
        onClear={() => {}}
        onClose={() => {}}
        onRpcUrlChange={() => {}}
        onSave={() => {}}
        onTestConnection={() => {}}
        onUpdateEtherscanKey={() => {}}
        open
        rpcTestStatuses={{}}
        savedSettings={savedSettingsFixture}
        settings={draftSettingsFixture}
      />
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return containerElement;
};

describe("SettingsPanel", () => {
  it("shows when connection values are saved, unsaved, or pending removal", async () => {
    const renderedContainer = await renderSettingsPanel();

    expect(renderedContainer.textContent).toContain("Saved locally");
    expect(renderedContainer.textContent).toContain("Not saved yet");
    expect(renderedContainer.textContent).toContain("Will clear on save");
  });
});
