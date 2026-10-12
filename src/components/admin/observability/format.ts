import type { Metric } from '@/types/observability';

/** 850 -> "850 ms", 1840 -> "1.84 s", 72000 -> "1m 12s". Null/undefined -> "—". */
export const formatMs = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
};

export const formatCount = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : Math.round(n).toLocaleString();

/** 0.1234 -> "12%". Null -> "—". */
export const formatPercent = (fraction: number | null | undefined): string =>
  fraction === null || fraction === undefined ? '—' : `${Math.round(fraction * 100)}%`;

export const formatTokens = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
};

export const formatUsd = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '$0';
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
};

export interface Delta {
  /** Relative change vs the previous period, e.g. 0.25 for +25%. Null when it can't be computed. */
  change: number | null;
  /** "good" / "bad" / "neutral", given whether a higher number is better. */
  tone: 'good' | 'bad' | 'neutral';
  label: string;
}

/**
 * Compares a metric with the equally long period before it.
 * `higherIsBetter`: true -> growth is good (traffic), false -> growth is bad
 * (latency, errors), null -> no judgement (just a direction).
 */
export const deltaOf = (metric: Metric, higherIsBetter: boolean | null): Delta => {
  const { value, previous } = metric;
  if (value === null || previous === null) return { change: null, tone: 'neutral', label: '' };
  if (previous === 0) {
    if (value === 0) return { change: 0, tone: 'neutral', label: 'no change' };
    return { change: null, tone: higherIsBetter === null ? 'neutral' : higherIsBetter ? 'good' : 'bad', label: 'new' };
  }
  const change = (value - previous) / Math.abs(previous);
  if (Math.abs(change) < 0.005) return { change: 0, tone: 'neutral', label: 'no change' };
  const sign = change > 0 ? '+' : '−';
  const tone =
    higherIsBetter === null ? 'neutral' : change > 0 === higherIsBetter ? 'good' : 'bad';
  return { change, tone, label: `${sign}${Math.round(Math.abs(change) * 100)}%` };
};

/** Pretty-prints arbitrary JSON for the detail view, capped so a huge prompt can't freeze the tab. */
export const prettyJson = (value: unknown, limit = 6000): string => {
  if (value === null || value === undefined) return '—';
  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  return text.length > limit ? `${text.slice(0, limit)}\n… (${text.length - limit} more characters)` : text;
};

/** The theme's destructive colour is too dark to read on a dark background; this keeps error alerts legible. */
export const ALERT_ERROR_CLASS =
  'text-red-600 dark:text-red-300 dark:border-red-500/60 [&>svg]:text-red-500 dark:[&>svg]:text-red-400';

export const TAG_LABELS: Record<string, string> = {
  chat: 'Chat',
  admin: 'Admin',
  blocked: 'Blocked',
  fallback: 'Fallback',
  navigate: 'Navigate',
  voice: 'Voice',
  error: 'Error',
  span_error: 'Step error',
  rag_fallback: 'RAG fallback',
};
