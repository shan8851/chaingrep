export type ConnectionStorageStatus = {
  label: string;
  tone: "default" | "success" | "warning";
};

const normalizeConnectionSettingValue = (value: string | undefined): string => value?.trim() ?? "";

export const getConnectionStorageStatus = (
  savedValue: string | undefined,
  draftValue: string | undefined
): ConnectionStorageStatus => {
  const normalizedSavedValue = normalizeConnectionSettingValue(savedValue);
  const normalizedDraftValue = normalizeConnectionSettingValue(draftValue);

  if (!normalizedSavedValue && !normalizedDraftValue) {
    return {
      label: "Not set",
      tone: "default"
    };
  }

  if (normalizedSavedValue && !normalizedDraftValue) {
    return {
      label: "Will clear on save",
      tone: "warning"
    };
  }

  if (!normalizedSavedValue && normalizedDraftValue) {
    return {
      label: "Not saved yet",
      tone: "warning"
    };
  }

  return normalizedSavedValue === normalizedDraftValue
    ? {
        label: "Saved locally",
        tone: "success"
      }
    : {
        label: "Unsaved change",
        tone: "warning"
      };
};
