import {
  FileCode2,
  Orbit,
  Play,
  Save,
  Settings2,
  Square,
  X
} from "lucide-react";
import {
  startTransition,
  useEffect,
  useState
} from "react";
import { useMutation } from "@tanstack/react-query";

import type { JSX } from "react";
import {
  supportedChains
} from "@chaingrep/shared";

import type {
  ChainId,
  QueryProgressEvent,
  QueryResult,
  ResolvedAbi,
  UserConnectionSettings
} from "@chaingrep/shared";

import { ProgressPanel } from "./components/progressPanel";
import { ResultsTable } from "./components/resultsTable";
import { SettingsPanel } from "./components/settingsPanel";
import { CopyIconButton } from "./components/copyIconButton";
import { Badge, Button, Input, Label, Panel, Textarea } from "./components/ui";
import { useCopyToClipboard } from "./hooks/useCopyToClipboard";
import { downloadTextFile, getApiBaseUrl, readSampleStream, testRpcEndpoint } from "./lib/network";
import { queryKeys } from "./lib/queryKeys";
import {
  buildCsvExportRuntime,
  buildJsonExportRuntime,
  resolveContractAbiRuntime,
  runLogQueryRuntime
} from "./lib/sharedRuntime";
import {
  clearConnectionSettings,
  emptyConnectionSettings,
  getChainRpcUrl,
  readConnectionSettings,
  saveConnectionSettings
} from "./lib/settings";
import {
  parseQueryDraft,
  readUrlQueryDraft,
  serializeQueryInputForTransport,
  writeUrlQueryDraft
} from "./lib/urlState";

type QueryRuntimeState = {
  activeAbortController: AbortController | null;
  errorMessage: string | null;
  progressEvents: QueryProgressEvent[];
  queryResult: QueryResult | null;
  running: boolean;
};

type AbiRuntimeState = {
  cacheKey: string;
  errorMessage: string | null;
  resolvedAbi: ResolvedAbi | null;
};

const initialQueryRuntimeState: QueryRuntimeState = {
  activeAbortController: null,
  errorMessage: null,
  progressEvents: [],
  queryResult: null,
  running: false
};

const initialAbiRuntimeState: AbiRuntimeState = {
  cacheKey: "",
  errorMessage: null,
  resolvedAbi: null
};

const createAbiCacheKey = (
  chainId: ChainId,
  contractAddress: string,
  manualAbiText: string
): string => [chainId, contractAddress.trim().toLowerCase(), manualAbiText.trim()].join(":");

const createExportFileStem = (contractAddress: string, chainId: ChainId): string =>
  `${contractAddress.slice(0, 10).toLowerCase()}-${chainId}`;

export const App = (): JSX.Element => {
  const [queryDraft, setQueryDraft] = useState(() => readUrlQueryDraft());
  const [manualAbiText, setManualAbiText] = useState("");
  const [abiModalOpen, setAbiModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedSettings, setSavedSettings] = useState<UserConnectionSettings>(() =>
    readConnectionSettings()
  );
  const [draftSettings, setDraftSettings] = useState<UserConnectionSettings>(() =>
    readConnectionSettings()
  );
  const [rpcTestStatuses, setRpcTestStatuses] = useState<
    Record<string, { message: string; state: "error" | "idle" | "success" | "testing" }>
  >({});
  const [abiRuntimeState, setAbiRuntimeState] = useState<AbiRuntimeState>(initialAbiRuntimeState);
  const [queryRuntimeState, setQueryRuntimeState] =
    useState<QueryRuntimeState>(initialQueryRuntimeState);
  const { copyToClipboard, hasCopiedValue } = useCopyToClipboard();

  const abiResolutionMutation = useMutation({
    mutationFn: async ({
      chainId,
      contractAddress,
      etherscanApiKey,
      manualAbiText: abiText
    }: {
      chainId: ChainId;
      contractAddress: string;
      etherscanApiKey?: string;
      manualAbiText: string;
    }) =>
      resolveContractAbiRuntime({
        address: contractAddress,
        chainId,
        ...(etherscanApiKey ? { etherscanApiKey } : {}),
        ...(abiText.trim() ? { manualAbiText: abiText } : {})
      }),
    mutationKey: queryKeys.abiPreview(
      queryDraft.chainId,
      queryDraft.contractAddress,
      manualAbiText
    )
  });
  const rpcTestMutation = useMutation({
    mutationFn: async ({
      chainId,
      rpcUrl
    }: {
      chainId: ChainId;
      rpcUrl: string;
    }) => testRpcEndpoint(rpcUrl, chainId),
    mutationKey: queryKeys.rpcTest(
      queryDraft.chainId,
      draftSettings.rpcUrlsByChainId[String(queryDraft.chainId)] ?? ""
    )
  });

  const applyProgressEvent = (progressEvent: QueryProgressEvent): void => {
    startTransition(() => {
      setQueryRuntimeState((currentState) => ({
        ...currentState,
        progressEvents: [...currentState.progressEvents, progressEvent].slice(-24)
      }));
    });
  };

  useEffect(() => {
    writeUrlQueryDraft(queryDraft);
  }, [queryDraft]);

  useEffect(() => {
    const handlePopState = (): void => {
      setQueryDraft(readUrlQueryDraft(window.location.search));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const resolveAbiForCurrentDraft = async (forceRefresh = false): Promise<ResolvedAbi> => {
    const abiCacheKey = createAbiCacheKey(
      queryDraft.chainId,
      queryDraft.contractAddress,
      manualAbiText
    );

    if (
      !forceRefresh &&
      abiRuntimeState.cacheKey === abiCacheKey &&
      abiRuntimeState.resolvedAbi
    ) {
      return abiRuntimeState.resolvedAbi;
    }

    const resolvedAbi = await abiResolutionMutation.mutateAsync({
      chainId: queryDraft.chainId,
      contractAddress: queryDraft.contractAddress.trim(),
      ...(draftSettings.etherscanApiKey
        ? { etherscanApiKey: draftSettings.etherscanApiKey }
        : {}),
      manualAbiText
    });

    setAbiRuntimeState({
      cacheKey: abiCacheKey,
      errorMessage: null,
      resolvedAbi
    });

    if (
      queryDraft.eventName &&
      resolvedAbi.eventOptions.length > 0 &&
      !resolvedAbi.eventOptions.includes(queryDraft.eventName)
    ) {
      setQueryDraft((currentDraft) => ({
        ...currentDraft,
        eventName: ""
      }));
    }

    return resolvedAbi;
  };

  const handleResolveAbi = async (): Promise<void> => {
    try {
      await resolveAbiForCurrentDraft(true);
    } catch (error) {
      setAbiRuntimeState({
        cacheKey: "",
        errorMessage: error instanceof Error ? error.message : "Failed to resolve ABI.",
        resolvedAbi: null
      });
    }
  };

  const handleRunQuery = async (): Promise<void> => {
    try {
      const parsedQueryInput = parseQueryDraft(queryDraft);
      const resolvedAbi = await resolveAbiForCurrentDraft();
      const activeAbortController = new AbortController();

      setQueryRuntimeState({
        activeAbortController,
        errorMessage: null,
        progressEvents: [],
        queryResult: null,
        running: true
      });

      if (parsedQueryInput.mode === "direct") {
        const rpcUrl = getChainRpcUrl(savedSettings, parsedQueryInput.chainId);

        if (!rpcUrl) {
          throw new Error("Save an RPC URL for the selected chain before using direct mode.");
        }

        const directQueryResult = await runLogQueryRuntime({
          ...(resolvedAbi.abi.length > 0 ? { abi: resolvedAbi.abi } : {}),
          onProgress: async (progressEvent) => {
            applyProgressEvent(progressEvent);
          },
          queryInput: parsedQueryInput,
          rpcUrl,
          signal: activeAbortController.signal
        });

        startTransition(() => {
          setQueryRuntimeState((currentState) => ({
            ...currentState,
            activeAbortController: null,
            errorMessage: null,
            queryResult: directQueryResult,
            running: false
          }));
        });

        return;
      }

      const sampleResponse = await fetch(`${getApiBaseUrl()}/api/sample/query/stream`, {
        body: JSON.stringify({
          ...(resolvedAbi.abi.length > 0 ? { abi: resolvedAbi.abi } : {}),
          queryInput: serializeQueryInputForTransport(parsedQueryInput)
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST",
        signal: activeAbortController.signal
      });
      let streamedQueryResult: QueryResult | null = null;
      let streamedErrorMessage: string | null = null;

      await readSampleStream(sampleResponse, (message) => {
        if (message.kind === "progress") {
          applyProgressEvent(message.progress);
        }

        if (message.kind === "result") {
          streamedQueryResult = message.result;
        }

        if (message.kind === "error") {
          streamedErrorMessage = message.error;
        }
      });

      if (streamedErrorMessage) {
        throw new Error(streamedErrorMessage);
      }

      if (!streamedQueryResult) {
        throw new Error("The sample query finished without a result payload.");
      }

      startTransition(() => {
        setQueryRuntimeState((currentState) => ({
          ...currentState,
          activeAbortController: null,
          queryResult: streamedQueryResult,
          running: false
        }));
      });
    } catch (error) {
      const wasCancelled =
        error instanceof DOMException && error.name === "AbortError";

      startTransition(() => {
        setQueryRuntimeState((currentState) => ({
          ...currentState,
          activeAbortController: null,
          errorMessage: wasCancelled
            ? "Query cancelled."
            : error instanceof Error
              ? error.message
              : "Query failed.",
          running: false
        }));
      });
    }
  };

  const activeChainRpcUrl = draftSettings.rpcUrlsByChainId[String(queryDraft.chainId)] ?? "";
  const canRunDirectMode =
    queryDraft.mode === "sample" || Boolean(getChainRpcUrl(savedSettings, queryDraft.chainId));
  const chainConfig = supportedChains.find(
    (supportedChain) => supportedChain.id === queryDraft.chainId
  );

  return (
    <div className="min-h-screen bg-chrome-900 text-chrome-50">
      <SettingsPanel
        onClear={() => {
          clearConnectionSettings();
          setDraftSettings(emptyConnectionSettings);
          setSavedSettings(emptyConnectionSettings);
          setRpcTestStatuses({});
        }}
        onClose={() => {
          setDraftSettings(savedSettings);
          setSettingsOpen(false);
        }}
        onRpcUrlChange={(chainId, rpcUrl) => {
          setDraftSettings((currentSettings) => ({
            ...currentSettings,
            rpcUrlsByChainId: {
              ...currentSettings.rpcUrlsByChainId,
              [String(chainId)]: rpcUrl
            }
          }));
        }}
        onSave={() => {
          saveConnectionSettings(draftSettings);
          setSavedSettings(draftSettings);
          setSettingsOpen(false);
        }}
        onTestConnection={async (chainId) => {
          const rpcUrl = draftSettings.rpcUrlsByChainId[String(chainId)]?.trim();

          if (!rpcUrl) {
            setRpcTestStatuses((currentStatuses) => ({
              ...currentStatuses,
              [String(chainId)]: {
                message: "Enter an RPC URL first",
                state: "error"
              }
            }));

            return;
          }

          setRpcTestStatuses((currentStatuses) => ({
            ...currentStatuses,
            [String(chainId)]: {
              message: "Testing",
              state: "testing"
            }
          }));

          try {
            await rpcTestMutation.mutateAsync({
              chainId,
              rpcUrl
            });

            setRpcTestStatuses((currentStatuses) => ({
              ...currentStatuses,
              [String(chainId)]: {
                message: "Connection OK",
                state: "success"
              }
            }));
          } catch (error) {
            setRpcTestStatuses((currentStatuses) => ({
              ...currentStatuses,
              [String(chainId)]: {
                message: error instanceof Error ? error.message : "Connection failed",
                state: "error"
              }
            }));
          }
        }}
        onUpdateEtherscanKey={(apiKey) => {
          setDraftSettings((currentSettings) => ({
            ...currentSettings,
            etherscanApiKey: apiKey || undefined
          }));
        }}
        open={settingsOpen}
        rpcTestStatuses={rpcTestStatuses}
        settings={draftSettings}
      />

      <div>
        <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-chrome-500/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-chrome-50">⛓ chaingrep</h1>
              <p className="text-sm text-chrome-300">🔍 browser-first EVM event grep</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={queryDraft.mode === "direct" ? "success" : "warning"}>
                {queryDraft.mode === "direct" ? "Direct BYOK" : "Anonymous sample"}
              </Badge>
              <Button
                intent="secondary"
                onClick={() => {
                  setSettingsOpen(true);
                }}
                type="button"
              >
                <Settings2 className="size-4" />
                Connections
              </Button>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <Panel className="p-6 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-chrome-200">
                  Query builder
                </p>
                <div className="flex rounded-sm border border-chrome-500/80 bg-chrome-800/90 p-1">
                  <button
                    className={`rounded-sm px-4 py-2 text-sm font-semibold transition ${
                      queryDraft.mode === "sample"
                        ? "bg-signal-orange/18 text-signal-orange"
                        : "text-chrome-200"
                    }`}
                    onClick={() => {
                      setQueryDraft((currentDraft) => ({
                        ...currentDraft,
                        mode: "sample"
                      }));
                    }}
                    type="button"
                  >
                    Sample
                  </button>
                  <div className="mx-0.5 w-px self-stretch bg-chrome-500/80" />
                  <button
                    className={`rounded-sm px-4 py-2 text-sm font-semibold transition ${
                      queryDraft.mode === "direct"
                        ? "bg-signal-green/18 text-signal-green"
                        : "text-chrome-200"
                    }`}
                    onClick={() => {
                      setQueryDraft((currentDraft) => ({
                        ...currentDraft,
                        mode: "direct"
                      }));
                    }}
                    type="button"
                  >
                    Direct BYOK
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Chain</Label>
                  <div className="rounded-panel border border-chrome-400/70 bg-chrome-700/80">
                    <select
                      className="h-10 w-full bg-transparent px-4 text-sm text-chrome-50 outline-none [color-scheme:dark]"
                      onChange={(event) => {
                        setQueryDraft((currentDraft) => ({
                          ...currentDraft,
                          chainId: Number(event.target.value) as ChainId
                        }));
                      }}
                      value={queryDraft.chainId}
                    >
                      {supportedChains.map((supportedChain) => (
                        <option
                          className="bg-chrome-800 text-chrome-50"
                          key={supportedChain.id}
                          value={supportedChain.id}
                        >
                          {supportedChain.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contract address</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      onChange={(event) => {
                        setQueryDraft((currentDraft) => ({
                          ...currentDraft,
                          contractAddress: event.target.value
                        }));
                      }}
                      placeholder="0x..."
                      spellCheck={false}
                      value={queryDraft.contractAddress}
                    />
                    <CopyIconButton
                      className="size-11 shrink-0"
                      copied={hasCopiedValue(queryDraft.contractAddress.trim())}
                      disabled={!queryDraft.contractAddress.trim()}
                      label="contract address"
                      onClick={() => {
                        void copyToClipboard(queryDraft.contractAddress.trim());
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>From block</Label>
                  <Input
                    inputMode="numeric"
                    onChange={(event) => {
                      setQueryDraft((currentDraft) => ({
                        ...currentDraft,
                        fromBlock: event.target.value
                      }));
                    }}
                    value={queryDraft.fromBlock}
                  />
                </div>

                <div className="space-y-2">
                  <Label>To block</Label>
                  <Input
                    inputMode="numeric"
                    onChange={(event) => {
                      setQueryDraft((currentDraft) => ({
                        ...currentDraft,
                        toBlock: event.target.value
                      }));
                    }}
                    value={queryDraft.toBlock}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Event filter</Label>
                <div className="rounded-panel border border-chrome-400/70 bg-chrome-700/80">
                  <select
                    className="h-10 w-full bg-transparent px-4 text-sm text-chrome-50 outline-none [color-scheme:dark] disabled:cursor-not-allowed disabled:text-chrome-300"
                    disabled={abiRuntimeState.resolvedAbi?.eventOptions.length === 0}
                    onChange={(event) => {
                      setQueryDraft((currentDraft) => ({
                        ...currentDraft,
                        eventName: event.target.value
                      }));
                    }}
                    value={queryDraft.eventName}
                  >
                    <option className="bg-chrome-800 text-chrome-50" value="">
                      All decoded events
                    </option>
                    {(abiRuntimeState.resolvedAbi?.eventOptions ?? []).map((eventName) => (
                      <option
                        className="bg-chrome-800 text-chrome-50"
                        key={eventName}
                        value={eventName}
                      >
                        {eventName}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-chrome-300">
                  {abiRuntimeState.resolvedAbi?.eventOptions.length
                    ? `${abiRuntimeState.resolvedAbi.eventOptions.length} event(s) available from the active ABI.`
                    : "Resolve or paste an ABI to filter by event name."}
                </p>
              </div>

              <div className="mt-5 rounded-sm border border-chrome-500/80 bg-chrome-800/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-panel border border-chrome-500/80 bg-chrome-700/70 p-2.5 text-signal-cyan">
                      <Orbit className="size-4" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={abiRuntimeState.resolvedAbi?.source === "none" ? "warning" : "success"}>
                        {abiRuntimeState.resolvedAbi?.source ?? "idle"}
                      </Badge>
                      {abiResolutionMutation.isPending ? (
                        <Badge tone="warning">Resolving</Badge>
                      ) : null}
                      <span className="text-sm text-chrome-200">
                        {abiRuntimeState.errorMessage ??
                          (abiRuntimeState.resolvedAbi?.source === "none"
                            ? "No explorer ABI found. Manual ABI still works."
                            : abiRuntimeState.resolvedAbi
                              ? `${abiRuntimeState.resolvedAbi.eventOptions.length} event(s) ready.`
                              : "Resolve an ABI before running a filtered query.")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      intent="ghost"
                      onClick={() => {
                        setAbiModalOpen(true);
                      }}
                      type="button"
                    >
                      <FileCode2 className="size-4" />
                      Paste ABI
                    </Button>
                    <Button intent="secondary" onClick={handleResolveAbi} type="button">
                      <Save className="size-4" />
                      Resolve
                    </Button>
                  </div>
                </div>
              </div>

              {abiModalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-chrome-900/80 backdrop-blur-sm"
                    onClick={() => {
                      setAbiModalOpen(false);
                    }}
                  />
                  <div className="relative w-full max-w-2xl rounded-sm border border-chrome-500/80 bg-chrome-700 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <Label>Manual ABI fallback</Label>
                      <button
                        className="text-chrome-300 transition hover:text-chrome-50"
                        onClick={() => {
                          setAbiModalOpen(false);
                        }}
                        type="button"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <Textarea
                      className="min-h-60"
                      onChange={(event) => {
                        setManualAbiText(event.target.value);
                      }}
                      placeholder='[{"type":"event","name":"Transfer",...}]'
                      spellCheck={false}
                      value={manualAbiText}
                    />
                    <p className="mt-2 text-xs text-chrome-300">
                      Sourcify first, then your Etherscan key, then this manual ABI.
                    </p>
                    <div className="mt-4 flex justify-end">
                      <Button
                        intent="primary"
                        onClick={() => {
                          setAbiModalOpen(false);
                        }}
                        type="button"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-4 border-t border-chrome-500/80 pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={queryDraft.mode === "sample" ? "warning" : "success"}>
                      {queryDraft.mode === "sample"
                        ? `${chainConfig?.sampleBlockSpan ?? 0} block sample cap`
                        : "Direct mode from this browser"}
                    </Badge>
                    {!canRunDirectMode ? (
                      <Badge tone="danger">Missing saved RPC for this chain</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-chrome-200">
                    {queryDraft.mode === "sample"
                      ? "Hosted sample mode is meant to be useful for quick testing and many lightweight searches, but it still has rate limits and caps."
                      : activeChainRpcUrl
                        ? `Direct mode uses ${activeChainRpcUrl} from localStorage and does not send that RPC URL to our server.`
                        : "Save a chain-specific RPC URL in Connections to use direct mode."}
                  </p>
                </div>

                <div className="shrink-0">
                  {queryRuntimeState.running ? (
                    <Button
                      className="whitespace-nowrap"
                      intent="danger"
                      onClick={() => {
                        queryRuntimeState.activeAbortController?.abort();
                      }}
                      type="button"
                    >
                      <Square className="size-4" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      className="whitespace-nowrap"
                      disabled={!canRunDirectMode}
                      intent="primary"
                      onClick={handleRunQuery}
                      type="button"
                    >
                      <Play className="size-4" />
                      Run query
                    </Button>
                  )}
                </div>
              </div>
            </Panel>

            <ProgressPanel
              errorMessage={queryRuntimeState.errorMessage}
              progressEvents={queryRuntimeState.progressEvents}
              running={queryRuntimeState.running}
            />
          </div>

          <ResultsTable
            onExportCsv={() => {
              if (!queryRuntimeState.queryResult) {
                return;
              }

              void buildCsvExportRuntime(queryRuntimeState.queryResult).then((csvExport) => {
                downloadTextFile(
                  `${createExportFileStem(queryDraft.contractAddress, queryDraft.chainId)}.csv`,
                  csvExport,
                  "text/csv;charset=utf-8"
                );
              });
            }}
            onExportJson={() => {
              if (!queryRuntimeState.queryResult) {
                return;
              }

              void buildJsonExportRuntime(queryRuntimeState.queryResult).then((jsonExport) => {
                downloadTextFile(
                  `${createExportFileStem(queryDraft.contractAddress, queryDraft.chainId)}.json`,
                  jsonExport,
                  "application/json;charset=utf-8"
                );
              });
            }}
            queryResult={queryRuntimeState.queryResult}
          />
        </main>
      </div>
    </div>
  );
};
