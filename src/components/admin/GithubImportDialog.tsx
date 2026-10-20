import React, { useState } from 'react';
import { ArrowLeft, Check, Github, Loader2, Sparkles } from 'lucide-react';
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
import { apiClient } from '@/services/apiClient';
import type { Project } from '@/types/cms';
import type { RepoImportResponse } from '@/types/repoImport';
import { ImportErrorAlert, RepoSummary, Row } from './githubImportShared';
import { toProjectDraft } from './githubImport';

interface GithubImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'professional' | 'creative';
  /** Called with a draft shaped like the project form's fields; nothing is saved yet. */
  onUseDraft: (draft: Partial<Project>) => void;
}

type Step = 'input' | 'generating' | 'preview';

const GithubImportDialog = ({ open, onOpenChange, mode, onUseDraft }: GithubImportDialogProps) => {
  const [step, setStep] = useState<Step>('input');
  const [repoUrl, setRepoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoImportResponse | null>(null);

  const reset = () => {
    setStep('input');
    setError(null);
    setResult(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && step === 'generating') return; // don't lose an in-flight import
    if (!next) {
      reset();
      setRepoUrl('');
      setNotes('');
    }
    onOpenChange(next);
  };

  const handleImport = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!repoUrl.trim()) {
      setError('Paste a GitHub repository URL first.');
      return;
    }
    setError(null);
    setStep('generating');
    try {
      const response = await apiClient.post<RepoImportResponse>('/ai/project-from-repo', {
        repo_url: repoUrl.trim(),
        mode,
        additionalContext: notes.trim() || undefined,
      });
      setResult(response);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('input');
    }
  };

  const handleUse = () => {
    if (!result) return;
    onUseDraft(toProjectDraft(result));
    reset();
    setRepoUrl('');
    setNotes('');
    onOpenChange(false);
  };

  const repo = result?.repo;
  const draft = result?.draft;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" /> Import from GitHub
          </DialogTitle>
          <DialogDescription>
            Paste a repository URL. The AI reads its README and build files and drafts a project entry for you to
            review. Nothing is saved until you save the project.
          </DialogDescription>
        </DialogHeader>

        {step !== 'preview' && (
          <form onSubmit={handleImport} className="space-y-4">
            {error && <ImportErrorAlert message={error} />}

            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
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
              <Label htmlFor="repo-notes">Anything the AI should know? (optional)</Label>
              <Textarea
                id="repo-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. I built this solo for a hackathon and led the backend."
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
                    <Sparkles className="h-4 w-4 mr-2" /> Create draft
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

        {step === 'preview' && result && repo && draft && (
          <div className="space-y-5">
            <RepoSummary repo={repo} />

            <dl className="space-y-3">
              <Row label="Title">
                <span className="font-medium">{draft.title}</span>
              </Row>
              <Row label="Description">
                <p className="whitespace-pre-wrap">{draft.description}</p>
              </Row>
              <Row label="Category">
                <span className="flex flex-wrap gap-1.5">
                  {draft.categories.map((c) => (
                    <Badge key={c} variant={c === draft.category ? 'default' : 'secondary'}>
                      {c}
                    </Badge>
                  ))}
                </span>
              </Row>
              {draft.tags.length > 0 && (
                <Row label="Tags">
                  <span className="flex flex-wrap gap-1.5">
                    {draft.tags.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </Row>
              )}
              {draft.positions.length > 0 && <Row label="Role">{draft.positions.join(', ')}</Row>}
              {draft.project_date && <Row label="Date">{draft.project_date}</Row>}
              <Row label="Links">
                <ul className="space-y-0.5">
                  <li>
                    <span className="text-muted-foreground">GitHub:</span> {draft.github_url}
                  </li>
                  {draft.live_url && (
                    <li>
                      <span className="text-muted-foreground">Live:</span> {draft.live_url}
                    </li>
                  )}
                  {draft.project_links.map((l) => (
                    <li key={l.url}>
                      <span className="text-muted-foreground">{l.label}:</span> {l.url}
                    </li>
                  ))}
                </ul>
              </Row>
            </dl>

            {result.highlights.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  What the draft is based on — check these
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {result.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Next you'll see this in the normal project form. Add a thumbnail, and adjust the date
              {repo.pushed_at ? ` (the repository was created ${draft.project_date ?? 'earlier'} and last pushed ${new Date(repo.pushed_at).toLocaleDateString()})` : ''}
              {' '}before saving.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button type="button" onClick={handleUse}>
                <Check className="h-4 w-4 mr-2" /> Use this draft
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GithubImportDialog;
