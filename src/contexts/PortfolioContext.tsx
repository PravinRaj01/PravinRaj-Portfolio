
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/utils/supabase';
import { SiteSettings } from '@/types/content';
import { toast } from 'sonner';

interface PortfolioContextType {
  mode: 'professional' | 'creative';
  darkMode: boolean;
  handleModeToggle: () => void;
  handleDarkModeToggle: () => void;
  professionalModeEnabled: boolean;
  creativeModeEnabled: boolean;
  modeSettingsLoaded: boolean;
  isTransitioning: boolean;
  transitionTargetMode: 'professional' | 'creative';
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

// Map routes to page IDs
const getPageIdFromPath = (pathname: string): string | null => {
  if (pathname === '/') return 'home';
  if (pathname === '/projects' || pathname.startsWith('/projects/')) return 'projects';
  if (pathname === '/experience') return 'experience';
  if (pathname === '/academic') return 'academic';
  if (pathname === '/contact') return 'contact';
  if (pathname === '/podcast') return 'podcast';
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
  const [mode, setMode] = useState<'professional' | 'creative'>('professional');
  const [darkMode, setDarkMode] = useState(true);
  const [professionalModeEnabled, setProfessionalModeEnabled] = useState(true);
  const [creativeModeEnabled, setCreativeModeEnabled] = useState(true);
  const [modeSettingsLoaded, setModeSettingsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTargetMode, setTransitionTargetMode] = useState<'professional' | 'creative'>('professional');
  const [professionalVisiblePages, setProfessionalVisiblePages] = useState<string[]>(DEFAULT_PROFESSIONAL_PAGES);
  const [creativeVisiblePages, setCreativeVisiblePages] = useState<string[]>(DEFAULT_CREATIVE_PAGES);

  useEffect(() => {
    // Always set dark mode - light mode is removed
    setDarkMode(true);
    document.documentElement.classList.add('dark');

    // Fetch mode settings from database
    const fetchModeSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('professional_mode_enabled, creative_mode_enabled, default_mode, professional_visible_pages, creative_visible_pages')
          .single();

        if (error) {
          console.log('Using default mode settings');
          setModeSettingsLoaded(true);
          return;
        }

        const proEnabled = data?.professional_mode_enabled ?? true;
        const creEnabled = data?.creative_mode_enabled ?? true;
        const defaultMode = data?.default_mode ?? 'professional';

        setProfessionalModeEnabled(proEnabled);
        setCreativeModeEnabled(creEnabled);
        
        // Set visible pages from database or use defaults
        setProfessionalVisiblePages(data?.professional_visible_pages ?? DEFAULT_PROFESSIONAL_PAGES);
        setCreativeVisiblePages(data?.creative_visible_pages ?? DEFAULT_CREATIVE_PAGES);

        // Check for saved mode preference
        const savedMode = localStorage.getItem('portfolioMode') as 'professional' | 'creative';
        
        // Determine which mode to use
        let targetMode: 'professional' | 'creative';
        
        if (savedMode) {
          // Check if saved mode is still enabled
          if (savedMode === 'professional' && proEnabled) {
            targetMode = 'professional';
          } else if (savedMode === 'creative' && creEnabled) {
            targetMode = 'creative';
          } else {
            // Saved mode is disabled, use default or first available
            targetMode = proEnabled ? 'professional' : 'creative';
          }
        } else {
          // No saved mode, use default if enabled
          if (defaultMode === 'professional' && proEnabled) {
            targetMode = 'professional';
          } else if (defaultMode === 'creative' && creEnabled) {
            targetMode = 'creative';
          } else {
            targetMode = proEnabled ? 'professional' : 'creative';
          }
        }

        setMode(targetMode);
        localStorage.setItem('portfolioMode', targetMode);
        setModeSettingsLoaded(true);
      } catch (error) {
        console.error('Error fetching mode settings:', error);
        setModeSettingsLoaded(true);
      }
    };

    fetchModeSettings();
  }, []);

  useEffect(() => {
    // Apply creative class based on mode
    if (mode === 'creative') {
      document.documentElement.classList.add('creative');
    } else {
      document.documentElement.classList.remove('creative');
    }
  }, [mode]);

  const handleModeToggle = () => {
    // Only toggle if both modes are enabled and not already transitioning
    if (professionalModeEnabled && creativeModeEnabled && !isTransitioning) {
      const newMode = mode === 'professional' ? 'creative' : 'professional';
      const newModePages = newMode === 'professional' ? professionalVisiblePages : creativeVisiblePages;
      
      // Get current page from URL
      const currentPath = window.location.pathname;
      const currentPageId = getPageIdFromPath(currentPath);
      
      // Check if current page exists in new mode
      const pageExistsInNewMode = currentPageId ? newModePages.includes(currentPageId) : true;
      
      setTransitionTargetMode(newMode);
      setIsTransitioning(true);
      
      // Delay the actual mode change to let the sweep start first
      setTimeout(() => {
        setMode(newMode);
        localStorage.setItem('portfolioMode', newMode);
        
        // If page doesn't exist in new mode, redirect to home and show toast
        if (!pageExistsInNewMode && currentPageId) {
          const pageName = getPageNameFromId(currentPageId);
          const modeName = newMode === 'professional' ? 'Professional' : 'Creative';
          
          // Navigate to home
          window.location.href = '/';
          
          // Show toast after a small delay to let the page load
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
    darkMode,
    handleModeToggle,
    handleDarkModeToggle,
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
