import { ReactNode } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';

interface VisiblePageGuardProps {
  /** Page key as used in professional_visible_pages / creative_visible_pages, e.g. 'academic'. */
  pageId: string;
  children: ReactNode;
  /** Rendered instead of children when the page is disabled for the current mode. */
  fallback: ReactNode;
}

/**
 * A page that's been turned off for the current mode (via admin's
 * ModeSettingsManager) should be a real 404, not silently render anyway —
 * SEO_GEO_PLAN.md §3: "a page disabled in a mode gets a real noindex 404".
 * `fallback` is passed in (rather than importing NotFound here) so this
 * component doesn't defeat NotFound's own lazy-loading in App.tsx.
 */
const VisiblePageGuard = ({ pageId, children, fallback }: VisiblePageGuardProps) => {
  const { mode, professionalVisiblePages, creativeVisiblePages, modeSettingsLoaded } = usePortfolio();

  // Don't flash a 404 before we know whether the page is actually hidden.
  if (!modeSettingsLoaded) return null;

  const visiblePages = mode === 'professional' ? professionalVisiblePages : creativeVisiblePages;
  return visiblePages.includes(pageId) ? <>{children}</> : <>{fallback}</>;
};

export default VisiblePageGuard;
