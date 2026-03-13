import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Download, SearchCode, UnfoldVertical } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import type { QueryResult } from "@chaingrep/shared";
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from "react";

import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { sortLogRows } from "./resultsTableUtils";
import { CopyIconButton } from "./copyIconButton";
import { LogDetailsDrawer } from "./logDetailsDrawer";
import { Badge, Button, Panel } from "./ui";

type ResultsTableProps = {
  onExportCsv: () => void;
  onExportJson: () => void;
  onLoadExample?: () => void;
  queryResult: QueryResult | null;
};

const collapsedRowHeightEstimate = 112;
const resultRowsOverscan = 8;

const handleRowKeyDown = (
  event: ReactKeyboardEvent<HTMLDivElement>,
  onOpen: () => void
): void => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen();
  }
};

export const ResultsTable = ({
  onExportCsv,
  onExportJson,
  onLoadExample,
  queryResult
}: ResultsTableProps): JSX.Element => {
  const [sortKey, setSortKey] = useState<"blockNumber" | "eventName" | "transactionHash">(
    "blockNumber"
  );
  const [descending, setDescending] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const { copyToClipboard, hasCopiedValue } = useCopyToClipboard();
  const scrollContainerReference = useRef<HTMLDivElement | null>(null);
  const deferredLogs = useDeferredValue(queryResult?.logs ?? []);
  const sortedLogs = sortLogRows(deferredLogs, sortKey, descending);
  const selectedLog =
    queryResult?.logs.find((decodedLog) => decodedLog.id === selectedLogId) ?? null;
  // TanStack Virtual is intentionally used here for large result sets, even though
  // the React Compiler plugin cannot memoize its hook return value.
  // eslint-disable-next-line react-hooks/incompatible-library
  const resultsVirtualizer = useVirtualizer({
    count: sortedLogs.length,
    getScrollElement: () => scrollContainerReference.current,
    estimateSize: () => collapsedRowHeightEstimate,
    overscan: resultRowsOverscan
  });

  useEffect(() => {
    setSelectedLogId(null);
    scrollContainerReference.current?.scrollTo({ top: 0 });
  }, [queryResult]);

  return (
    <>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-chrome-500/80 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-chrome-200">
              Results
            </p>
            <h2 className="mt-2 text-xl font-semibold text-chrome-50">
              {queryResult
                ? `${queryResult.totalDecoded} decoded log${queryResult.totalDecoded === 1 ? "" : "s"}`
                : "No query yet"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={queryResult?.truncated ? "warning" : "default"}>
              {queryResult?.truncated ? "Partial result" : "Full result"}
            </Badge>
            <Button disabled={!queryResult?.exportable} intent="secondary" onClick={onExportCsv}>
              <Download className="size-4" />
              CSV
            </Button>
            <Button disabled={!queryResult?.exportable} intent="secondary" onClick={onExportJson}>
              <Download className="size-4" />
              JSON
            </Button>
          </div>
        </div>

        {!queryResult ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="rounded-sm border border-chrome-500/80 bg-chrome-800/85 p-5 text-signal-cyan">
              <SearchCode className="size-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-chrome-50">No results yet</h3>
              <p className="max-w-lg text-sm text-chrome-200">
                Pick a contract and block range, then run a query to see decoded events.
              </p>
              {onLoadExample ? (
                <button
                  className="mt-3 text-sm text-signal-cyan underline underline-offset-4 transition hover:text-chrome-50"
                  onClick={onLoadExample}
                  type="button"
                >
                  Try an example — Uniswap V3 PoolCreated on Ethereum
                </button>
              ) : null}
            </div>
          </div>
        ) : queryResult.totalDecoded === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="rounded-sm border border-chrome-500/80 bg-chrome-800/85 p-5 text-chrome-300">
              <SearchCode className="size-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-chrome-50">No events found</h3>
              <p className="max-w-lg text-sm text-chrome-200">
                No matching events in this block range. Try a wider range or a different event filter.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[100px_minmax(0,200px)_minmax(0,1fr)_48px] gap-3 border-b border-chrome-500/80 bg-chrome-800 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-chrome-200">
              <button
                className="flex items-center gap-2 text-left"
                onClick={() => {
                  setSortKey("blockNumber");
                  setDescending(sortKey === "blockNumber" ? !descending : true);
                }}
                type="button"
              >
                Block
                <UnfoldVertical className="size-3.5" />
              </button>
              <button
                className="flex items-center gap-2 text-left"
                onClick={() => {
                  setSortKey("transactionHash");
                  setDescending(sortKey === "transactionHash" ? !descending : false);
                }}
                type="button"
              >
                Tx hash
                <UnfoldVertical className="size-3.5" />
              </button>
              <button
                className="flex items-center gap-2 text-left"
                onClick={() => {
                  setSortKey("eventName");
                  setDescending(sortKey === "eventName" ? !descending : false);
                }}
                type="button"
              >
                Event / args
                <UnfoldVertical className="size-3.5" />
              </button>
              <span />
            </div>

            <div className="max-h-[40rem] overflow-y-auto" ref={scrollContainerReference}>
            <div
              className="relative w-full"
              style={{ height: `${resultsVirtualizer.getTotalSize()}px` }}
            >
              {resultsVirtualizer.getVirtualItems().map((virtualRow) => {
                const decodedLog = sortedLogs[virtualRow.index];

                if (!decodedLog) {
                  return null;
                }

                const selected = selectedLogId === decodedLog.id;
                const openDrawer = (): void => {
                  setSelectedLogId(decodedLog.id);
                };

                return (
                  <div
                    className={`absolute left-0 top-0 w-full border-b border-chrome-600/60 px-5 py-3.5 transition ${
                      selected ? "bg-chrome-800/70" : "hover:bg-chrome-800/55"
                    }`}
                    data-index={virtualRow.index}
                    key={decodedLog.id}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <div
                      className="grid h-full cursor-pointer grid-cols-[100px_minmax(0,200px)_minmax(0,1fr)_32px] items-start gap-3"
                      data-log-row={decodedLog.id}
                      onClick={openDrawer}
                      onKeyDown={(event) => {
                        handleRowKeyDown(event, openDrawer);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="text-sm font-semibold text-chrome-50">
                        {decodedLog.blockNumber}
                      </span>
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="truncate text-sm text-chrome-200">
                          {decodedLog.transactionHash}
                        </span>
                        <CopyIconButton
                          className="size-7 shrink-0"
                          copied={hasCopiedValue(decodedLog.transactionHash)}
                          label="transaction hash"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyToClipboard(decodedLog.transactionHash);
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-3">
                          <Badge tone={decodedLog.eventName ? "success" : "default"}>
                            {decodedLog.eventName ?? "raw"}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-chrome-100">
                          {decodedLog.decodedArgs.length > 0
                            ? decodedLog.decodedArgs
                                .map(({ name, value }) => `${name}=${value}`)
                                .join(" · ")
                            : decodedLog.topics.join(" · ")}
                        </p>
                      </div>
                      <ChevronRight
                        className={`mt-1 size-4 transition ${
                          selected ? "translate-x-0.5 text-signal-cyan" : "text-chrome-300"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </>
        )}
      </Panel>
      <LogDetailsDrawer
        hasCopiedValue={hasCopiedValue}
        log={selectedLog}
        onClose={() => {
          setSelectedLogId(null);
        }}
        onCopy={(value) => {
          void copyToClipboard(value);
        }}
      />
    </>
  );
};
