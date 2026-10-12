import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/services/apiClient';
import type {
  FeedbackInput,
  ObservabilityRange,
  ObservabilityStatus,
  ObservabilitySummary,
  ObservabilityTimeseries,
  TraceDetail,
  TracesPage,
  TraceTag,
} from '@/types/observability';

const BASE = '/ai/observability';

// Traces arrive in near real time but the backend caches the aggregates for
// ~30s, so polling faster than that only burns Opik requests.
const STALE_MS = 30_000;

// A missing/unreachable Opik is an expected state the panel explains, not
// something to hammer with retries.
const retryUnlessClientError = (failureCount: number, error: unknown) =>
  !(error instanceof ApiError && error.status < 500) && failureCount < 1;

export const useObservabilityStatus = () =>
  useQuery({
    queryKey: ['ai-observability', 'status'],
    queryFn: () => apiClient.get<ObservabilityStatus>(`${BASE}/status`),
    staleTime: 5 * 60_000,
  });

export const useObservabilitySummary = (range: ObservabilityRange, enabled = true) =>
  useQuery({
    queryKey: ['ai-observability', 'summary', range],
    queryFn: () => apiClient.get<ObservabilitySummary>(`${BASE}/summary`, { params: { range } }),
    staleTime: STALE_MS,
    enabled,
    retry: retryUnlessClientError,
  });

export const useObservabilityTimeseries = (range: ObservabilityRange, enabled = true) =>
  useQuery({
    queryKey: ['ai-observability', 'timeseries', range],
    queryFn: () => apiClient.get<ObservabilityTimeseries>(`${BASE}/timeseries`, { params: { range } }),
    staleTime: STALE_MS,
    enabled,
    retry: retryUnlessClientError,
  });

export interface TraceQuery {
  range: ObservabilityRange;
  tag?: TraceTag;
  search?: string;
  page: number;
  size?: number;
}

export const useObservabilityTraces = (query: TraceQuery, enabled = true) =>
  useQuery({
    queryKey: ['ai-observability', 'traces', query],
    queryFn: () =>
      apiClient.get<TracesPage>(`${BASE}/traces`, {
        params: {
          range: query.range,
          tag: query.tag,
          search: query.search || undefined,
          page: query.page,
          size: query.size ?? 20,
        },
      }),
    staleTime: STALE_MS,
    enabled,
    retry: retryUnlessClientError,
    placeholderData: (previous) => previous, // keep the old page visible while the next one loads
  });

export const useObservabilityTrace = (traceId: string | null) =>
  useQuery({
    queryKey: ['ai-observability', 'trace', traceId],
    queryFn: () => apiClient.get<TraceDetail>(`${BASE}/traces/${traceId}`),
    enabled: !!traceId,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });

export const useSubmitFeedback = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ traceId, name, score, comment }: FeedbackInput) =>
      apiClient.post<void>(`${BASE}/traces/${traceId}/feedback`, { name, score, comment: comment || undefined }),
    onSuccess: () => {
      // Ratings feed the summary's rating average and every trace row.
      queryClient.invalidateQueries({ queryKey: ['ai-observability'] });
    },
  });
};
