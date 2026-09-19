import { ReactNode } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { getModePath, Mode } from '@/lib/modePath';
import { useProjects } from '@/hooks/useProjects';
import { useProjectFolders } from '@/hooks/useProjectFolders';
import { useExperience } from '@/hooks/useExperience';

// `notFound` is passed in (App.tsx's already-lazy <NotFound/>) rather than
// imported here, so this file — statically imported by App.tsx — doesn't
// pull NotFound's chunk into the main bundle.

// Client-side redirects for the old unprefixed URLs (/projects, /experience/:id,
// etc.), now that every page lives under /pro/* or /creative/*. These are
// SPA-only for Phase 1 — Googlebot executes JS and follows them fine; a real
// HTTP 301 for non-JS crawlers needs default_mode (and, for detail pages,
// per-slug mode ownership) known at build time, which is Phase 2's prerender
// script (SEO_GEO_PLAN.md §3/§4).

/**
 * A bare list-page URL (e.g. /projects) → wherever it's actually visible.
 * Prefers the visitor's current mode; falls back to whichever mode has the
 * page visible; renders `notFound` if it's hidden in both (e.g. podcast is
 * currently disabled everywhere) rather than redirecting into a guaranteed
 * 404 (a real bug this fixes — see SEO_GEO_PLAN.md Phase 2 §5).
 */
export const LegacyModeRedirect = ({
  suffix,
  pageId,
  notFound,
}: {
  suffix: string;
  pageId: string;
  notFound: ReactNode;
}) => {
  const { mode, defaultMode, professionalVisiblePages, creativeVisiblePages, modeSettingsLoaded } = usePortfolio();
  if (!modeSettingsLoaded) return null;

  const visibleIn = (m: Mode) => (m === 'professional' ? professionalVisiblePages : creativeVisiblePages).includes(pageId);
  const targetMode: Mode | null = visibleIn(mode)
    ? mode
    : visibleIn(defaultMode)
      ? defaultMode
      : visibleIn('professional')
        ? 'professional'
        : visibleIn('creative')
          ? 'creative'
          : null;

  if (!targetMode) return <>{notFound}</>;
  return <Navigate to={getModePath(targetMode, defaultMode, suffix)} replace />;
};

/** A bare /projects/:id URL → whichever mode actually owns that project. */
export const LegacyProjectRedirect = ({ notFound }: { notFound: ReactNode }) => {
  const { id } = useParams<{ id: string }>();
  const { defaultMode, modeSettingsLoaded } = usePortfolio();
  const { projects: proProjects, loading: proLoading } = useProjects('professional');
  const { projects: creProjects, loading: creLoading } = useProjects('creative');

  if (!modeSettingsLoaded || proLoading || creLoading) return null;

  const owningMode = proProjects.some((p) => p.slug === id || p.id === id)
    ? 'professional'
    : creProjects.some((p) => p.slug === id || p.id === id)
      ? 'creative'
      : null;

  if (!owningMode) return <>{notFound}</>;
  return <Navigate to={getModePath(owningMode, defaultMode, `/projects/${id}`)} replace />;
};

/** A bare /projects/folder/:folderId URL → whichever mode owns that folder. */
export const LegacyProjectFolderRedirect = ({ notFound }: { notFound: ReactNode }) => {
  const { folderId } = useParams<{ folderId: string }>();
  const { defaultMode, modeSettingsLoaded } = usePortfolio();
  const { folders: proFolders, loading: proLoading } = useProjectFolders('professional');
  const { folders: creFolders, loading: creLoading } = useProjectFolders('creative');

  if (!modeSettingsLoaded || proLoading || creLoading) return null;

  const owningMode = proFolders.some((f) => f.id === folderId)
    ? 'professional'
    : creFolders.some((f) => f.id === folderId)
      ? 'creative'
      : null;

  if (!owningMode) return <>{notFound}</>;
  return <Navigate to={getModePath(owningMode, defaultMode, `/projects/folder/${folderId}`)} replace />;
};

/** A bare /experience/:id URL → whichever mode owns that experience. */
export const LegacyExperienceRedirect = ({ notFound }: { notFound: ReactNode }) => {
  const { id } = useParams<{ id: string }>();
  const { defaultMode, modeSettingsLoaded } = usePortfolio();
  const { experiences: proExperiences, loading: proLoading } = useExperience('professional');
  const { experiences: creExperiences, loading: creLoading } = useExperience('creative');

  if (!modeSettingsLoaded || proLoading || creLoading) return null;

  const owningMode = proExperiences.some((e) => e.slug === id || e.id === id)
    ? 'professional'
    : creExperiences.some((e) => e.slug === id || e.id === id)
      ? 'creative'
      : null;

  if (!owningMode) return <>{notFound}</>;
  return <Navigate to={getModePath(owningMode, defaultMode, `/experience/${id}`)} replace />;
};
