import React from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, Check, ShieldAlert, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useObservabilitySummary,
  useObservabilityTraces,
  useSubmitFeedback,
} from '@/hooks/useAIObservability';
import type { ObservabilityRange, TraceRow } from '@/types/observability';
import { ALERT_ERROR_CLASS, deltaOf, formatCount, formatPercent } from './format';

interface GuardrailPanelProps {
  range: ObservabilityRange;
  onOpenTrace: (traceId: string) => void;
}

const Verdict = ({ value }: { value: number | null }) => {
  if (value === 1) return <Badge variant="secondary">Confirmed</Badge>;
  if (value === 0) return <Badge variant="destructive">False positive</Badge>;
  return <Badge variant="outline">Not reviewed</Badge>;
};

const GuardrailPanel = ({ range, onOpenTrace }: GuardrailPanelProps) => {
  const summary = useObservabilitySummary(range);
  const traces = useObservabilityTraces({ range, tag: 'blocked', page: 1, size: 30 });
  const feedback = useSubmitFeedback();

  const review = async (row: TraceRow, correct: boolean) => {
    if (!row.id) return;
    try {
      await feedback.mutateAsync({ traceId: row.id, name: 'guard_correct', score: correct ? 1 : 0 });
      toast.success(correct ? 'Marked as correctly blocked' : 'Marked as a false positive');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save review');
    }
  };

  const rows = traces.data?.rows ?? [];
  const falsePositives = rows.filter((r) => r.guard_correct === 0).length;
  const reviewed = rows.filter((r) => r.guard_correct !== null).length;
  const blockedDelta = summary.data ? deltaOf(summary.data.blocked, null) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Prompt-injection guard
          </CardTitle>
          <CardDescription>
            Messages that look like jailbreak attempts get a fixed redirect instead of a model call. Review the
            blocked ones here: a "false positive" means a real visitor was turned away, which is the mistake worth
            catching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.isLoading ? (
            <Skeleton className="h-16" />
          ) : summary.data ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Blocked</dt>
                <dd className="text-2xl font-bold">{formatCount(summary.data.blocked.value)}</dd>
                {blockedDelta?.label && <dd className="text-xs text-muted-foreground">{blockedDelta.label} vs previous</dd>}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Share of chats</dt>
                <dd className="text-2xl font-bold">{formatPercent(summary.data.blocked_rate.value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reviewed</dt>
                <dd className="text-2xl font-bold">
                  {reviewed}
                  <span className="text-sm font-normal text-muted-foreground"> / {rows.length}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">False positives</dt>
                <dd className={`text-2xl font-bold ${falsePositives > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {falsePositives}
                </dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>

      {traces.isError ? (
        <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Couldn't load blocked messages</AlertTitle>
          <AlertDescription>{traces.error instanceof Error ? traces.error.message : 'Unexpected error'}</AlertDescription>
        </Alert>
      ) : traces.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing was blocked in this period.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={row.id ?? i}>
              <Card>
                <CardContent className="py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => row.id && onOpenTrace(row.id)}
                    className="min-w-0 text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded"
                  >
                    <p className="truncate text-sm font-medium">{row.input_preview ?? '(no message recorded)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.started_at ? format(new Date(row.started_at), 'MMM d, HH:mm') : '—'}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Verdict value={row.guard_correct} />
                    <Button size="sm" variant="outline" disabled={feedback.isPending} onClick={() => review(row, true)} aria-label="Correctly blocked">
                      <Check className="h-4 w-4 mr-1" /> Correct
                    </Button>
                    <Button size="sm" variant="outline" disabled={feedback.isPending} onClick={() => review(row, false)} aria-label="False positive">
                      <X className="h-4 w-4 mr-1" /> False positive
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GuardrailPanel;
