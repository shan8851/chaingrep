import { useEffect, useRef, useState } from "react";

type UseCopyToClipboardResult = {
  copiedValue: string | null;
  copyToClipboard: (value: string) => Promise<void>;
  hasCopiedValue: (value: string) => boolean;
};

const fallbackCopyToClipboard = (value: string): void => {
  const textareaElement = document.createElement("textarea");

  textareaElement.value = value;
  textareaElement.setAttribute("readonly", "");
  textareaElement.style.position = "absolute";
  textareaElement.style.left = "-9999px";
  document.body.append(textareaElement);
  textareaElement.select();

  const copied = document.execCommand("copy");

  textareaElement.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
};

const writeToClipboard = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  fallbackCopyToClipboard(value);
};

export const useCopyToClipboard = (resetAfterMs = 1800): UseCopyToClipboardResult => {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const timeoutReference = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutReference.current) {
        window.clearTimeout(timeoutReference.current);
      }
    },
    []
  );

  const copyToClipboard = async (value: string): Promise<void> => {
    await writeToClipboard(value);

    if (timeoutReference.current) {
      window.clearTimeout(timeoutReference.current);
    }

    setCopiedValue(value);
    timeoutReference.current = window.setTimeout(() => {
      setCopiedValue(null);
      timeoutReference.current = null;
    }, resetAfterMs);
  };

  return {
    copiedValue,
    copyToClipboard,
    hasCopiedValue: (value) => copiedValue === value
  };
};
