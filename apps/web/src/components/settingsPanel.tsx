import { KeyRound, Network, PlugZap, X } from "lucide-react";

import { supportedChains } from "@chaingrep/shared";

import type { ChainId, UserConnectionSettings } from "@chaingrep/shared";
import type { JSX } from "react";

import { Badge, Button, Input, Label, Panel } from "./ui";

export type RpcTestStatus = {
  message: string;
  state: "error" | "idle" | "success" | "testing";
};

type SettingsPanelProps = {
  onClear: () => void;
  onClose: () => void;
  onRpcUrlChange: (chainId: ChainId, rpcUrl: string) => void;
  onSave: () => void;
  onTestConnection: (chainId: ChainId) => void;
  onUpdateEtherscanKey: (apiKey: string) => void;
  open: boolean;
  rpcTestStatuses: Record<string, RpcTestStatus | undefined>;
  settings: UserConnectionSettings;
};

const getStatusTone = (state: RpcTestStatus["state"]): "danger" | "default" | "success" | "warning" =>
  state === "success"
    ? "success"
    : state === "error"
      ? "danger"
      : state === "testing"
        ? "warning"
        : "default";

export const SettingsPanel = ({
  onClear,
  onClose,
  onRpcUrlChange,
  onSave,
  onTestConnection,
  onUpdateEtherscanKey,
  open,
  rpcTestStatuses,
  settings
}: SettingsPanelProps): JSX.Element => (
  <div
    className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
  >
    <div
      aria-hidden="true"
      className={`absolute inset-0 bg-chrome-900/72 backdrop-blur-sm transition ${
        open ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    />
    <aside
      className={`absolute right-0 top-0 h-full w-full max-w-2xl px-4 py-4 transition duration-300 sm:px-6 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <Panel className="flex h-full flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-chrome-500/80 px-5 py-4">
          <div className="space-y-2">
            <Badge tone="warning">Local only</Badge>
            <div>
              <h2 className="text-lg font-semibold text-chrome-50">Connections</h2>
              <p className="text-sm text-chrome-200">
                RPC endpoints and explorer keys stay in this browser via localStorage for convenience.
              </p>
            </div>
          </div>
          <Button aria-label="Close settings" intent="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-panel border border-chrome-400/70 bg-chrome-600/50 p-3 text-signal-cyan">
                <KeyRound className="size-4" />
              </div>
              <div>
                <Label>Etherscan V2</Label>
                <p className="text-sm text-chrome-200">
                  Optional. Used only in the browser for ABI lookup when Sourcify misses.
                </p>
              </div>
            </div>
            <Input
              autoComplete="off"
              onChange={(event) => {
                onUpdateEtherscanKey(event.target.value);
              }}
              placeholder="Paste an Etherscan V2 API key"
              type="password"
              value={settings.etherscanApiKey ?? ""}
            />
            <p className="text-xs text-chrome-300">
              Local-only convenience storage, not hardened secret storage.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-panel border border-chrome-400/70 bg-chrome-600/50 p-3 text-signal-green">
                <Network className="size-4" />
              </div>
              <div>
                <Label>Per-chain RPC</Label>
                <p className="text-sm text-chrome-200">
                  Direct mode sends queries straight from the browser to the RPC URL for that chain.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {supportedChains.map((chainConfig) => {
                const status = rpcTestStatuses[String(chainConfig.id)] ?? {
                  message: "Untested",
                  state: "idle"
                };

                return (
                  <div
                    className="rounded-sm border border-chrome-500/80 bg-chrome-800/80 p-4"
                    key={chainConfig.id}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-chrome-50">{chainConfig.name}</p>
                        <p className="text-xs text-chrome-200">Chain ID {chainConfig.id}</p>
                      </div>
                      <Badge tone={getStatusTone(status.state)}>{status.message}</Badge>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Input
                        onChange={(event) => {
                          onRpcUrlChange(chainConfig.id, event.target.value);
                        }}
                        placeholder={`https://${chainConfig.shortName}.example-rpc.com`}
                        value={settings.rpcUrlsByChainId[String(chainConfig.id)] ?? ""}
                      />
                      <Button
                        intent="secondary"
                        onClick={() => {
                          onTestConnection(chainConfig.id);
                        }}
                        type="button"
                      >
                        <PlugZap className="size-4" />
                        Test
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-chrome-500/80 px-5 py-4 sm:flex-row sm:justify-between">
          <Button intent="danger" onClick={onClear} type="button">
            Clear local settings
          </Button>
          <div className="flex gap-3">
            <Button intent="ghost" onClick={onClose} type="button">
              Close
            </Button>
            <Button intent="primary" onClick={onSave} type="button">
              Save locally
            </Button>
          </div>
        </footer>
      </Panel>
    </aside>
  </div>
);
