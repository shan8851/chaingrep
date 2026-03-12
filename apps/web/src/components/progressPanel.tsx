import { LoaderCircle, TriangleAlert } from "lucide-react";

import type { QueryProgressEvent } from "@chaingrep/shared";
import type { JSX } from "react";

import { Badge, Panel } from "./ui";

type ProgressPanelProps = {
  errorMessage: string | null;
  progressEvents: QueryProgressEvent[];
  running: boolean;
};

const describeProgressEvent = (progressEvent: QueryProgressEvent): string => {
  switch (progressEvent.type) {
    case "started":
      return `${progressEvent.providerLabel} · ${progressEvent.totalChunks} planned chunk(s)`;
    case "chunkStarted":
      return `Scanning blocks ${progressEvent.chunkStartBlock} → ${progressEvent.chunkEndBlock}`;
    case "chunkCompleted":
      return `${progressEvent.fetchedLogs} logs from ${progressEvent.chunkStartBlock} → ${progressEvent.chunkEndBlock}`;
    case "retrying":
      return `Retrying ${progressEvent.chunkStartBlock} → ${progressEvent.chunkEndBlock}`;
    case "capped":
      return progressEvent.reason;
    case "completed":
      return progressEvent.truncated
        ? `Completed with ${progressEvent.totalDecoded} decoded logs (partial result).`
        : `Completed with ${progressEvent.totalDecoded} decoded logs.`;
    case "failed":
      return progressEvent.message;
  }
};

const eventTone = (progressEvent: QueryProgressEvent): "danger" | "default" | "success" | "warning" => {
  switch (progressEvent.type) {
    case "completed":
      return "success";
    case "retrying":
    case "capped":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "default";
  }
};

export const ProgressPanel = ({
  errorMessage,
  progressEvents,
  running
}: ProgressPanelProps): JSX.Element => (
  <Panel className="h-full p-4">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-chrome-200">
          📡 Query telemetry
        </p>
        <h2 className="mt-2 text-xl font-semibold text-chrome-50">Live status</h2>
      </div>
      {running ? (
        <Badge tone="warning">
          <LoaderCircle className="size-3.5 animate-spin" />
          Running
        </Badge>
      ) : (
        <Badge>Idle</Badge>
      )}
    </div>

    {errorMessage ? (
      <div className="mb-4 flex items-start gap-3 rounded-sm border border-signal-red/40 p-3 text-sm text-signal-red">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>{errorMessage}</p>
      </div>
    ) : null}

    <div className="space-y-2">
      {progressEvents.length === 0 ? (
        <div className="rounded-sm border border-dashed border-chrome-500/90 bg-chrome-800/70 p-3 text-sm text-chrome-200">
          Query progress streams here once you start a sample or direct search.
        </div>
      ) : (
        progressEvents
          .slice(-8)
          .reverse()
          .map((progressEvent, index) => (
            <div
              className="rounded-sm border border-chrome-500/70 bg-chrome-800/75 p-3"
              key={`${progressEvent.type}-${index}`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge tone={eventTone(progressEvent)}>{progressEvent.type}</Badge>
                {"chunkIndex" in progressEvent ? (
                  <span className="text-[11px] uppercase tracking-[0.24em] text-chrome-300">
                    chunk {progressEvent.chunkIndex + 1}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-chrome-100">{describeProgressEvent(progressEvent)}</p>
            </div>
          ))
      )}
    </div>
  </Panel>
);
