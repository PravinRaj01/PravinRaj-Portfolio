// Plain helpers shared by the GitHub import and sync dialogs (kept out of the .tsx so fast refresh stays happy).
import type { Project } from '@/types/cms';
import type { RepoImportResponse, RepoInfo } from '@/types/repoImport';

/** GitHub's own facts: the repo's push time is stored so a later "has it changed?" check has something to compare to. */
export const syncStamp = (repo: RepoInfo): Pick<Project, 'github_pushed_at' | 'github_synced_at'> => ({
  github_pushed_at: repo.pushed_at,
  github_synced_at: new Date().toISOString(),
});

/** A draft shaped like the project form's fields, stamped as synced just now. */
export const toProjectDraft = (response: RepoImportResponse): Partial<Project> => {
  const d = response.draft;
  return {
    title: d.title,
    description: d.description,
    category: d.category,
    categories: d.categories,
    tags: d.tags,
    position: d.position ?? undefined,
    positions: d.positions,
    project_date: d.project_date ?? undefined,
    github_url: d.github_url,
    live_url: d.live_url ?? undefined,
    project_links: d.project_links,
    ...syncStamp(response.repo),
  };
};
