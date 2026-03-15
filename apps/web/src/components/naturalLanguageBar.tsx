import { LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { JSX } from "react";
import type {
  ArgFilter,
  ChainId,
  NaturalLanguageQueryResponse
} from "@chaingrep/shared";

import { Badge, Button } from "./ui";
import { getApiBaseUrl } from "../lib/network";

type NaturalLanguageBarProps = {
  currentChainId: ChainId;
  disabled: boolean;
  onParsed: (result: NaturalLanguageQueryResponse & { parsed: true }) => void;
};

type ParseState = {
  error: string | null;
  loading: boolean;
};

const parseNaturalLanguageQuery = async (
  query: string,
  chainId: ChainId
): Promise<NaturalLanguageQueryResponse> => {
  const response = await fetch(`${getApiBaseUrl()}/api/parse-query`, {
    body: JSON.stringify({ chainId, query }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(errorPayload?.error ?? `Parse request failed (${response.status}).`);
  }

  return (await response.json()) as NaturalLanguageQueryResponse;
};

export const NaturalLanguageBar = ({
  currentChainId,
  disabled,
  onParsed
}: NaturalLanguageBarProps): JSX.Element => {
  const [query, setQuery] = useState("");
  const [parseState, setParseState] = useState<ParseState>({
    error: null,
    loading: false
  });

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    setParseState({ error: null, loading: true });

    try {
      const result = await parseNaturalLanguageQuery(trimmedQuery, currentChainId);

      if (!result.parsed) {
        setParseState({ error: result.reason, loading: false });

        return;
      }

      setParseState({ error: null, loading: false });
      onParsed(result);
    } catch (error) {
      setParseState({
        error: error instanceof Error ? error.message : "Search failed.",
        loading: false
      });
    }
  }, [query, currentChainId, onParsed]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-signal-cyan/70" />
          <input
            className="h-11 w-full rounded-panel border border-chrome-400/70 bg-chrome-700/80 pl-10 pr-4 text-sm text-chrome-50 outline-none transition placeholder:text-chrome-400 focus:border-signal-cyan/70"
            disabled={disabled || parseState.loading}
            onChange={(event) => {
              setQuery(event.target.value);

              if (parseState.error) {
                setParseState({ error: null, loading: false });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="Search events… e.g. USDC transfers on Ethereum last 24 hours"
            spellCheck={false}
            value={query}
          />
        </div>
        <Button
          className="h-11 shrink-0"
          disabled={disabled || parseState.loading || !query.trim()}
          intent="primary"
          onClick={() => {
            void handleSearch();
          }}
          type="button"
        >
          {parseState.loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </div>
      {parseState.error ? (
        <p className="text-xs text-signal-red">{parseState.error}</p>
      ) : null}
    </div>
  );
};

type ActiveFiltersProps = {
  filters: ArgFilter[];
  onClear: () => void;
  onRemoveFilter: (index: number) => void;
};

export const ActiveFilters = ({
  filters,
  onClear,
  onRemoveFilter
}: ActiveFiltersProps): JSX.Element | null => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-chrome-300">
        Filters:
      </span>
      {filters.map((filter, index) => (
        <Badge key={`${filter.argName}-${filter.operator}-${filter.value}`} tone="default">
          <span className="flex items-center gap-1.5">
            {filter.argName} {filter.operator} {filter.value}
            <button
              className="text-chrome-400 transition hover:text-chrome-50"
              onClick={() => {
                onRemoveFilter(index);
              }}
              type="button"
            >
              <X className="size-3" />
            </button>
          </span>
        </Badge>
      ))}
      <button
        className="text-xs text-chrome-400 underline underline-offset-4 transition hover:text-chrome-50"
        onClick={onClear}
        type="button"
      >
        Clear all
      </button>
    </div>
  );
};
