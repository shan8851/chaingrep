import { describe, expect, it } from "vitest";

import { isCopyableAddressValue, sortLogRows } from "./resultsTableUtils";

import type { DecodedLog } from "@chaingrep/shared";

const createDecodedLog = (
  id: string,
  blockNumber: string,
  eventName: string
): DecodedLog => ({
  id,
  address: "0x00000000000000000000000000000000000000aa",
  blockNumber,
  transactionHash: `0x${id.padStart(64, "0")}`,
  logIndex: 0,
  eventName,
  decodedArgs: [],
  topics: [],
  data: "0x",
  removed: false
});

describe("resultsTableUtils", () => {
  it("sorts block numbers numerically", () => {
    const sortedLogs = sortLogRows(
      [
        createDecodedLog("2", "20", "Transfer"),
        createDecodedLog("1", "3", "Approval")
      ],
      "blockNumber",
      true
    );

    expect(sortedLogs.map(({ blockNumber }) => blockNumber)).toEqual(["20", "3"]);
  });

  it("detects copyable address values", () => {
    expect(isCopyableAddressValue("address", "not-an-address")).toBe(true);
    expect(
      isCopyableAddressValue("uint256", "0x00000000000000000000000000000000000000aa")
    ).toBe(true);
    expect(isCopyableAddressValue("uint256", "42")).toBe(false);
  });
});
