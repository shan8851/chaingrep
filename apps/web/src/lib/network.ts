import type { ChainId, QueryStreamMessage } from "@chaingrep/shared";

const defaultApiBaseUrl = "http://localhost:8787";

export const getApiBaseUrl = (): string =>
  import.meta.env.VITE_API_BASE_URL?.trim() || defaultApiBaseUrl;

export const testRpcEndpoint = async (
  rpcUrl: string,
  expectedChainId: ChainId
): Promise<void> => {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: []
    }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`RPC endpoint returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    result?: string;
  };

  if (!payload.result) {
    throw new Error("RPC endpoint did not return a chain id.");
  }

  if (Number(BigInt(payload.result)) !== expectedChainId) {
    throw new Error(`RPC endpoint is on chain ${payload.result}, expected ${expectedChainId}.`);
  }
};

export const readSampleStream = async (
  response: Response,
  onMessage: (message: QueryStreamMessage) => void
): Promise<void> => {
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | {
          error?: string;
        }
      | null;

    throw new Error(errorPayload?.error ?? `API request failed with status ${response.status}.`);
  }

  if (!response.body) {
    throw new Error("The sample query stream did not return a readable response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedText = "";

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      break;
    }

    bufferedText += decoder.decode(chunk.value, { stream: true });
    const lines = bufferedText.split("\n");
    bufferedText = lines.pop() ?? "";

    lines
      .filter((line) => line.trim().length > 0)
      .forEach((line) => {
        onMessage(JSON.parse(line) as QueryStreamMessage);
      });
  }

  if (bufferedText.trim()) {
    onMessage(JSON.parse(bufferedText) as QueryStreamMessage);
  }
};

export const downloadTextFile = (
  fileName: string,
  fileContents: string,
  mimeType: string
): void => {
  const blob = new Blob([fileContents], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchorElement = document.createElement("a");

  anchorElement.href = objectUrl;
  anchorElement.download = fileName;
  anchorElement.click();
  URL.revokeObjectURL(objectUrl);
};
