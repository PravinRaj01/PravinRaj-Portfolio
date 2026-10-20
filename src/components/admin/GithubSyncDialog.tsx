import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Github, Link2, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
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
  /** The chosen fields, to be reviewed in the edit form. Nothing is saved by this dialog. */
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
type FieldValue = string | string[] | ProjectLink[];
type OptionId = 'current' | 'repo' | 'merged' | 'combined';

interface Option {
  id: OptionId;
  label: string;
  value: FieldValue;
}

interface Field {
  key: FieldKey;
  /** `current` first. A single option means the repository has nothing different to offer. */
  options: Option[];
}

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
// Usually hand-tuned, so the saved value stays selected unless it is empty.
const KEEP_CURRENT: FieldKey[] = ['title', 'project_date', 'categories', 'positions'];

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

/** Everything already there, plus whatever the repository has that isn't. */
const combineValues = (key: FieldKey, cur: FieldValue, repo: FieldValue): FieldValue | null => {
  if (key === 'tags') {
    const have = new Set((cur as string[]).map((t) => t.toLowerCase()));
    return [...(cur as string[]), ...(repo as string[]).filter((t) => !have.has(t.toLowerCase()))];
  }
  if (key === 'project_links') {
    const have = new Set((cur as ProjectLink[]).map((l) => normUrl(l.url)));
    return [...(cur as ProjectLink[]), ...(repo as ProjectLink[]).filter((l) => !have.has(normUrl(l.url)))];
  }
  return null;
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

/** The choices for one field. Candidates that equal one already listed are folded into it. */
const buildField = (project: Project, draft: RepoImportResponse['draft'], key: FieldKey): Field => {
  const cur = currentValue(project, key);
  const repo = repoValue(draft, key);
  const options: Option[] = [{ id: 'current', label: 'Current', value: cur }];
  const offer = (option: Option) => {
    if (isEmpty(option.value)) return;
    if (options.some((o) => sameValue(key, o.value, option.value))) return;
    options.push(option);
  };
  offer({ id: 'repo', label: 'From repo', value: repo });
  if (key === 'description' && draft.merged_description) {
    offer({ id: 'merged', label: 'Merged with AI', value: draft.merged_description });
  }
  const combined = combineValues(key, cur, repo);
  if (combined) offer({ id: 'combined', label: 'Both', value: combined });
  return { key, options };
};

const defaultChoice = (field: Field): OptionId => {
  const has = (id: OptionId) => field.options.some((o) => o.id === id);
  if (isEmpty(field.options[0].value) && has('repo')) return 'repo';
  if (KEEP_CURRENT.includes(field.key)) return 'current';
  if (field.key === 'description') return has('merged') ? 'merged' : has('repo') ? 'repo' : 'current';
  if (field.key === 'tags' || field.key === 'project_links') return has('combined') ? 'combined' : has('repo') ? 'repo' : 'current';
  return has('repo') ? 'repo' : 'current';
};

/** The project-form fields a chosen value writes. */
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

const ChoiceCard = ({
  option,
  field,
  selected,
  onSelect,
}: {
  option: Option;
  field: FieldKey;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={cn(
      'relative flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 text-left text-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'hover:border-primary/50 hover:bg-muted/40',
    )}
  >
    <span className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{option.label}</span>
      {selected && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
    </span>
    <span className={cn('min-w-0', field === 'description' && 'max-h-48 overflow-y-auto pr-1')}>
      <ValueView field={field} value={option.value} />
    </span>
  </button>
);

const GithubSyncDialog = ({ project, mode, onOpenChange, onApply }: GithubSyncDialogProps) => {
  const [step, setStep] = useState<Step>('input');
  const [repoUrl, setRepoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoImportResponse | null>(null);
  const [choice, setChoice] = useState<Partial<Record<FieldKey, OptionId>>>({});
  // Which project the local state was initialised for, so opening on another project starts clean.
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (project && seededFor !== project.id) {
    setSeededFor(project.id);
    setStep('input');
    setRepoUrl(project.github_url ?? '');
    setNotes('');
    setError(null);
    setResult(null);
    setChoice({});
  }

  const linking = !project?.github_url;

  const fields = useMemo(
    () => (project && result ? ORDER.map((key) => buildField(project, result.draft, key)) : []),
    [project, result],
  );
  const decided = fields.filter((f) => f.options.length > 1);
  const unchanged = fields.filter((f) => f.options.length === 1);
  const chosen = (f: Field) => f.options.find((o) => o.id === choice[f.key]) ?? f.options[0];
  const changeCount = decided.filter((f) => chosen(f).id !== 'current').length;

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
      const defaults: Partial<Record<FieldKey, OptionId>> = {};
      for (const key of ORDER) {
        const field = buildField(project, response.draft, key);
        defaults[key] = defaultChoice(field);
      }
      setChoice(defaults);
      setResult(response);
      setStep('compare');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setStep('input');
    }
  };

  const keepAllCurrent = () => setChoice(Object.fromEntries(decided.map((f) => [f.key, 'current'])));
  const takeAllFromRepo = () =>
    setChoice(Object.fromEntries(decided.map((f) => [f.key, f.options.some((o) => o.id === 'repo') ? 'repo' : 'current'])));

  const handleApply = () => {
    if (!project || !result) return;
    const updates: Partial<Project> = {};
    for (const field of decided) {
      const picked = chosen(field);
      if (picked.id !== 'current') Object.assign(updates, toUpdate(field.key, picked.value));
    }
    // Linking a project that has no GitHub URL always records the repo it was linked to.
    if (!project.github_url && !updates.github_url) updates.github_url = result.draft.github_url;
    // Only stamp "synced" when the project ends up pointing at the repo that was read.
    const finalUrl = updates.github_url ?? project.github_url ?? '';
    if (normUrl(finalUrl) === normUrl(result.repo.html_url)) Object.assign(updates, syncStamp(result.repo));
    onApply(updates);
    handleOpenChange(false);
  };

  const applyLabel =
    changeCount > 0
      ? `Review ${changeCount} change${changeCount === 1 ? '' : 's'} in form`
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
              ? 'Paste the repository this project lives in. For each field you then pick which version to keep.'
              : 'Reads the repository again. For each field that differs, click the version you want; your choices are filled into the edit form for you to review, and nothing is saved until you save.'}
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
          <div className="space-y-5">
            <RepoSummary repo={result.repo} />

            {decided.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Click the version of each field to use.</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={keepAllCurrent}>
                      Keep all current
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={takeAllFromRepo}>
                      Take all from repo
                    </Button>
                  </div>
                </div>

                {decided.map((field) => (
                  <section key={field.key} className="space-y-2" aria-label={LABELS[field.key]}>
                    <h3 className="text-sm font-semibold">{LABELS[field.key]}</h3>
                    <div
                      role="radiogroup"
                      aria-label={LABELS[field.key]}
                      className={cn(
                        'grid gap-3 grid-cols-1',
                        field.options.length === 2 && 'sm:grid-cols-2',
                        field.options.length >= 3 && 'sm:grid-cols-2 lg:grid-cols-3',
                      )}
                    >
                      {field.options.map((option) => (
                        <ChoiceCard
                          key={option.id}
                          option={option}
                          field={field.key}
                          selected={chosen(field).id === option.id}
                          onSelect={() => setChoice((c) => ({ ...c, [field.key]: option.id }))}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </>
            ) : (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                Nothing in the repository differs from this project.
              </p>
            )}

            {unchanged.length > 0 && decided.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Nothing new from the repository for: {unchanged.map((f) => LABELS[f.key]).join(', ')}.
              </p>
            )}

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
              <Button type="button" onClick={handleApply} disabled={changeCount === 0 && !linking}>
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
