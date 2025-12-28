import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Briefcase, Palette, ArrowRight } from 'lucide-react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'gg_portfolio_onboarding_seen';

const OnboardingPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { mode, handleModeToggle, professionalModeEnabled, creativeModeEnabled } = usePortfolio();

  // Only show onboarding if BOTH modes are enabled
  const bothModesEnabled = professionalModeEnabled && creativeModeEnabled;

  useEffect(() => {
    // Don't show popup if only one mode is enabled
    if (!bothModesEnabled) return;
    
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [bothModesEnabled]);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
  };

  const handleModeSelect = (selectedMode: 'professional' | 'creative') => {
    if (selectedMode !== mode) {
      handleModeToggle();
    }
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="sm:max-w-md p-0 bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 shadow-2xl rounded-2xl overflow-hidden"
        hideCloseButton
      >
        {/* Subtle gradient overlay for frosty effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent pointer-events-none" />
        
        <div className="relative p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              Hey there! 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              I have two sides to my portfolio — pick one to explore
            </p>
          </div>

          {/* Mode Options */}
          <div className="space-y-3">
            {/* Professional Mode */}
            <button
              onClick={() => handleModeSelect('professional')}
              className={cn(
                "group w-full p-4 rounded-xl text-left transition-all duration-300",
                "bg-white/5 backdrop-blur-sm border border-white/10",
                "hover:bg-[hsl(265,80%,60%)]/10 hover:border-[hsl(265,80%,60%)]/30",
                mode === 'professional' && "bg-[hsl(265,80%,60%)]/15 border-[hsl(265,80%,60%)]/40"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-300",
                  "bg-white/10 border border-white/10",
                  "group-hover:bg-[hsl(265,80%,60%)]/20 group-hover:border-[hsl(265,80%,60%)]/30",
                  mode === 'professional' && "bg-[hsl(265,80%,60%)]/25 border-[hsl(265,80%,60%)]/40"
                )}>
                  <Briefcase className={cn(
                    "h-5 w-5 transition-colors",
                    mode === 'professional' ? "text-[hsl(265,80%,70%)]" : "text-muted-foreground group-hover:text-[hsl(265,80%,70%)]"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Professional</span>
                    {mode === 'professional' && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(265,80%,60%)]/20 text-[hsl(265,80%,70%)] border border-[hsl(265,80%,60%)]/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    My software engineering career & technical skills
                  </p>
                </div>
                <ArrowRight className={cn(
                  "h-4 w-4 text-muted-foreground transition-all duration-300",
                  "group-hover:text-[hsl(265,80%,70%)] group-hover:translate-x-0.5"
                )} />
              </div>
            </button>

            {/* Creative Mode */}
            <button
              onClick={() => handleModeSelect('creative')}
              className={cn(
                "group w-full p-4 rounded-xl text-left transition-all duration-300",
                "bg-white/5 backdrop-blur-sm border border-white/10",
                "hover:bg-[hsl(12,100%,62%)]/10 hover:border-[hsl(12,100%,62%)]/30",
                mode === 'creative' && "bg-[hsl(12,100%,62%)]/15 border-[hsl(12,100%,62%)]/40"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-300",
                  "bg-white/10 border border-white/10",
                  "group-hover:bg-[hsl(12,100%,62%)]/20 group-hover:border-[hsl(12,100%,62%)]/30",
                  mode === 'creative' && "bg-[hsl(12,100%,62%)]/25 border-[hsl(12,100%,62%)]/40"
                )}>
                  <Palette className={cn(
                    "h-5 w-5 transition-colors",
                    mode === 'creative' ? "text-[hsl(12,100%,70%)]" : "text-muted-foreground group-hover:text-[hsl(12,100%,70%)]"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Creative</span>
                    {mode === 'creative' && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(12,100%,62%)]/20 text-[hsl(12,100%,70%)] border border-[hsl(12,100%,62%)]/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    UI/UX design, graphic work & visual projects
                  </p>
                </div>
                <ArrowRight className={cn(
                  "h-4 w-4 text-muted-foreground transition-all duration-300",
                  "group-hover:text-[hsl(12,100%,70%)] group-hover:translate-x-0.5"
                )} />
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-muted-foreground/70 mb-2">
              You can switch anytime from the bottom of the page
            </p>
            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingPopup;
