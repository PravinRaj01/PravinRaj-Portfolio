import React, { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useObservabilityStatus } from '@/hooks/useAIObservability';
import type { ObservabilityRange } from '@/types/observability';
import { ALERT_ERROR_CLASS } from './format';
import EvaluationsPanel from './EvaluationsPanel';
import GuardrailPanel from './GuardrailPanel';
import OverviewPanel from './OverviewPanel';
import TraceDetailSheet from './TraceDetailSheet';
import TracesPanel from './TracesPanel';

const RANGES: { value: ObservabilityRange; label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

/**
 * The admin "AI" tab: what the chatbot and the admin AI tools are doing,
 * read from Opik through the backend (the Opik key never reaches the browser).
 */
const AIObservability = () => {
  const status = useObservabilityStatus();
  const [range, setRange] = useState<ObservabilityRange>('7d');
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  if (status.isLoading) {
    return <Skeleton className="h-64" aria-busy="true" aria-label="Loading AI observability" />;
  }

  if (status.isError) {
    return (
      <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
        <Info className="h-4 w-4" />
        <AlertTitle>Couldn't reach the backend</AlertTitle>
        <AlertDescription>{status.error instanceof Error ? status.error.message : 'Unexpected error'}</AlertDescription>
      </Alert>
    );
  }

  if (!status.data?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI observability isn't set up yet</CardTitle>
          <CardDescription>
            Every chatbot message and admin AI action can be traced with Opik and explored here: latency, tokens,
            guardrail blocks, fallbacks and individual conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Add these to the backend's environment (Vercel project settings, or backend/.env locally), then redeploy:</p>
          <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
{`OPIK_ENABLED=true
OPIK_API_KEY=<your Comet API key>
OPIK_WORKSPACE=<your Comet workspace name>`}
          </pre>
          <p className="text-muted-foreground">
            Traces appear after the next chatbot message. The key stays on the server and is never sent to this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const info = status.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">AI observability</h2>
          <p className="text-sm text-muted-foreground">
            Project <span className="font-medium">{info.project}</span> in Opik
            {info.dashboard_url && (
              <>
                {' · '}
                <a
                  href={info.dashboard_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open Opik <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(value) => value && setRange(value as ObservabilityRange)}
          variant="outline"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r.value} value={r.value} aria-label={r.label}>
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!info.tracing_enabled && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Tracing is switched off</AlertTitle>
          <AlertDescription>
            <code>OPIK_ENABLED</code> is not true on the backend, so new traces aren't being recorded. What's below is
            whatever was captured earlier.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traces">Traces</TabsTrigger>
          <TabsTrigger value="guardrail">Guardrail</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel range={range} />
        </TabsContent>
        <TabsContent value="traces">
          <TracesPanel range={range} onOpenTrace={setSelectedTrace} />
        </TabsContent>
        <TabsContent value="guardrail">
          <GuardrailPanel range={range} onOpenTrace={setSelectedTrace} />
        </TabsContent>
        <TabsContent value="evaluations">
          <EvaluationsPanel />
        </TabsContent>
      </Tabs>

      <TraceDetailSheet
        traceId={selectedTrace}
        dashboardUrl={info.dashboard_url}
        onClose={() => setSelectedTrace(null)}
      />
    </div>
  );
};

export default AIObservability;
