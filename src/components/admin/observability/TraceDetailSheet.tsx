import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ExternalLink, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useObservabilityTrace, useSubmitFeedback } from '@/hooks/useAIObservability';
import type { FeedbackName, SpanDetail, TraceDetail } from '@/types/observability';
import { ALERT_ERROR_CLASS, TAG_LABELS, formatMs, formatTokens, formatUsd, prettyJson } from './format';

interface TraceDetailSheetProps {
  traceId: string | null;
  dashboardUrl: string | null;
  onClose: () => void;
}

const SPAN_BAR_CLASS: Record<string, string> = {
  llm: 'bg-indigo-500',
  guardrail: 'bg-amber-500',
  tool: 'bg-emerald-500',
  general: 'bg-slate-400 dark:bg-slate-500',
};

const Block = ({ title, value }: { title: string; value: unknown }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
    <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs max-h-64 overflow-auto">
      {prettyJson(value)}
    </pre>
  </div>
);

const SpanRow = ({ span, total }: { span: SpanDetail; total: number }) => {
  const [open, setOpen] = useState(false);
  const left = span.offset_ms !== null ? Math.min((span.offset_ms / total) * 100, 99) : 0;
  const width = span.duration_ms !== null ? Math.max((span.duration_ms / total) * 100, 1.5) : 1.5;
  const barClass = span.error_message
    ? 'bg-red-500'
    : SPAN_BAR_CLASS[span.type ?? 'general'] ?? SPAN_BAR_CLASS.general;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger className="w-full text-left p-2 hover:bg-muted/40 rounded-md" aria-label={`${span.name} details`}>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium flex items-center gap-2 min-w-0">
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
            <span className="truncate">{span.name}</span>
            {span.type && span.type !== 'general' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {span.type}
              </Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">{formatMs(span.duration_ms)}</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded bg-muted relative" aria-hidden="true">
          <div className={`absolute h-1.5 rounded ${barClass}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t p-3">
        {span.error_message && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {span.error_type}: {span.error_message}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {span.provider && <span>provider: {span.provider}</span>}
          {span.model && <span>model: {span.model}</span>}
          {span.ttft_ms !== null && <span>first token: {formatMs(span.ttft_ms)}</span>}
          {span.usage?.total_tokens !== undefined && <span>tokens: {formatTokens(span.usage.total_tokens)}</span>}
        </div>
        {span.input !== null && span.input !== undefined && <Block title="Input" value={span.input} />}
        {span.output !== null && span.output !== undefined && <Block title="Output" value={span.output} />}
        {span.metadata !== null && span.metadata !== undefined && <Block title="Details" value={span.metadata} />}
      </CollapsibleContent>
    </Collapsible>
  );
};

const FeedbackControls = ({ trace }: { trace: TraceDetail }) => {
  const submit = useSubmitFeedback();
  const [comment, setComment] = useState('');
  const blocked = trace.tags.includes('blocked');

  useEffect(() => setComment(''), [trace.id]);

  const send = async (name: FeedbackName, score: 0 | 1) => {
    if (!trace.id) return;
    try {
      await submit.mutateAsync({ traceId: trace.id, name, score, comment: score === 0 ? comment.trim() : undefined });
      toast.success('Feedback saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save feedback');
    }
  };

  const active = (value: number | null, expected: number) => (value === expected ? 'default' : 'outline');

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">{blocked ? 'Was this block correct?' : 'Was this reply good?'}</p>
      <div className="flex flex-wrap gap-2">
        {blocked ? (
          <>
            <Button size="sm" variant={active(trace.guard_correct, 1)} disabled={submit.isPending} onClick={() => send('guard_correct', 1)}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Correctly blocked
            </Button>
            <Button size="sm" variant={active(trace.guard_correct, 0)} disabled={submit.isPending} onClick={() => send('guard_correct', 0)}>
              <AlertTriangle className="h-4 w-4 mr-2" /> Should not have been blocked
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant={active(trace.rating, 1)} disabled={submit.isPending} onClick={() => send('admin_rating', 1)} aria-label="Good reply">
              <ThumbsUp className="h-4 w-4 mr-2" /> Good
            </Button>
            <Button size="sm" variant={active(trace.rating, 0)} disabled={submit.isPending} onClick={() => send('admin_rating', 0)} aria-label="Bad reply">
              <ThumbsDown className="h-4 w-4 mr-2" /> Bad
            </Button>
          </>
        )}
      </div>
      {!blocked && (
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: what was wrong? (saved with a thumbs-down)"
          maxLength={500}
          rows={2}
        />
      )}
      <p className="text-xs text-muted-foreground">Saved to Opik as a feedback score, so it also shows up there.</p>
    </div>
  );
};

const TraceDetailSheet = ({ traceId, dashboardUrl, onClose }: TraceDetailSheetProps) => {
  const query = useObservabilityTrace(traceId);
  const trace = query.data;

  const total = useMemo(() => {
    if (!trace) return 1;
    const spanEnd = Math.max(0, ...trace.spans.map((s) => (s.offset_ms ?? 0) + (s.duration_ms ?? 0)));
    return Math.max(trace.duration_ms ?? 0, spanEnd, 1);
  }, [trace]);

  const opikUrl = trace?.project_id && dashboardUrl ? `${dashboardUrl}/${trace.project_id}/traces` : dashboardUrl;

  return (
    <Sheet open={!!traceId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{trace?.name ?? 'Trace'}</SheetTitle>
          <SheetDescription>
            {trace?.started_at ? format(new Date(trace.started_at), 'PPpp') : 'Loading trace…'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {query.isLoading && (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          )}

          {query.isError && (
            <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Couldn't load this trace</AlertTitle>
              <AlertDescription>{query.error instanceof Error ? query.error.message : 'Unexpected error'}</AlertDescription>
            </Alert>
          )}

          {trace && (
            <>
              <div className="flex flex-wrap gap-2">
                {trace.tags.map((tag) => (
                  <Badge key={tag} variant={tag === 'error' ? 'destructive' : 'secondary'}>
                    {TAG_LABELS[tag] ?? tag}
                  </Badge>
                ))}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-muted-foreground">Duration</dt><dd>{formatMs(trace.duration_ms)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">First token</dt><dd>{formatMs(trace.ttft_ms)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Tokens</dt><dd>{formatTokens(trace.tokens)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Provider</dt><dd>{trace.provider ?? '—'}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Model</dt><dd className="truncate">{trace.model ?? '—'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Est. cost</dt><dd>{formatUsd(trace.cost_usd)}</dd></div>
              </dl>

              {trace.error_message && (
                <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{trace.error_message}</AlertDescription>
                </Alert>
              )}

              <section aria-label="Steps" className="space-y-2">
                <h3 className="text-sm font-semibold">Steps</h3>
                {trace.spans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No steps were recorded for this trace.</p>
                ) : (
                  trace.spans.map((span, i) => <SpanRow key={span.id ?? i} span={span} total={total} />)
                )}
              </section>

              <section aria-label="Input and output" className="space-y-3">
                <Block title="Input" value={trace.input} />
                <Block title="Output" value={trace.output} />
              </section>

              {trace.scores.length > 0 && (
                <section aria-label="Scores" className="space-y-1">
                  <h3 className="text-sm font-semibold">Scores</h3>
                  <ul className="text-sm space-y-1">
                    {trace.scores.map((score, i) => (
                      <li key={`${score.name}-${i}`} className="flex gap-2">
                        <span className="font-medium">{score.name}</span>
                        <span>{score.value ?? '—'}</span>
                        {score.reason && <span className="text-muted-foreground">— {score.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {trace.id && <FeedbackControls trace={trace} />}

              {opikUrl && (
                <a
                  href={opikUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open in Opik <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TraceDetailSheet;
