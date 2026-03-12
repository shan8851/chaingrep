import { X } from "lucide-react";
import { useEffect } from "react";

import type { DecodedLog } from "@chaingrep/shared";
import type { JSX } from "react";

import { isCopyableAddressValue } from "./resultsTableUtils";
import { CopyIconButton } from "./copyIconButton";
import { Badge, Button, Panel } from "./ui";

type LogDetailsDrawerProps = {
  hasCopiedValue: (value: string) => boolean;
  log: DecodedLog | null;
  onClose: () => void;
  onCopy: (value: string) => void;
};

export const LogDetailsDrawer = ({
  hasCopiedValue,
  log,
  onClose,
  onCopy
}: LogDetailsDrawerProps): JSX.Element | null => {
  useEffect(() => {
    if (!log) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [log, onClose]);

  if (!log) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-chrome-900/72 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl px-4 py-4 sm:px-6">
        <Panel className="flex h-full flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-chrome-500/80 px-5 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">Log details</Badge>
                <Badge tone={log.eventName ? "success" : "default"}>
                  {log.eventName ?? "raw"}
                </Badge>
                {log.removed ? <Badge tone="danger">Removed</Badge> : null}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-chrome-50">
                  Block {log.blockNumber} · Log #{log.logIndex}
                </h2>
                <p className="text-sm text-chrome-200">
                  Full decoded payload for the selected event.
                </p>
              </div>
            </div>
            <Button aria-label="Close log details" intent="ghost" onClick={onClose} type="button">
              <X className="size-4" />
            </Button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 text-sm">
            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                Transaction hash
              </p>
              <div className="flex items-start gap-2">
                <p className="min-w-0 break-all text-chrome-50">{log.transactionHash}</p>
                <CopyIconButton
                  className="size-7 shrink-0"
                  copied={hasCopiedValue(log.transactionHash)}
                  label="transaction hash"
                  onClick={() => {
                    onCopy(log.transactionHash);
                  }}
                />
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-chrome-300">Address</p>
              <div className="flex items-start gap-2">
                <p className="min-w-0 break-all text-chrome-50">{log.address}</p>
                <CopyIconButton
                  className="size-7 shrink-0"
                  copied={hasCopiedValue(log.address)}
                  label="log address"
                  onClick={() => {
                    onCopy(log.address);
                  }}
                />
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-chrome-300">Topics</p>
              <div className="space-y-2">
                {log.topics.map((topic, topicIndex) => (
                  <div
                    className="rounded-panel border border-chrome-500/70 bg-chrome-800/70 px-3 py-2 text-chrome-50"
                    key={`${log.id}:topic:${topicIndex}`}
                  >
                    <p className="mb-1 text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                      Topic {topicIndex}
                    </p>
                    <p className="break-all">{topic}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-chrome-300">Data</p>
              <div className="rounded-panel border border-chrome-500/70 bg-chrome-800/70 px-3 py-2">
                <p className="break-all text-chrome-50">{log.data}</p>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                Decoded arguments
              </p>
              {log.decodedArgs.length > 0 ? (
                <div className="space-y-2">
                  {log.decodedArgs.map((decodedArgument) => (
                    <div
                      className="flex items-start justify-between gap-3 rounded-panel border border-chrome-500/70 bg-chrome-800/70 px-3 py-2"
                      key={`${log.id}:${decodedArgument.name}`}
                    >
                      <div className="min-w-0">
                        <span className="text-chrome-300">{decodedArgument.type}</span>{" "}
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
                            onCopy(decodedArgument.value);
                          }}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-chrome-200">No decoded arguments available for this log.</p>
              )}
            </section>
          </div>
        </Panel>
      </aside>
    </div>
  );
};
