import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { cn } from '@/lib/utils';

const ExperienceModeBanner = () => {
  const { mode, handleModeToggle, professionalModeEnabled } = usePortfolio();
  const navigate = useNavigate();

  // Only show in creative mode and if professional mode is enabled
  if (mode !== 'creative' || !professionalModeEnabled) {
    return null;
  }

  const handleSwitch = () => {
    handleModeToggle();
    // Small delay to let mode change propagate
    setTimeout(() => {
      navigate('/experience');
    }, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-6 sm:mb-8"
    >
      <button
        onClick={handleSwitch}
        className={cn(
          "group w-full max-w-2xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4",
          "rounded-xl border transition-all duration-300",
          "bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10",
          "border-purple-500/30 hover:border-purple-400/50",
          "hover:from-purple-500/20 hover:via-blue-500/20 hover:to-purple-500/20",
          "hover:shadow-lg hover:shadow-purple-500/10"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-sm sm:text-base font-medium text-foreground">
              Looking for my professional experience?
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Click here to view my software engineering career
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );
};

export default ExperienceModeBanner;
