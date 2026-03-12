// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { QueryResult } from "@chaingrep/shared";
import type { Root } from "react-dom/client";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 112,
    getVirtualItems: () => [
      {
        end: 112,
        index: 0,
        key: "fixture-row",
        lane: 0,
        size: 112,
        start: 0
      }
    ],
    measure: () => {},
    measureElement: () => {}
  })
}));

import { ResultsTable } from "./resultsTable";

const queryResultFixture: QueryResult = {
  exportable: true,
  logs: [
    {
      address: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
      blockNumber: "24637243",
      data: "0x000000000000000000000000000000000000000000000000000000000000003c",
      decodedArgs: [
        {
          indexed: true,
          name: "token0",
          type: "address",
          value: "0x7Dc6441f7490F165830ce624aaf641B66eF52cF5"
        }
      ],
      eventName: "PoolCreated",
      id: "0x9eeb30a22184be75e866fe6a41b26f675d236376770a66acc409792b778bd2c2:104",
      logIndex: 104,
      removed: false,
      topics: [
        "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118"
      ],
      transactionHash: "0x9eeb30a22184be75e866fe6a41b26f675d236376770a66acc409792b778bd2c2"
    }
  ],
  totalDecoded: 1,
  totalFetched: 1,
  truncated: false
};

class ResizeObserverMock {
  disconnect(): void {}

  observe(): void {}

  unobserve(): void {}
}

let containerElement: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverMock
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn()
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

const renderResultsTable = async (): Promise<HTMLDivElement> => {
  containerElement = document.createElement("div");
  document.body.appendChild(containerElement);
  root = createRoot(containerElement);

  await act(async () => {
    root?.render(
      <ResultsTable
        onExportCsv={() => {}}
        onExportJson={() => {}}
        queryResult={queryResultFixture}
      />
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return containerElement;
};

describe("ResultsTable", () => {
  it("opens a drawer when a row is clicked", async () => {
    const renderedContainer = await renderResultsTable();
    const rowElement = renderedContainer.querySelector("[data-log-row]");

    expect(rowElement).not.toBeNull();

    if (!rowElement) {
      throw new Error("Expected a results row.");
    }

    await act(async () => {
      rowElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(renderedContainer.textContent).toContain("Log details");
    expect(renderedContainer.textContent).toContain("Transaction hash");
    expect(renderedContainer.textContent).toContain("PoolCreated");
  });
});
