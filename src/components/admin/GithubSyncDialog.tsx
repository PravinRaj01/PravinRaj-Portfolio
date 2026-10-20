import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Github, Link2, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/services/apiClient';
import type { Project, ProjectLink } from '@/types/cms';
import type { CurrentProjectEntry, RepoImportResponse } from '@/types/repoImport';
import { ImportErrorAlert, RepoSummary } from './githubImportShared';
import { syncStamp } from './githubImport';

interface GithubSyncDialogProps {
  /** The project being synced; the dialog is closed while this is null. */
  project: Project | null;
  mode: 'professional' | 'creative';
  onOpenChange: (open: boolean) => void;
  /** The ticked fields, to be reviewed in the edit form. Nothing is saved by this dialog. */
  onApply: (updates: Partial<Project>) => void;
}

type Step = 'input' | 'generating' | 'compare';
type FieldKey =
  | 'title'
  | 'description'
  | 'categories'
  | 'tags'
  | 'positions'
  | 'project_date'
  | 'github_url'
  | 'live_url'
  | 'project_links';
type MergeKey = 'tags' | 'project_links';
type Combine = 'merge' | 'replace';
type FieldValue = string | string[] | ProjectLink[];

const MERGEABLE: FieldKey[] = ['tags', 'project_links'];
// Usually hand-tuned, so only pre-ticked when the project has nothing there yet.
const HAND_TUNED: FieldKey[] = ['title', 'project_date', 'categories', 'positions'];

const LABELS: Record<FieldKey, string> = {
  title: 'Title',
  description: 'Description',
  categories: 'Categories',
  tags: 'Tags',
  positions: 'Roles',
  project_date: 'Date',
  github_url: 'GitHub URL',
  live_url: 'Live URL',
  project_links: 'Links',
};
const ORDER: FieldKey[] = [
  'description', 'title', 'tags', 'categories', 'positions', 'project_date', 'github_url', 'live_url', 'project_links',
];

const normUrl = (url: string) => url.trim().replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();
const isEmpty = (v: FieldValue) => (Array.isArray(v) ? v.length === 0 : !v.trim());

const currentValue = (p: Project, key: FieldKey): FieldValue => {
  switch (key) {
    case 'categories': return p.categories?.length ? p.categories : p.category ? [p.category] : [];
    case 'positions': return p.positions?.length ? p.positions : p.position ? [p.position] : [];
    case 'tags': return p.tags ?? [];
    case 'project_links': return p.project_links ?? [];
    case 'title': return p.title ?? '';
    case 'description': return p.description ?? '';
    case 'project_date': return p.project_date ?? '';
    case 'github_url': return p.github_url ?? '';
    case 'live_url': return p.live_url ?? '';
  }
};

const repoValue = (d: RepoImportResponse['draft'], key: FieldKey): FieldValue => {
  switch (key) {
    case 'categories': return d.categories;
    case 'positions': return d.positions;
    case 'tags': return d.tags;
    case 'project_links': return d.project_links;
    case 'title': return d.title;
    case 'description': return d.description;
    case 'project_date': return d.project_date ?? '';
    case 'github_url': return d.github_url;
    case 'live_url': return d.live_url ?? '';
  }
};

/** What the field would become if ticked. Tags and links can be merged into what is there. */
const proposed = (key: FieldKey, cur: FieldValue, repo: FieldValue, combine: Combine): FieldValue => {
  if (combine === 'merge' && key === 'tags') {
    const have = new Set((cur as string[]).map((t) => t.toLowerCase()));
    return [...(cur as string[]), ...(repo as string[]).filter((t) => !have.has(t.toLowerCase()))];
  }
  if (combine === 'merge' && key === 'project_links') {
    const have = new Set((cur as ProjectLink[]).map((l) => normUrl(l.url)));
    return [...(cur as ProjectLink[]), ...(repo as ProjectLink[]).filter((l) => !have.has(normUrl(l.url)))];
  }
  return repo;
};

const sameValue = (key: FieldKey, a: FieldValue, b: FieldValue): boolean => {
  if (key === 'github_url' || key === 'live_url') return normUrl(a as string) === normUrl(b as string);
  if (key === 'project_links') {
    const shape = (v: FieldValue) => JSON.stringify((v as ProjectLink[]).map((l) => [l.label, normUrl(l.url)]));
    return shape(a) === shape(b);
  }
  if (Array.isArray(a)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
};

/** The project-form fields a ticked row writes. */
const toUpdate = (key: FieldKey, value: FieldValue): Partial<Project> => {
  switch (key) {
    case 'categories': return { categories: value as string[], category: (value as string[])[0] ?? '' };
    case 'positions': return { positions: value as string[], position: (value as string[])[0] ?? '' };
    case 'tags': return { tags: value as string[] };
    case 'project_links': return { project_links: value as ProjectLink[] };
    case 'title': return { title: value as string };
    case 'description': return { description: value as string };
    case 'project_date': return { project_date: value as string };
    case 'github_url': return { github_url: value as string };
    case 'live_url': return { live_url: value as string };
  }
};

const ValueView = ({ field, value }: { field: FieldKey; value: FieldValue }) => {
  if (isEmpty(value)) return <span className="text-muted-foreground italic">empty</span>;
  if (field === 'project_links') {
    return (
      <ul className="space-y-0.5">
        {(value as ProjectLink[]).map((l) => (
          <li key={l.url}>
            <span className="text-muted-foreground">{l.label}:</span> {l.url}
          </li>
        ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {(value as string[]).map((v) => (
          <Badge key={v} variant="secondary">
            {v}
          </Badge>
        ))}
      </span>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{value}</p>;
};

const GithubSyncDialog = ({ project, mode, onOpenChange, onApply }: GithubSyncDialogProps) => {
  const [step, setStep] = useState<Step>('input');
  const [repoUrl, setRepoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoImportResponse | null>(null);
  const [ticked, setTicked] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [combine, setCombine] = useState<Record<MergeKey, Combine>>({ tags: 'merge', project_links: 'merge' });
  // Which project the local state was initialised for, so opening on another project starts clean.
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (project && seededFor !== project.id) {
    setSeededFor(project.id);
    setStep('input');
    setRepoUrl(project.github_url ?? '');
    setNotes('');
    setError(null);
    setResult(null);
    setTicked({});
    setCombine({ tags: 'merge', project_links: 'merge' });
  }

  const linking = !project?.github_url;

  const rows = useMemo(() => {
    if (!project || !result) return [];
    return ORDER.map((key) => {
      const cur = currentValue(project, key);
      const how: Combine = MERGEABLE.includes(key) ? combine[key as MergeKey] : 'replace';
      const next = proposed(key, cur, repoValue(result.draft, key), how);
      return { key, cur, next, differs: !isEmpty(next) && !sameValue(key, cur, next) };
    });
  }, [project, result, combine]);

  const handleOpenChange = (next: boolean) => {
    if (!next && step === 'generating') return; // don't lose an in-flight sync
    if (!next) setSeededFor(null);
    onOpenChange(next);
  };

  const handleCompare = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!project) return;
    if (!repoUrl.trim()) {
      setError('Paste a GitHub repository URL first.');
      return;
    }
    setError(null);
    setStep('generating');
    const current: CurrentProjectEntry = {
      title: project.title,
      description: project.description,
      tags: project.tags ?? [],
    };
    try {
      const response = await apiClient.post<RepoImportResponse>('/ai/project-from-repo', {
        repo_url: repoUrl.trim(),
        mode,
        additionalContext: notes.trim() || undefined,
        current,
      });
      const defaults: Partial<Record<FieldKey, boolean>> = {};
      for (const key of ORDER) {
        const cur = currentValue(project, key);
        const next = proposed(key, cur, repoValue(response.draft, key), 'merge');
        const differs = !isEmpty(next) && !sameValue(key, cur, next);
        defaults[key] = differs && (!HAND_TUNED.includes(key) || isEmpty(cur));
      }
      setTicked(defaults);
      setResult(response);
      setStep('compare');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setStep('input');
    }
  };

  const handleApply = () => {
    if (!project || !result) return;
    const updates: Partial<Project> = {};
    for (const row of rows) {
      if (ticked[row.key] && row.differs) Object.assign(updates, toUpdate(row.key, row.next));
    }
    // Linking a project that has no GitHub URL always records the repo it was linked to.
    if (!project.github_url && !updates.github_url) updates.github_url = result.draft.github_url;
    // Only stamp "synced" when the project ends up pointing at the repo that was read.
    const finalUrl = updates.github_url ?? project.github_url ?? '';
    if (normUrl(finalUrl) === normUrl(result.repo.html_url)) Object.assign(updates, syncStamp(result.repo));
    onApply(updates);
    handleOpenChange(false);
  };

  const tickedCount = rows.filter((r) => ticked[r.key] && r.differs).length;
  const applyLabel =
    tickedCount > 0
      ? `Review ${tickedCount} change${tickedCount === 1 ? '' : 's'} in form`
      : linking
        ? 'Link only'
        : 'Nothing selected';

  return (
    <Dialog open={!!project} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {linking ? <Link2 className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
            {linking ? 'Link to GitHub' : 'Sync with GitHub'}
            {project && <span className="font-normal text-muted-foreground truncate">· {project.title}</span>}
          </DialogTitle>
          <DialogDescription>
            {linking
              ? 'Paste the repository this project lives in. You choose which fields to take from it.'
              : 'Reads the repository again and shows what differs. Tick the fields to update; they are filled into the edit form for you to review, and nothing is saved until you save.'}
          </DialogDescription>
        </DialogHeader>

        {step !== 'compare' && (
          <form onSubmit={handleCompare} className="space-y-4">
            {error && <ImportErrorAlert message={error} />}

            <div className="space-y-2">
              <Label htmlFor="sync-repo-url">Repository URL</Label>
              <Input
                id="sync-repo-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                disabled={step === 'generating'}
                autoFocus
                inputMode="url"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-notes">Anything the AI should know? (optional)</Label>
              <Textarea
                id="sync-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. I added a mobile app since the last sync."
                rows={3}
                maxLength={1000}
                disabled={step === 'generating'}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={step === 'generating'}>
                Cancel
              </Button>
              <Button type="submit" disabled={step === 'generating' || !repoUrl.trim()}>
                {step === 'generating' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading the repository…
                  </>
                ) : (
                  <>
                    <Github className="h-4 w-4 mr-2" /> Compare with repository
                  </>
                )}
              </Button>
            </DialogFooter>
            {step === 'generating' && (
              <p className="text-xs text-muted-foreground text-center" role="status">
                This usually takes 10–20 seconds.
              </p>
            )}
          </form>
        )}

        {step === 'compare' && result && (
          <div className="space-y-4">
            <RepoSummary repo={result.repo} />

            <ul className="space-y-3">
              {rows.map(({ key, cur, next, differs }) => (
                <li key={key} className={`rounded-lg border p-3 ${differs ? '' : 'opacity-60'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox
                      id={`sync-${key}`}
                      checked={!!ticked[key] && differs}
                      disabled={!differs}
                      onCheckedChange={(v) => setTicked((t) => ({ ...t, [key]: v === true }))}
                    />
                    <Label htmlFor={`sync-${key}`} className="font-medium">
                      {LABELS[key]}
                    </Label>
                    {!differs && <span className="text-xs text-muted-foreground">nothing new from the repository</span>}
                    {MERGEABLE.includes(key) && (
                      <div className="ml-auto flex gap-1" role="group" aria-label={`How to apply ${LABELS[key]}`}>
                        {(['merge', 'replace'] as const).map((c) => (
                          <Button
                            key={c}
                            type="button"
                            size="sm"
                            variant={combine[key as MergeKey] === c ? 'default' : 'outline'}
                            className="h-6 px-2 text-xs"
                            onClick={() => setCombine((m) => ({ ...m, [key]: c }))}
                          >
                            {c === 'merge' ? 'Add new' : 'Replace'}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {differs && (
                    <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Current</p>
                        <ValueView field={key} value={cur} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                          From repository
                        </p>
                        <ValueView field={key} value={next} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {result.highlights.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  What the suggestions are based on — check these
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {result.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setStep('input')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button type="button" onClick={handleApply} disabled={tickedCount === 0 && !linking}>
                <Check className="h-4 w-4 mr-2" />
                {applyLabel}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GithubSyncDialog;
