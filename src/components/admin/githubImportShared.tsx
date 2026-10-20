// Pieces shared by the "Import from GitHub" and "Sync with GitHub" dialogs.
import React from 'react';
import { AlertCircle, ExternalLink, FileText, Star } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { RepoInfo } from '@/types/repoImport';

export const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1 sm:grid-cols-[110px_1fr] sm:gap-3">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">{label}</dt>
    <dd className="text-sm min-w-0 break-words">{children}</dd>
  </div>
);

export const RepoSummary = ({ repo }: { repo: RepoInfo }) => (
  <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      {repo.full_name} <ExternalLink className="h-3 w-3" />
    </a>
    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
      {repo.language && <span>{repo.languages ?? repo.language}</span>}
      <span className="inline-flex items-center gap-1">
        <Star className="h-3 w-3" /> {repo.stars}
      </span>
      <span className="inline-flex items-center gap-1">
        <FileText className="h-3 w-3" />
        {repo.readme_found ? 'README read' : 'no README found'}
        {repo.manifests.length > 0 && ` · ${repo.manifests.join(', ')}`}
      </span>
      {repo.is_fork && <Badge variant="outline">fork</Badge>}
      {repo.archived && <Badge variant="outline">archived</Badge>}
    </p>
  </div>
);

export const ImportErrorAlert = ({ message }: { message: string }) => (
  <Alert variant="destructive" className="text-red-600 dark:text-red-300 dark:border-red-500/60 [&>svg]:text-red-500">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Couldn't import</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
);
