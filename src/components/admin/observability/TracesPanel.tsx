import React, { useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useObservabilityTraces } from '@/hooks/useAIObservability';
import type { ObservabilityRange, TraceRow, TraceTag } from '@/types/observability';
import { ALERT_ERROR_CLASS, TAG_LABELS, formatMs, formatTokens } from './format';

interface TracesPanelProps {
  range: ObservabilityRange;
  onOpenTrace: (traceId: string) => void;
}

const PAGE_SIZE = 20;
const ALL = 'all';

const FILTERS: TraceTag[] = ['chat', 'admin', 'blocked', 'fallback', 'navigate', 'voice', 'error', 'rag_fallback'];

// "chat" and "admin" are already conveyed by the Type column.
const NOTABLE_TAGS = ['blocked', 'fallback', 'navigate', 'voice', 'error', 'span_error', 'rag_fallback'];

const typeLabel = (name: string | null): string => {
  if (!name) return 'Unnamed';
  if (name === 'chat') return 'Chat';
  return name.replace(/^admin\./, '').replace(/_/g, ' ');
};

const tagVariant = (tag: string): 'destructive' | 'secondary' | 'outline' =>
  tag === 'error' ? 'destructive' : tag === 'blocked' || tag === 'fallback' ? 'secondary' : 'outline';

export const TraceTableRow = ({ row, onOpen }: { row: TraceRow; onOpen: (id: string) => void }) => {
  const open = () => row.id && onOpen(row.id);
  const tags = row.tags.filter((t) => NOTABLE_TAGS.includes(t));
  return (
    <TableRow
      className="cursor-pointer"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
      aria-label={`Open trace ${typeLabel(row.name)}`}
    >
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {row.started_at ? format(new Date(row.started_at), 'MMM d, HH:mm:ss') : '—'}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant="outline" className="capitalize">{typeLabel(row.name)}</Badge>
      </TableCell>
      <TableCell className="max-w-[260px]">
        <p className="truncate text-sm">{row.input_preview ?? '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{row.output_preview ?? ''}</p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right text-sm">{formatMs(row.duration_ms)}</TableCell>
      <TableCell className="whitespace-nowrap text-right text-sm">{formatTokens(row.tokens)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {row.provider ?? '—'}
        {row.path && <span className="text-muted-foreground"> · {row.path}</span>}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant={tagVariant(tag)} className="text-[10px]">
              {TAG_LABELS[tag] ?? tag}
            </Badge>
          ))}
          {row.rating === 1 && <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" aria-label="Rated good" />}
          {row.rating === 0 && <ThumbsDown className="h-3.5 w-3.5 text-red-600" aria-label="Rated bad" />}
        </div>
      </TableCell>
    </TableRow>
  );
};

const TracesPanel = ({ range, onOpenTrace }: TracesPanelProps) => {
  const [tag, setTag] = useState<TraceTag | undefined>(undefined);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useObservabilityTraces({ range, tag, search, page, size: PAGE_SIZE });
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={tag ?? ALL}
          onValueChange={(value) => {
            setPage(1);
            setTag(value === ALL ? undefined : (value as TraceTag));
          }}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter by tag">
            <SelectValue placeholder="All traces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All traces</SelectItem>
            {FILTERS.map((t) => (
              <SelectItem key={t} value={t}>
                {TAG_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form onSubmit={applySearch} className="flex flex-1 gap-2" role="search">
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search messages and replies…"
            maxLength={100}
            aria-label="Search traces"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {query.isError ? (
        <Alert variant="destructive" className={ALERT_ERROR_CLASS}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Couldn't load traces</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{query.error instanceof Error ? query.error.message : 'Unexpected error'}</span>
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : query.isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading traces">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No traces match{tag || search ? ' these filters' : ' yet'} in this period.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message / reply</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, i) => (
                  <TraceTableRow key={row.id ?? i} row={row} onOpen={onOpenTrace} />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total.toLocaleString()} trace{data.total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || query.isFetching}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || query.isFetching}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TracesPanel;
