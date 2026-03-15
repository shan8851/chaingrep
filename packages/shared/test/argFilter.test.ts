import { describe, expect, it } from "vitest";

import { filterDecodedLogs } from "../src/lib/argFilter";

import type { ArgFilter, DecodedLog } from "../src/lib/schemas";

const createDecodedLog = (
  id: string,
  decodedArgs: DecodedLog["decodedArgs"]
): DecodedLog => ({
  address: "0x00000000000000000000000000000000000000aa",
  blockNumber: "10",
  data: "0x",
  decodedArgs,
  eventName: "Transfer",
  id,
  logIndex: 0,
  removed: false,
  topics: [],
  transactionHash: `0x${id.padStart(64, "0")}`
});

describe("filterDecodedLogs", () => {
  it("filters numeric arguments with bigint comparisons", () => {
    const filters: ArgFilter[] = [
      {
        argName: "value",
        operator: ">",
        value: "1000"
      }
    ];
    const decodedLogs = [
      createDecodedLog("1", [
        {
          indexed: false,
          name: "value",
          type: "uint256",
          value: "999"
        }
      ]),
      createDecodedLog("2", [
        {
          indexed: false,
          name: "value",
          type: "uint256",
          value: "1001"
        }
      ])
    ];

    expect(filterDecodedLogs(decodedLogs, filters).map(({ id }) => id)).toEqual(["2"]);
  });

  it("compares addresses case-insensitively", () => {
    const filters: ArgFilter[] = [
      {
        argName: "from",
        operator: "==",
        value: "0x00000000000000000000000000000000000000AA"
      }
    ];
    const decodedLogs = [
      createDecodedLog("1", [
        {
          indexed: true,
          name: "from",
          type: "address",
          value: "0x00000000000000000000000000000000000000aa"
        }
      ])
    ];

    expect(filterDecodedLogs(decodedLogs, filters)).toHaveLength(1);
  });

  it("compares string arguments case-insensitively for equality", () => {
    const filters: ArgFilter[] = [
      {
        argName: "status",
        operator: "==",
        value: "success"
      }
    ];
    const decodedLogs = [
      createDecodedLog("1", [
        {
          indexed: false,
          name: "status",
          type: "string",
          value: "SUCCESS"
        }
      ])
    ];

    expect(filterDecodedLogs(decodedLogs, filters)).toHaveLength(1);
  });

  it("excludes logs when an argument is missing", () => {
    const filters: ArgFilter[] = [
      {
        argName: "recipient",
        operator: "==",
        value: "0x00000000000000000000000000000000000000aa"
      }
    ];
    const decodedLogs = [
      createDecodedLog("1", [
        {
          indexed: true,
          name: "from",
          type: "address",
          value: "0x00000000000000000000000000000000000000aa"
        }
      ])
    ];

    expect(filterDecodedLogs(decodedLogs, filters)).toHaveLength(0);
  });
});
