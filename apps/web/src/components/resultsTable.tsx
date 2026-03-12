import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, Download, SearchCode, UnfoldVertical } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import type { QueryResult } from "@chaingrep/shared";
import type { JSX } from "react";

import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import {
  isCopyableAddressValue,
  sortLogRows,
  updateExpandedLogIds
} from "./resultsTableUtils";
import { CopyIconButton } from "./copyIconButton";
import { Badge, Button, Panel } from "./ui";

type ResultsTableProps = {
  onExportCsv: () => void;
  onExportJson: () => void;
  queryResult: QueryResult | null;
};

const collapsedRowHeightEstimate = 112;
const expandedRowHeightEstimate = 320;
const resultRowsOverscan = 8;

export const ResultsTable = ({
  onExportCsv,
  onExportJson,
  queryResult
}: ResultsTableProps): JSX.Element => {
  const [sortKey, setSortKey] = useState<"blockNumber" | "eventName" | "transactionHash">(
    "blockNumber"
  );
  const [descending, setDescending] = useState(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(() => new Set());
  const { copyToClipboard, hasCopiedValue } = useCopyToClipboard();
  const scrollContainerReference = useRef<HTMLDivElement | null>(null);
  const deferredLogs = useDeferredValue(queryResult?.logs ?? []);
  const sortedLogs = sortLogRows(deferredLogs, sortKey, descending);
  // TanStack Virtual is intentionally used here for large result sets, even though
  // the React Compiler plugin cannot memoize its hook return value.
  // eslint-disable-next-line react-hooks/incompatible-library
  const resultsVirtualizer = useVirtualizer({
    count: sortedLogs.length,
    getScrollElement: () => scrollContainerReference.current,
    estimateSize: (index) =>
      expandedLogIds.has(sortedLogs[index]?.id ?? "")
        ? expandedRowHeightEstimate
        : collapsedRowHeightEstimate,
    overscan: resultRowsOverscan
  });

  useEffect(() => {
    setExpandedLogIds(new Set());
    scrollContainerReference.current?.scrollTo({ top: 0 });
  }, [queryResult]);

  useEffect(() => {
    resultsVirtualizer.measure();
  }, [expandedLogIds, queryResult, resultsVirtualizer, sortKey, descending]);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-chrome-500/80 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-chrome-200">
            📋 Results
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
            <h3 className="text-lg font-semibold text-chrome-50">🫥 No logs yet</h3>
            <p className="max-w-lg text-sm text-chrome-200">
              Resolve an ABI, set a block window, and run a query to inspect decoded events here.
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

                const expanded = expandedLogIds.has(decodedLog.id);

                return (
                  <details
                    className="group absolute left-0 top-0 w-full border-b border-chrome-600/60 px-5 py-3.5 open:bg-chrome-800/70"
                    data-index={virtualRow.index}
                    key={decodedLog.id}
                    onToggle={(event) => {
                      setExpandedLogIds((currentExpandedLogIds) =>
                        updateExpandedLogIds(
                          currentExpandedLogIds,
                          decodedLog.id,
                          event.currentTarget.open
                        )
                      );
                    }}
                    open={expanded}
                    ref={(element) => {
                      if (!element) {
                        return;
                      }

                      resultsVirtualizer.measureElement(element);
                    }}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <summary className="grid cursor-pointer list-none grid-cols-[100px_minmax(0,200px)_minmax(0,1fr)_48px] items-start gap-3">
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
                            event.preventDefault();
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
                      <ChevronDown className="mt-1 size-4 text-chrome-300 transition group-open:rotate-180" />
                    </summary>

                    <div className="mt-4 space-y-4 rounded-sm border border-chrome-500/70 bg-chrome-900/70 p-4 text-sm">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                            Address
                          </p>
                          <div className="flex items-start gap-2">
                            <p className="min-w-0 break-all text-chrome-50">
                              {decodedLog.address}
                            </p>
                            <CopyIconButton
                              className="size-7 shrink-0"
                              copied={hasCopiedValue(decodedLog.address)}
                              label="log address"
                              onClick={() => {
                                void copyToClipboard(decodedLog.address);
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                            Topics
                          </p>
                          <p className="break-all text-chrome-50">
                            {decodedLog.topics.join("\n")}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                          Decoded arguments
                        </p>
                        {decodedLog.decodedArgs.length > 0 ? (
                          <div className="space-y-2">
                            {decodedLog.decodedArgs.map((decodedArgument) => (
                              <div
                                className="flex items-start justify-between gap-3 rounded-panel border border-chrome-500/70 bg-chrome-800/70 px-3 py-2"
                                key={`${decodedLog.id}:${decodedArgument.name}`}
                              >
                                <div className="min-w-0">
                                  <span className="text-chrome-300">
                                    {decodedArgument.type}
                                  </span>{" "}
                                  <span className="font-semibold text-chrome-50">
                                    {decodedArgument.name}
                                  </span>{" "}
                                  <span className="break-all text-signal-cyan">
                                    {decodedArgument.value}
                                  </span>
                                </div>
                                {isCopyableAddressValue(
                                  decodedArgument.type,
                                  decodedArgument.value
                                ) ? (
                                  <CopyIconButton
                                    className="size-7 shrink-0"
                                    copied={hasCopiedValue(decodedArgument.value)}
                                    label={`${decodedArgument.name} address`}
                                    onClick={() => {
                                      void copyToClipboard(decodedArgument.value);
                                    }}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-chrome-200">
                            No decoded arguments available for this log.
                          </p>
                        )}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
};
