import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ChevronDown, FlaskConical, ShieldCheck } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useObservabilityExperiments } from '@/hooks/useAIObservability';
import type { ExperimentRow } from '@/types/observability';
import { ALERT_ERROR_CLASS, formatMs, formatPercent } from './format';

const SERIES = {
  hit: '#6366f1',
  mrr: '#8b5cf6',
  relevance: '#f59e0b',
  grounded: '#10b981',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const when = (iso: string | null) => (iso ? format(new Date(iso), 'MMM d, HH:mm') : '—');

/** Change since the run before, in percentage points, coloured by whether that is good. */
const Change = ({ now, before, lowerIsBetter = false }: { now: number | null; before: number | null; lowerIsBetter?: boolean }) => {
  if (now === null || before === null) return null;
  const points = Math.round((now - before) * 100);
  if (points === 0) return <span className="text-xs text-muted-foreground">no change</span>;
  const good = lowerIsBetter ? points < 0 : points > 0;
  return (
    <span className={`text-xs ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {points > 0 ? '+' : '−'}
      {Math.abs(points)} pts <span className="text-muted-foreground">vs previous run</span>
    </span>
  );
};

const ScoreTile = ({
  title,
  value,
  before,
  hint,
  lowerIsBetter,
  bad,
}: {
  title: string;
  value: number | null;
  before: number | null;
  hint?: string;
  lowerIsBetter?: boolean;
  bad?: boolean;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${bad ? 'text-red-600 dark:text-red-400' : ''}`}>{formatPercent(value)}</div>
      <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
        <Change now={value} before={before} lowerIsBetter={lowerIsBetter} />
        {hint && <span>{hint}</span>}
      </p>
    </CardContent>
  </Card>
);

const RunDetails = ({ run }: { run: ExperimentRow }) => {
  const settings = Object.entries(run.settings ?? {});
  return (
    <div className="space-y-3 text-sm">
      {run.notes && <p className="italic text-muted-foreground">“{run.notes}”</p>}
      {run.misses.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Not retrieved</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {run.misses.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {run.missed_injections.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Injections that got through</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {run.missed_injections.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {run.wrongly_blocked.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">Wrongly blocked</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {run.wrongly_blocked.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {settings.length > 0 && (
        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          {settings.map(([key, value]) => (
            <span key={key}>
              {key}: <span className="text-foreground">{String(value)}</span>
            </span>
          ))}
        </p>
      )}
      {run.misses.length === 0 &&
        run.missed_injections.length === 0 &&
        run.wrongly_blocked.length === 0 &&
        !run.notes &&
        settings.length === 0 && <p className="text-muted-foreground">Nothing to flag in this run.</p>}
    </div>
  );
};

const RunRow = ({ run }: { run: ExperimentRow }) => {
  const [open, setOpen] = useState(false);
  const rag = run.kind === 'rag';
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger className="w-full text-left p-3 hover:bg-muted/40 rounded-md" aria-label={`Details of ${run.name}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="font-medium text-sm truncate max-w-[16rem]">{run.name}</span>
          <Badge variant="outline">{rag ? 'Retrieval + answers' : run.kind === 'guard' ? 'Guard' : 'Run'}</Badge>
          <span className="text-xs text-muted-foreground">{when(run.created_at)}</span>
          <span className="text-xs text-muted-foreground">{run.items ?? '—'} items</span>
          <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {rag ? (
              <>
                <span>hit@1 <strong>{formatPercent(run.hit_at_1)}</strong></span>
                <span>hit@{run.k ?? 'k'} <strong>{formatPercent(run.hit_at_k)}</strong></span>
                <span>relevance <strong>{formatPercent(run.answer_relevance)}</strong></span>
                <span>grounded <strong>{formatPercent(run.groundedness)}</strong></span>
              </>
            ) : (
              <>
                <span>recall <strong>{formatPercent(run.injection_recall)}</strong></span>
                <span>false positives <strong>{formatPercent(run.false_positive_rate)}</strong></span>
                <span>accuracy <strong>{formatPercent(run.accuracy)}</strong></span>
              </>
            )}
          </span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t p-3">
        <RunDetails run={run} />
      </CollapsibleContent>
    </Collapsible>
  );
};

/**
 * Offline evaluation runs: how good retrieval and answers are, and how the
 * guardrail performs, tracked run over run. The numbers come from the scripts
 * in backend/scripts (eval_chat_rag.py, eval_chat_guard.py).
 */
const EvaluationsPanel = () => {
  const query = useObservabilityExperiments();
  const runs = useMemo(() => query.data?.runs ?? [], [query.data]);

  const rag = useMemo(() => runs.filter((r) => r.kind === 'rag'), [runs]); // newest first
  const guard = useMemo(() => runs.filter((r) => r.kind === 'guard'), [runs]);

  const chartData = useMemo(
    () =>
      [...rag].reverse().map((r) => ({
        label: when(r.created_at),
        'Hit rate': r.hit_at_k !== null ? Math.round(r.hit_at_k * 100) : null,
        MRR: r.mrr !== null ? Math.round(r.mrr * 100) : null,
        Relevance: r.answer_relevance !== null ? Math.round(r.answer_relevance * 100) : null,
        Groundedness: r.groundedness !== null ? Math.round(r.groundedness * 100) : null,
      })),
    [rag]
  );

  if (query.isError) {
    return (
      <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn't load evaluation runs</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{query.error instanceof Error ? query.error.message : 'Unexpected error'}</span>
          <Button size="sm" variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading evaluation runs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" /> No evaluation runs yet
          </CardTitle>
          <CardDescription>
            Evaluations measure whether the chatbot finds the right entry for a question, and whether its answer is
            on point and supported by your content. Run them from the backend folder; each run appears here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
{`PYTHONPATH=. python scripts/eval_chat_rag.py --reindex
PYTHONPATH=. python scripts/eval_chat_guard.py --log-opik`}
          </pre>
          <p className="text-muted-foreground">
            They use your free Gemini/Groq keys (about 3 model calls per question) and need Opik configured to record the run.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = rag[0];
  const previous = rag[1];
  const latestGuard = guard[0];
  const previousGuard = guard[1];

  return (
    <div className="space-y-6">
      {latest && (
        <section aria-label="Latest retrieval and answer run" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold">Latest answer-quality run</h3>
            <p className="text-xs text-muted-foreground">
              {latest.name} · {when(latest.created_at)} · {latest.items ?? '—'} questions
              {latest.judged !== null && latest.items !== null && latest.judged < latest.items
                ? ` · ${latest.judged} judged`
                : ''}
              {latest.latency_ms_avg ? ` · ${formatMs(latest.latency_ms_avg)} avg` : ''}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <ScoreTile title="Right entry first" value={latest.hit_at_1} before={previous?.hit_at_1 ?? null} hint="hit@1" />
            <ScoreTile title={`Right entry in top ${latest.k ?? 'k'}`} value={latest.hit_at_k} before={previous?.hit_at_k ?? null} hint={`hit@${latest.k ?? 'k'}`} />
            <ScoreTile title="Ranking quality" value={latest.mrr} before={previous?.mrr ?? null} hint="MRR" />
            <ScoreTile title="Answers the question" value={latest.answer_relevance} before={previous?.answer_relevance ?? null} hint="LLM judge" />
            <ScoreTile title="Grounded in your content" value={latest.groundedness} before={previous?.groundedness ?? null} hint="LLM judge" />
          </div>
          {latest.misses.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Not retrieved: {latest.misses.map((m) => `“${m}”`).join(', ')}
            </p>
          )}
        </section>
      )}

      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Over time</CardTitle>
            <CardDescription>Each point is one run, oldest to newest (percent)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" width={36} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="Hit rate" stroke={SERIES.hit} strokeWidth={2} connectNulls />
                  <Line type="monotone" dataKey="MRR" stroke={SERIES.mrr} strokeWidth={2} connectNulls />
                  <Line type="monotone" dataKey="Relevance" stroke={SERIES.relevance} strokeWidth={2} connectNulls />
                  <Line type="monotone" dataKey="Groundedness" stroke={SERIES.grounded} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {latestGuard && (
        <section aria-label="Latest guardrail run" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Latest guardrail run
            </h3>
            <p className="text-xs text-muted-foreground">
              {latestGuard.name} · {when(latestGuard.created_at)} · {latestGuard.items ?? '—'} messages
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ScoreTile title="Injections caught" value={latestGuard.injection_recall} before={previousGuard?.injection_recall ?? null} hint="recall" />
            <ScoreTile
              title="Legitimate blocked"
              value={latestGuard.false_positive_rate}
              before={previousGuard?.false_positive_rate ?? null}
              hint="should be 0%"
              lowerIsBetter
              bad={(latestGuard.false_positive_rate ?? 0) > 0}
            />
            <ScoreTile title="Overall accuracy" value={latestGuard.accuracy} before={previousGuard?.accuracy ?? null} />
          </div>
        </section>
      )}

      <section aria-label="All runs" className="space-y-2">
        <h3 className="text-base font-semibold">All runs</h3>
        {runs.map((run) => (
          <RunRow key={run.id ?? run.name} run={run} />
        ))}
      </section>
    </div>
  );
};

export default EvaluationsPanel;
