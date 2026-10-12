// Shapes returned by the admin "AI" console API (backend/app/schemas/observability.py).

export type ObservabilityRange = '24h' | '7d' | '30d';

export type TraceTag =
  | 'chat'
  | 'admin'
  | 'blocked'
  | 'fallback'
  | 'navigate'
  | 'voice'
  | 'error'
  | 'span_error'
  | 'rag_fallback'
  | 'eval';

export interface ObservabilityStatus {
  configured: boolean;
  tracing_enabled: boolean;
  project: string;
  workspace: string | null;
  dashboard_url: string | null;
}

export interface Metric {
  value: number | null;
  previous: number | null;
}

export interface ObservabilitySummary {
  range: ObservabilityRange;
  generated_at: string;
  sample_size: number;
  truncated: boolean;
  by_name: Record<string, number>;
  traces: Metric;
  chats: Metric;
  admin_calls: Metric;
  errors: Metric;
  blocked: Metric;
  blocked_rate: Metric;
  fallback_rate: Metric;
  navigate: Metric;
  voice_share: Metric;
  rag_fallback: Metric;
  latency_p50_ms: Metric;
  latency_p90_ms: Metric;
  ttft_avg_ms: Metric;
  tokens_total: Metric;
  tokens_avg_per_chat: Metric;
  cost_usd: Metric;
  rating_avg: Metric;
  ratings_up: Metric;
  ratings_down: Metric;
}

export interface TimePoint {
  time: string;
  traces: number;
  chats: number;
  blocked: number;
  errors: number;
  tokens: number;
  latency_p50_ms: number | null;
  latency_p90_ms: number | null;
  ttft_avg_ms: number | null;
}

export interface ObservabilityTimeseries {
  range: ObservabilityRange;
  interval: 'hour' | 'day';
  truncated: boolean;
  points: TimePoint[];
}

export interface TraceRow {
  id: string | null;
  name: string | null;
  started_at: string | null;
  duration_ms: number | null;
  ttft_ms: number | null;
  tokens: number | null;
  provider: string | null;
  model: string | null;
  path: string | null;
  tags: string[];
  error: boolean;
  error_message: string | null;
  input_preview: string | null;
  output_preview: string | null;
  rating: number | null;
  guard_correct: number | null;
}

export interface TracesPage {
  rows: TraceRow[];
  page: number;
  size: number;
  total: number;
}

export interface SpanDetail {
  id: string | null;
  name: string | null;
  type: string | null;
  started_at: string | null;
  offset_ms: number | null;
  duration_ms: number | null;
  input: unknown;
  output: unknown;
  metadata: unknown;
  model: string | null;
  provider: string | null;
  usage: Record<string, number> | null;
  ttft_ms: number | null;
  error_message: string | null;
  error_type: string | null;
}

export interface TraceDetail extends TraceRow {
  project_id: string | null;
  input: unknown;
  output: unknown;
  metadata: unknown;
  usage: Record<string, number> | null;
  cost_usd: number | null;
  scores: { name: string | null; value: number | null; reason: string | null }[];
  spans: SpanDetail[];
}

export type FeedbackName = 'admin_rating' | 'guard_correct';

export interface FeedbackInput {
  traceId: string;
  name: FeedbackName;
  score: 0 | 1;
  comment?: string;
}

/** One offline evaluation run (scripts/eval_chat_rag.py or eval_chat_guard.py). */
export interface ExperimentRow {
  id: string | null;
  name: string | null;
  dataset: string | null;
  created_at: string | null;
  status: string | null;
  kind: 'rag' | 'guard' | null;
  items: number | null;
  k: number | null;
  judged: number | null;
  errors: number | null;
  // retrieval and answer quality ("rag" runs): 0..1, higher is better
  hit_at_1: number | null;
  hit_at_k: number | null;
  mrr: number | null;
  answer_relevance: number | null;
  groundedness: number | null;
  latency_ms_avg: number | null;
  // guard runs
  injection_recall: number | null;
  false_positive_rate: number | null; // lower is better
  accuracy: number | null;
  misses: string[];
  missed_injections: string[];
  wrongly_blocked: string[];
  notes: string | null;
  settings: Record<string, unknown>;
}

export interface ExperimentsResponse {
  runs: ExperimentRow[];
}
