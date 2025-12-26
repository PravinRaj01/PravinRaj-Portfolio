import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, Sun, Moon, Github, Linkedin, Twitter, Settings, Palette, Download, Globe, Instagram, Youtube, Facebook, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useEnabledSocials } from '@/hooks/useSocials';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [modeExpanded, setModeExpanded] = useState(false);
  const location = useLocation();
  const { mode, darkMode, handleModeToggle, handleDarkModeToggle, professionalModeEnabled, creativeModeEnabled } = usePortfolio();
  const { data: siteSettings, isLoading: siteSettingsLoading, refetch: refetchSettings } = useSiteSettings();
  const { data: socialLinks, isLoading: socialsLoading } = useEnabledSocials();
  
  // Get current page from path
  const currentPage = location.pathname === '/' ? 'home' : location.pathname.replace('/', '');
  
  // Only show mode toggle if both modes are enabled AND current page allows it
  const modeTogglePages = siteSettings?.mode_toggle_pages ?? ['home', 'projects', 'experience', 'academic', 'contact', 'podcast'];
  const showModeToggle = professionalModeEnabled && creativeModeEnabled && modeTogglePages.includes(currentPage);

  // Debug logging for resume URL changes
  useEffect(() => {
    console.log('Navigation - Site settings changed:', {
      isLoading: siteSettingsLoading,
      resumeUrl: siteSettings?.resume_url,
      hasResumeUrl: !!siteSettings?.resume_url
    });
  }, [siteSettings, siteSettingsLoading]);

  // Get visible pages for current mode
  const professionalVisiblePages = siteSettings?.professional_visible_pages ?? ['home', 'academic', 'experience', 'projects', 'contact'];
  const creativeVisiblePages = siteSettings?.creative_visible_pages ?? ['home', 'experience', 'projects', 'podcast', 'contact'];

  const allProfessionalNavItems = [
    { name: 'Home', path: '/', id: 'home' },
    { name: 'Academic', path: '/academic', id: 'academic' },
    { name: 'Experience', path: '/experience', id: 'experience' },
    { name: 'Projects', path: '/projects', id: 'projects' },
    { name: 'Contact', path: '/contact', id: 'contact' },
  ];

  const allCreativeNavItems = [
    { name: 'Home', path: '/', id: 'home' },
    { name: 'Experience', path: '/experience', id: 'experience' },
    { name: 'Projects', path: '/projects', id: 'projects' },
    { name: 'Podcast', path: '/podcast', id: 'podcast' },
    { name: 'Contact', path: '/contact', id: 'contact' },
  ];

  // Filter nav items based on visibility settings
  const professionalNavItems = allProfessionalNavItems.filter(item => professionalVisiblePages.includes(item.id));
  const creativeNavItems = allCreativeNavItems.filter(item => creativeVisiblePages.includes(item.id));

  const navItems = mode === 'professional' ? professionalNavItems : creativeNavItems;

  const handleResumeClick = () => {
    console.log('Resume button clicked, URL:', siteSettings?.resume_url);
    if (siteSettings?.resume_url) {
      // Convert Google Drive view link to download link if needed
      let downloadUrl = siteSettings.resume_url;
      if (downloadUrl.includes('drive.google.com/file/d/') && downloadUrl.includes('/view')) {
        // Convert Google Drive view link to direct download link
        const fileId = downloadUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (fileId) {
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'resume.pdf'; // Suggest filename for download
      link.target = '_blank'; // Fallback: open in new tab if download fails
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Check if resume is available and not loading
  const isResumeAvailable = !siteSettingsLoading && !!siteSettings?.resume_url;
  
  console.log('Navigation - Resume availability:', {
    isLoading: siteSettingsLoading,
    hasUrl: !!siteSettings?.resume_url,
    isAvailable: isResumeAvailable
  });

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      github: Github,
      linkedin: Linkedin,
      twitter: Twitter,
      instagram: Instagram,
      youtube: Youtube,
      facebook: Facebook,
      globe: Globe,
    };
    return iconMap[iconName] || Globe;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-3"
            >
              {(() => {
                const logoUrl = mode === 'professional' 
                  ? (siteSettings?.professional_logo_url || siteSettings?.logo_url)
                  : (siteSettings?.creative_logo_url || siteSettings?.logo_url);
                return logoUrl ? <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" /> : null;
              })()}
              <span className={`text-2xl font-bold bg-gradient-to-r ${
                mode === 'creative' 
                  ? 'from-orange-500 to-orange-600' 
                  : 'from-blue-600 to-purple-600'
              } bg-clip-text text-transparent`}>
                {mode === 'professional' 
                  ? (siteSettings?.professional_site_name || siteSettings?.site_name || 'Portfolio')
                  : (siteSettings?.creative_site_name || siteSettings?.site_name || 'Portfolio')}
              </span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`text-sm font-medium transition-colors hover:text-primary relative ${
                    location.pathname === item.path
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.name}
                  {location.pathname === item.path && (
                    <motion.div
                      layoutId="navbar-underline"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </Link>
              ))}

              {/* Resume Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="border-2 hover:bg-primary hover:text-primary-foreground"
                onClick={handleResumeClick}
                disabled={!isResumeAvailable}
              >
                <Download className="w-4 h-4 mr-2" />
                Resume
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-background border-t border-border"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'text-primary bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.name}
                </Link>
              ))}

              <div className="px-3 py-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-2"
                  onClick={handleResumeClick}
                  disabled={!isResumeAvailable}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Mode Toggle - Bottom Left (below share button) - only show if both modes enabled */}
      {showModeToggle && (
        <div className="fixed left-4 md:left-6 lg:left-8 bottom-5 z-50 max-lg:hidden">
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setModeExpanded(!modeExpanded)}
              className={`w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 shadow-2xl flex items-center justify-center hover:scale-[1.15] active:scale-105 transition-all ${
                modeExpanded 
                  ? (mode === 'creative' ? 'bg-orange-500/30 border-orange-400/50' : 'bg-blue-500/30 border-blue-400/50')
                  : (mode === 'creative' 
                      ? 'hover:bg-orange-500/20 hover:border-orange-400/50' 
                      : 'hover:bg-blue-500/20 hover:border-blue-400/50')
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {modeExpanded ? <X size={22} /> : <Palette size={22} />}
            </motion.button>

            {modeExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className="flex items-center gap-1 bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 rounded-full p-1.5 shadow-2xl"
              >
                <button
                  onClick={() => {
                    if (mode !== 'professional') {
                      handleModeToggle();
                    }
                    setModeExpanded(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mode === 'professional'
                      ? 'bg-white/20 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pro
                </button>
                <button
                  onClick={() => {
                    if (mode !== 'creative') {
                      handleModeToggle();
                    }
                    setModeExpanded(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mode === 'creative'
                      ? 'bg-white/20 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Creative
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Mode Toggle - only show if both modes enabled */}
      {showModeToggle && (
        <div className="fixed bottom-5 left-4 z-40 lg:hidden">
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setModeExpanded(!modeExpanded)}
              className={`w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 shadow-2xl flex items-center justify-center hover:scale-[1.15] active:scale-105 transition-all ${
                modeExpanded 
                  ? (mode === 'creative' ? 'bg-orange-500/30 border-orange-400/50' : 'bg-blue-500/30 border-blue-400/50')
                  : (mode === 'creative' 
                      ? 'hover:bg-orange-500/20 hover:border-orange-400/50' 
                      : 'hover:bg-blue-500/20 hover:border-blue-400/50')
              }`}
              whileTap={{ scale: 0.9 }}
            >
              {modeExpanded ? <X size={16} /> : <Palette size={16} />}
            </motion.button>

            {modeExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className="flex items-center gap-1 bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 rounded-full p-1 shadow-2xl"
              >
                <button
                  onClick={() => {
                    if (mode !== 'professional') {
                      handleModeToggle();
                    }
                    setModeExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    mode === 'professional'
                      ? 'bg-white/20 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pro
                </button>
                <button
                  onClick={() => {
                    if (mode !== 'creative') {
                      handleModeToggle();
                    }
                    setModeExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    mode === 'creative'
                      ? 'bg-white/20 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Creative
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
