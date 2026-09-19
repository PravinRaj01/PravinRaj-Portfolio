
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';
import { SiteSettings } from '@/types/content';
import { toast } from 'sonner';
import { Mode, getModeHomePath, getModePath, stripModePrefix } from '@/lib/modePath';

// The exact 5-column subset GET /site-settings/modes returns
// (MIGRATION_PLAN.md §7 / Appendix A.3 SiteSettingsModeRead).
type SiteSettingsModeSubset = Pick<
  SiteSettings,
  | 'professional_mode_enabled'
  | 'creative_mode_enabled'
  | 'default_mode'
  | 'professional_visible_pages'
  | 'creative_visible_pages'
>;

interface PortfolioContextType {
  mode: Mode;
  defaultMode: Mode;
  darkMode: boolean;
  handleModeToggle: () => void;
  handleDarkModeToggle: () => void;
  /** Called by ModeLayout when a /pro or /creative route mounts, to sync the URL's mode into state. */
  syncModeFromUrl: (mode: Mode) => void;
  professionalModeEnabled: boolean;
  creativeModeEnabled: boolean;
  modeSettingsLoaded: boolean;
  isTransitioning: boolean;
  transitionTargetMode: Mode;
  professionalVisiblePages: string[];
  creativeVisiblePages: string[];
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};

interface PortfolioProviderProps {
  children: ReactNode;
}

// Default page visibility - Academic is pro-focused, Podcast is creative-focused
const DEFAULT_PROFESSIONAL_PAGES = ['home', 'projects', 'experience', 'academic', 'contact'];
const DEFAULT_CREATIVE_PAGES = ['home', 'projects', 'experience', 'contact', 'podcast'];

// Onboarding key duplicated (not imported) to match OnboardingPopup.tsx's own
// literal — same loose-coupling pattern already used for 'portfolioMode'.
const ONBOARDING_KEY = 'gg_portfolio_onboarding_seen';

// Map a (possibly mode-prefixed) pathname to a page ID
const getPageIdFromPath = (pathname: string): string | null => {
  const { rest } = stripModePrefix(pathname);
  if (rest === '/') return 'home';
  if (rest === '/projects' || rest.startsWith('/projects/')) return 'projects';
  if (rest === '/experience' || rest.startsWith('/experience/')) return 'experience';
  if (rest === '/academic') return 'academic';
  if (rest === '/contact') return 'contact';
  if (rest === '/podcast') return 'podcast';
  return null;
};

const getPageNameFromId = (id: string): string => {
  const names: Record<string, string> = {
    home: 'Home',
    projects: 'Projects',
    experience: 'Experience',
    academic: 'Academic',
    contact: 'Contact',
    podcast: 'Podcast',
  };
  return names[id] || id;
};

export const PortfolioProvider: React.FC<PortfolioProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('professional');
  const [defaultMode, setDefaultMode] = useState<Mode>('professional');
  const [darkMode, setDarkMode] = useState(true);
  const [professionalModeEnabled, setProfessionalModeEnabled] = useState(true);
  const [creativeModeEnabled, setCreativeModeEnabled] = useState(true);
  const [modeSettingsLoaded, setModeSettingsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTargetMode, setTransitionTargetMode] = useState<Mode>('professional');
  const [professionalVisiblePages, setProfessionalVisiblePages] = useState<string[]>(DEFAULT_PROFESSIONAL_PAGES);
  const [creativeVisiblePages, setCreativeVisiblePages] = useState<string[]>(DEFAULT_CREATIVE_PAGES);

  useEffect(() => {
    // Always set dark mode - light mode is removed
    setDarkMode(true);
    document.documentElement.classList.add('dark');

    // Fetch mode settings from the new FastAPI backend (MIGRATION_PLAN.md §7);
    // on any failure this falls back to the already-initialized defaults
    // above, exactly as the Supabase error path did before.
    const fetchModeSettings = async () => {
      try {
        let data: SiteSettingsModeSubset;
        try {
          data = await apiClient.get<SiteSettingsModeSubset>('/site-settings/modes');
        } catch {
          console.log('Using default mode settings');
          setModeSettingsLoaded(true);
          return;
        }

        const proEnabled = data?.professional_mode_enabled ?? true;
        const creEnabled = data?.creative_mode_enabled ?? true;

        setProfessionalModeEnabled(proEnabled);
        setCreativeModeEnabled(creEnabled);

        // Set visible pages from database or use defaults
        setProfessionalVisiblePages(data?.professional_visible_pages ?? DEFAULT_PROFESSIONAL_PAGES);
        setCreativeVisiblePages(data?.creative_visible_pages ?? DEFAULT_CREATIVE_PAGES);

        // Resolve which mode is "default" (falls back to whichever is enabled
        // if the configured default_mode is itself disabled)
        let resolvedDefaultMode: Mode;
        if (data?.default_mode === 'professional' && proEnabled) {
          resolvedDefaultMode = 'professional';
        } else if (data?.default_mode === 'creative' && creEnabled) {
          resolvedDefaultMode = 'creative';
        } else {
          resolvedDefaultMode = proEnabled ? 'professional' : 'creative';
        }
        setDefaultMode(resolvedDefaultMode);

        // Mode itself: prefer whatever the current URL's prefix says (a
        // /pro or /creative route — ModeLayout also syncs this on its own
        // mount, this just avoids an initial flash of the wrong mode); on
        // '/' always use the default; otherwise fall back to the saved
        // preference.
        const { mode: urlMode } = stripModePrefix(window.location.pathname);
        if (urlMode === 'professional' && proEnabled) {
          setMode('professional');
          localStorage.setItem('portfolioMode', 'professional');
        } else if (urlMode === 'creative' && creEnabled) {
          setMode('creative');
          localStorage.setItem('portfolioMode', 'creative');
        } else if (window.location.pathname === '/') {
          setMode(resolvedDefaultMode);
          localStorage.removeItem('portfolioMode');
        } else {
          const savedMode = localStorage.getItem('portfolioMode') as Mode | null;
          if (savedMode === 'professional' && proEnabled) {
            setMode('professional');
          } else if (savedMode === 'creative' && creEnabled) {
            setMode('creative');
          } else {
            setMode(resolvedDefaultMode);
          }
        }

        setModeSettingsLoaded(true);
      } catch (error) {
        console.error('Error fetching mode settings:', error);
        setModeSettingsLoaded(true);
      }
    };

    fetchModeSettings();
  }, []);

  // '/' always represents default_mode — this keeps that invariant true not
  // just on first load, but for every later SPA navigation back to '/' too
  // (the logo link, the mode toggle's fallback, the browser back button…).
  useEffect(() => {
    if (!modeSettingsLoaded) return;
    if (location.pathname === '/') {
      setMode(defaultMode);
      localStorage.removeItem('portfolioMode');
    }
  }, [location.pathname, modeSettingsLoaded, defaultMode]);

  useEffect(() => {
    // Apply creative class based on mode
    if (mode === 'creative') {
      document.documentElement.classList.add('creative');
    } else {
      document.documentElement.classList.remove('creative');
    }
  }, [mode]);

  // Called by ModeLayout when a /pro or /creative route mounts.
  const syncModeFromUrl = useCallback((urlMode: Mode) => {
    const enabled = urlMode === 'professional' ? professionalModeEnabled : creativeModeEnabled;
    if (!enabled) return;
    setMode(urlMode);
    localStorage.setItem('portfolioMode', urlMode);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, [professionalModeEnabled, creativeModeEnabled]);

  const handleModeToggle = () => {
    // Only toggle if both modes are enabled and not already transitioning
    if (professionalModeEnabled && creativeModeEnabled && !isTransitioning) {
      const newMode: Mode = mode === 'professional' ? 'creative' : 'professional';
      const newModePages = newMode === 'professional' ? professionalVisiblePages : creativeVisiblePages;

      // Only '/' and /pro/* or /creative/* URLs carry a mode. On mode-neutral
      // pages (/admin, /playground) the toggle just switches which mode is
      // active, in place — there's no "same page in the other mode" to go to
      // (navigating would land on e.g. /pro/admin, which doesn't exist).
      const isModeScoped = location.pathname === '/' || stripModePrefix(location.pathname).mode !== null;
      if (!isModeScoped) {
        setTransitionTargetMode(newMode);
        setIsTransitioning(true);
        setTimeout(() => {
          setMode(newMode);
          localStorage.setItem('portfolioMode', newMode);
        }, 300);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 1500);
        return;
      }

      // Get current page from URL
      const currentPageId = getPageIdFromPath(location.pathname);
      const { rest: currentRest } = stripModePrefix(location.pathname);

      // Check if current page exists in new mode
      const pageExistsInNewMode = currentPageId ? newModePages.includes(currentPageId) : true;

      // Where toggling should land: the equivalent page in the new mode, or
      // that mode's home if the current page doesn't exist there.
      const targetPath = pageExistsInNewMode
        ? getModePath(newMode, defaultMode, currentRest)
        : getModeHomePath(newMode, defaultMode);

      setTransitionTargetMode(newMode);
      setIsTransitioning(true);

      // Delay the actual navigation to let the sweep start first. The
      // destination route (ModeLayout, or '/'s own effect above) syncs
      // `mode` + localStorage once the URL lands — no need to do it here too.
      setTimeout(() => {
        navigate(targetPath);

        // If page doesn't exist in new mode, show a toast explaining why
        if (!pageExistsInNewMode && currentPageId) {
          const pageName = getPageNameFromId(currentPageId);

          setTimeout(() => {
            toast.info(`${pageName} page only exists in ${mode === 'professional' ? 'Professional' : 'Creative'} mode`, {
              duration: 4000,
            });
          }, 500);
        }
      }, 300);

      // Reset transition state after animation completes (match ModeTransitionOverlay duration)
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1500);
    }
  };

  const handleDarkModeToggle = () => {
    // Dark mode toggle removed - always stay in dark mode
  };

  const value = {
    mode,
    defaultMode,
    darkMode,
    handleModeToggle,
    handleDarkModeToggle,
    syncModeFromUrl,
    professionalModeEnabled,
    creativeModeEnabled,
    modeSettingsLoaded,
    isTransitioning,
    transitionTargetMode,
    professionalVisiblePages,
    creativeVisiblePages,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};
