// Response of POST /ai/project-from-repo (backend/app/schemas/ai.py).
import type { ProjectLink } from '@/types/cms';

export interface RepoProjectDraft {
  title: string;
  description: string;
  category: string;
  categories: string[];
  tags: string[];
  position: string | null;
  positions: string[];
  project_date: string | null;
  github_url: string;
  live_url: string | null;
  project_links: ProjectLink[];
}

export interface RepoInfo {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  languages: string | null;
  stars: number;
  forks: number;
  created_at: string | null;
  pushed_at: string | null;
  license: string | null;
  topics: string[];
  archived: boolean;
  is_fork: boolean;
  readme_found: boolean;
  files_considered: number;
  manifests: string[];
  tree_truncated: boolean;
}

export interface RepoImportResponse {
  draft: RepoProjectDraft;
  /** The facts the draft rests on, for the reviewer to check. */
  highlights: string[];
  repo: RepoInfo;
}

/** Sent with a repo import to refresh an existing project instead of drafting a new one. */
export interface CurrentProjectEntry {
  title: string;
  description: string;
  tags: string[];
}

// Response row of GET /ai/repo-status (backend/app/schemas/ai.py).
export type RepoSyncState = 'never_synced' | 'up_to_date' | 'changed' | 'unavailable';

export interface RepoStatus {
  project_id: string;
  state: RepoSyncState;
  pushed_at: string | null;
}
