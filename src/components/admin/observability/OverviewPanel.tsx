import React, { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Coins,
  Compass,
  MessageSquare,
  Repeat,
  ShieldAlert,
  ThumbsUp,
  Timer,
  Zap,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useObservabilitySummary, useObservabilityTimeseries } from '@/hooks/useAIObservability';
import type { Metric, ObservabilityRange } from '@/types/observability';
import {
  ALERT_ERROR_CLASS,
  deltaOf,
  formatCount,
  formatMs,
  formatPercent,
  formatTokens,
  formatUsd,
  type Delta,
} from './format';

interface OverviewPanelProps {
  range: ObservabilityRange;
}

const RANGE_LABEL: Record<ObservabilityRange, string> = {
  '24h': 'the last 24 hours',
  '7d': 'the last 7 days',
  '30d': 'the last 30 days',
};

const TONE_CLASS: Record<Delta['tone'], string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

// Explicit series colours: this theme's --primary is near-white in dark mode, which
// made the main series look washed out and hard to tell from the grid.
const SERIES = {
  main: '#6366f1',
  warn: '#f59e0b',
  muted: '#64748b',
  good: '#10b981',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

interface KpiProps {
  title: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  metric?: Metric;
  higherIsBetter?: boolean | null;
  alert?: boolean;
}

const Kpi = ({ title, value, hint, icon, metric, higherIsBetter = null, alert = false }: KpiProps) => {
  const delta = metric ? deltaOf(metric, higherIsBetter) : null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${alert ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</div>
        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
          {delta && delta.label && (
            <span className={TONE_CLASS[delta.tone]}>
              {delta.label} <span className="text-muted-foreground">vs previous</span>
            </span>
          )}
          {hint && <span>{hint}</span>}
        </p>
      </CardContent>
    </Card>
  );
};

const OverviewPanel = ({ range }: OverviewPanelProps) => {
  const summary = useObservabilitySummary(range);
  const series = useObservabilityTimeseries(range);

  const chartData = useMemo(() => {
    const points = series.data?.points ?? [];
    const hourly = series.data?.interval === 'hour';
    return points.map((p) => {
      const when = new Date(p.time);
      return {
        label: hourly ? format(when, 'HH:mm') : format(when, 'MMM d'),
        answered: Math.max(p.chats - p.blocked, 0),
        blocked: p.blocked,
        adminTools: Math.max(p.traces - p.chats, 0),
        p50: p.latency_p50_ms,
        p90: p.latency_p90_ms,
        ttft: p.ttft_avg_ms,
        tokens: p.tokens,
      };
    });
  }, [series.data]);

  if (summary.isError) {
    return (
      <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn't load AI metrics</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{summary.error instanceof Error ? summary.error.message : 'Unexpected error'}</span>
          <Button size="sm" variant="outline" onClick={() => summary.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.isLoading || !summary.data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading AI metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const s = summary.data;

  if (s.sample_size === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <p className="font-medium">No traces in {RANGE_LABEL[range]}</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Once tracing is on, every chatbot message and admin AI action shows up here. Send a message to the
            chatbot on the site to see the first one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ratingTotal = (s.ratings_up.value ?? 0) + (s.ratings_down.value ?? 0);

  return (
    <div className="space-y-6">
      {s.truncated && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Showing the newest {formatCount(s.sample_size)} traces</AlertTitle>
          <AlertDescription>
            This period has more traces than the console loads at once, so the figures cover the most recent
            ones. Opik has the complete history.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Chat messages"
          value={formatCount(s.chats.value)}
          hint={`${formatCount(s.admin_calls.value)} admin AI calls`}
          icon={<MessageSquare className="h-4 w-4" />}
          metric={s.chats}
          higherIsBetter={null}
        />
        <Kpi
          title="Reply latency (p50)"
          value={formatMs(s.latency_p50_ms.value)}
          hint={`p90 ${formatMs(s.latency_p90_ms.value)}`}
          icon={<Timer className="h-4 w-4" />}
          metric={s.latency_p50_ms}
          higherIsBetter={false}
        />
        <Kpi
          title="Time to first token"
          value={formatMs(s.ttft_avg_ms.value)}
          hint="average"
          icon={<Zap className="h-4 w-4" />}
          metric={s.ttft_avg_ms}
          higherIsBetter={false}
        />
        <Kpi
          title="Tokens"
          value={formatTokens(s.tokens_total.value)}
          hint={s.tokens_avg_per_chat.value ? `~${formatTokens(s.tokens_avg_per_chat.value)} per chat` : undefined}
          icon={<Coins className="h-4 w-4" />}
          metric={s.tokens_total}
          higherIsBetter={null}
        />
        <Kpi
          title="Guard blocks"
          value={formatCount(s.blocked.value)}
          hint={`${formatPercent(s.blocked_rate.value)} of chats`}
          icon={<ShieldAlert className="h-4 w-4" />}
          metric={s.blocked}
          higherIsBetter={null}
        />
        <Kpi
          title="Provider fallback"
          value={formatPercent(s.fallback_rate.value)}
          hint="answered by the backup model"
          icon={<Repeat className="h-4 w-4" />}
          metric={s.fallback_rate}
          higherIsBetter={false}
        />
        <Kpi
          title="Navigations"
          value={formatCount(s.navigate.value)}
          hint={s.voice_share.value ? `${formatPercent(s.voice_share.value)} by voice` : undefined}
          icon={<Compass className="h-4 w-4" />}
          metric={s.navigate}
          higherIsBetter={null}
        />
        <Kpi
          title="Errors"
          value={formatCount(s.errors.value)}
          hint={s.cost_usd.value ? `${formatUsd(s.cost_usd.value)} est. cost` : undefined}
          icon={<AlertTriangle className="h-4 w-4" />}
          metric={s.errors}
          higherIsBetter={false}
          alert={(s.errors.value ?? 0) > 0}
        />
      </div>

      {ratingTotal > 0 && (
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" /> Your ratings
            </span>
            <span>
              {formatPercent(s.rating_avg.value)} positive across {formatCount(ratingTotal)} rated replies
            </span>
            <span className="text-muted-foreground">
              {formatCount(s.ratings_up.value)} up · {formatCount(s.ratings_down.value)} down
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Traffic</CardTitle>
            <CardDescription>Chat messages and admin AI calls over {RANGE_LABEL[range]}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="answered" name="Answered chats" stackId="t" fill={SERIES.main} />
                  <Bar dataKey="blocked" name="Blocked by guard" stackId="t" fill={SERIES.warn} />
                  <Bar dataKey="adminTools" name="Admin AI calls" stackId="t" fill={SERIES.muted} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency</CardTitle>
            <CardDescription>Reply time and time to first token (milliseconds)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" width={48} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMs(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="p50" name="p50" stroke={SERIES.main} strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="p90" name="p90" stroke={SERIES.warn} strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="ttft" name="First token" stroke={SERIES.good} strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
          <CardDescription>Prompt + completion tokens per {series.data?.interval ?? 'period'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" width={48} tickFormatter={(v: number) => formatTokens(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatTokens(v)} />
                <Bar dataKey="tokens" name="Tokens" fill={SERIES.main} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {Object.keys(s.by_name).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(s.by_name).map(([name, count]) => (
                <span key={name} className="rounded-full border px-2 py-0.5">
                  {name} · {count}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewPanel;
