import {
  FileCode2,
  Github,
  Globe,
  LoaderCircle,
  Orbit,
  Play,
  Save,
  Settings2,
  Square,
  Timer,
  X
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useState
} from "react";
import { useMutation } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";

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
import { Badge, Button, Input, Label, Panel, Select, Textarea } from "./components/ui";
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

const EXAMPLE_QUERY = {
  chainId: 1 as ChainId,
  contractAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  eventName: "PoolCreated",
  fromBlock: "24637226",
  mode: "sample" as const,
  toBlock: "24637326"
};

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
  const [fetchingLatestBlock, setFetchingLatestBlock] = useState(false);

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

  useEffect(() => {
    const hasRpcForChain = Boolean(getChainRpcUrl(savedSettings, queryDraft.chainId));

    setQueryDraft((currentDraft) => ({
      ...currentDraft,
      mode: hasRpcForChain ? "direct" : "sample"
    }));
  }, [savedSettings, queryDraft.chainId]);

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
          throw new Error("No RPC URL saved for this chain — add one in settings.");
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
        throw new Error("Query finished but returned no result. Try again or check the block range.");
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

  const chainConfig = supportedChains.find(
    (supportedChain) => supportedChain.id === queryDraft.chainId
  );

  const handleFetchRecentBlocks = useCallback(async (): Promise<void> => {
    if (!chainConfig) {
      return;
    }

    setFetchingLatestBlock(true);

    try {
      const rpcUrl = getChainRpcUrl(savedSettings, queryDraft.chainId);
      const publicClient = createPublicClient({
        chain: chainConfig.viemChain,
        transport: http(rpcUrl ?? undefined, { retryCount: 0, timeout: 10_000 })
      });
      const latestBlock = await publicClient.getBlockNumber();
      const latestBlockNumber = Number(latestBlock);

      setQueryDraft((currentDraft) => ({
        ...currentDraft,
        fromBlock: String(latestBlockNumber - 9_999),
        toBlock: String(latestBlockNumber)
      }));
    } catch {
      // silently fail — the user can still type manually
    } finally {
      setFetchingLatestBlock(false);
    }
  }, [chainConfig, queryDraft.chainId, savedSettings]);

  const handleLoadExample = async (): Promise<void> => {
    setQueryDraft(EXAMPLE_QUERY);
    setManualAbiText("");

    try {
      const resolvedAbi = await abiResolutionMutation.mutateAsync({
        chainId: EXAMPLE_QUERY.chainId,
        contractAddress: EXAMPLE_QUERY.contractAddress,
        ...(savedSettings.etherscanApiKey
          ? { etherscanApiKey: savedSettings.etherscanApiKey }
          : {}),
        manualAbiText: ""
      });

      setAbiRuntimeState({
        cacheKey: createAbiCacheKey(EXAMPLE_QUERY.chainId, EXAMPLE_QUERY.contractAddress, ""),
        errorMessage: null,
        resolvedAbi
      });

      const parsedQueryInput = parseQueryDraft(EXAMPLE_QUERY);
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
          throw new Error("No RPC URL saved for this chain — add one in settings.");
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
        throw new Error("Query finished but returned no result. Try again or check the block range.");
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
        savedSettings={savedSettings}
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
              {queryDraft.mode === "direct" ? (
                <Badge tone="success">Your RPC</Badge>
              ) : null}
              <Button
                aria-label="Settings"
                intent="secondary"
                onClick={() => {
                  setSettingsOpen(true);
                }}
                type="button"
              >
                <Settings2 className="size-4" />
              </Button>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <Panel className="p-6 sm:p-8">
              <div className="mb-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-chrome-200">
                  Query builder
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Chain</Label>
                  <Select
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
                  </Select>
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
                      const newFromBlock = event.target.value;

                      setQueryDraft((currentDraft) => {
                        const fromNum = Number(newFromBlock);
                        const toNum = Number(currentDraft.toBlock);
                        const hasValidFrom =
                          newFromBlock.trim() !== "" &&
                          Number.isFinite(fromNum) &&
                          fromNum >= 0;
                        const shouldAutoFillTo =
                          hasValidFrom &&
                          (!currentDraft.toBlock.trim() ||
                            (Number.isFinite(toNum) && toNum <= fromNum));

                        return {
                          ...currentDraft,
                          fromBlock: newFromBlock,
                          ...(shouldAutoFillTo
                            ? { toBlock: String(fromNum + 9_999) }
                            : {})
                        };
                      });
                    }}
                    placeholder="Start block"
                    value={queryDraft.fromBlock}
                  />
                </div>

                <div className="space-y-2">
                  <Label>To block</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      onChange={(event) => {
                        setQueryDraft((currentDraft) => ({
                          ...currentDraft,
                          toBlock: event.target.value
                        }));
                      }}
                      placeholder="End block"
                      value={queryDraft.toBlock}
                    />
                    <Button
                      className="h-10 shrink-0 whitespace-nowrap text-xs"
                      disabled={fetchingLatestBlock || queryRuntimeState.running}
                      intent="ghost"
                      onClick={() => {
                        void handleFetchRecentBlocks();
                      }}
                      title="Set block range to the most recent 10,000 blocks"
                      type="button"
                    >
                      {fetchingLatestBlock ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Timer className="size-3.5" />
                      )}
                      Recent 10K
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Event filter</Label>
                <Select
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
                </Select>
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
                            ? "No explorer ABI found. You can still paste one manually."
                            : abiRuntimeState.resolvedAbi
                              ? `${abiRuntimeState.resolvedAbi.eventOptions.length} event(s) ready.`
                              : "Hit Resolve to load the ABI, or paste one manually.")}
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
                      <Label>Manual ABI override</Label>
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
                      Overrides the automatic lookup. Raw ABI arrays and etherscan-style response objects both work.
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
                  {queryDraft.mode === "sample" ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="warning">
                        {chainConfig?.sampleBlockSpan ?? 0} block range limit
                      </Badge>
                    </div>
                  ) : null}
                  <p className="text-sm text-chrome-200">
                    {queryDraft.mode === "sample" ? (
                      <>
                        Want unlimited queries?{" "}
                        <button
                          className="text-signal-cyan underline underline-offset-4 transition hover:text-chrome-50"
                          onClick={() => {
                            setSettingsOpen(true);
                          }}
                          type="button"
                        >
                          Add your own RPC →
                        </button>
                      </>
                    ) : (
                      "Queries go straight to the chain from your browser."
                    )}
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
            onLoadExample={() => {
              void handleLoadExample();
            }}
            queryResult={queryRuntimeState.queryResult}
          />

          <footer className="mt-8 border-t border-chrome-500/80 py-6 text-center">
            <div className="flex items-center justify-center gap-5">
              <a
                className="text-chrome-300 transition hover:text-chrome-50"
                href="https://github.com/shan8851"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github className="size-4" />
              </a>
              <a
                className="text-chrome-300 transition hover:text-chrome-50"
                href="https://x.com/shan8851"
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                className="text-chrome-300 transition hover:text-chrome-50"
                href="https://shan8851.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Globe className="size-4" />
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
