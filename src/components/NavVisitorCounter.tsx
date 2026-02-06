import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Users, TrendingUp } from 'lucide-react';
import { useVisitorCounter } from '@/hooks/useVisitorCounter';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { usePortfolio } from '@/contexts/PortfolioContext';

const NavVisitorCounter = () => {
  const [showCount, setShowCount] = useState(false);
  const [displayTotal, setDisplayTotal] = useState(0);
  const [displayToday, setDisplayToday] = useState(0);
  const { totalCount, todayCount, isLoading } = useVisitorCounter();
  const { data: siteSettings } = useSiteSettings();
  const { mode } = usePortfolio();

  const showTotal = siteSettings?.show_total_visitors ?? true;
  const showDaily = siteSettings?.show_daily_visitors ?? true;

  // Animate counting up when popup opens
  useEffect(() => {
    if (showCount && totalCount > 0) {
      setDisplayTotal(0);
      setDisplayToday(0);
      const duration = 800;
      const steps = 25;
      const totalIncrement = totalCount / steps;
      const todayIncrement = todayCount / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current++;
        if (current >= steps) {
          setDisplayTotal(totalCount);
          setDisplayToday(todayCount);
          clearInterval(timer);
        } else {
          setDisplayTotal(Math.floor(totalIncrement * current));
          setDisplayToday(Math.floor(todayIncrement * current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [showCount, totalCount, todayCount]);

  // Don't render if feature is disabled
  if (!siteSettings?.visitor_counter_enabled) {
    return null;
  }

  // If both sub-toggles are off, don't show anything
  if (!showTotal && !showDaily) {
    return null;
  }

  const glowColor = mode === 'creative' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(59, 130, 246, 0.3)';

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowCount(!showCount)}
        className={`p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors relative ${
          showCount 
            ? mode === 'creative' 
              ? 'text-orange-500 bg-orange-500/10' 
              : 'text-blue-500 bg-blue-500/10'
            : 'hover:bg-muted'
        }`}
        aria-label="Show visitor count"
        whileTap={{ scale: 0.9 }}
      >
        <Eye className="w-5 h-5" />
        {showCount && (
          <motion.span
            className={`absolute inset-0 rounded-full ${
              mode === 'creative' ? 'bg-orange-500/20' : 'bg-blue-500/20'
            }`}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {showCount && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="absolute top-full right-0 mt-2 z-50"
          >
            <div 
              className="relative min-w-[180px] sm:min-w-[200px] p-3 sm:p-4 rounded-xl bg-popover/95 backdrop-blur-xl border border-border shadow-xl"
              style={{
                boxShadow: `0 4px 24px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.05)`
              }}
            >
              {/* Decorative gradient line */}
              <div 
                className={`absolute top-0 left-3 right-3 sm:left-4 sm:right-4 h-0.5 rounded-full ${
                  mode === 'creative' 
                    ? 'bg-gradient-to-r from-transparent via-orange-500 to-transparent' 
                    : 'bg-gradient-to-r from-transparent via-blue-500 to-transparent'
                }`}
              />
              
              <div className="space-y-3">
                {/* Total Visitors */}
                {showTotal && (
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${
                      mode === 'creative' ? 'bg-orange-500/10' : 'bg-blue-500/10'
                    }`}>
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ 
                        color: mode === 'creative' ? '#f97316' : '#3b82f6' 
                      }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                        Total Visitors
                      </span>
                      {isLoading ? (
                        <span className="text-base sm:text-lg font-bold animate-pulse">...</span>
                      ) : (
                        <motion.span 
                          className="block text-lg sm:text-xl font-bold tabular-nums"
                          style={{ color: mode === 'creative' ? '#f97316' : '#3b82f6' }}
                        >
                          {displayTotal.toLocaleString()}
                        </motion.span>
                      )}
                    </div>
                  </div>
                )}

                {/* Divider - only show if both visible */}
                {showTotal && showDaily && <div className="h-px bg-border/50" />}

                {/* Today's Visitors */}
                {showDaily && (
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${
                      mode === 'creative' ? 'bg-orange-500/5' : 'bg-blue-500/5'
                    }`}>
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                        Today
                      </span>
                      {isLoading ? (
                        <span className="text-sm sm:text-base font-semibold animate-pulse">...</span>
                      ) : (
                        <motion.span 
                          className="block text-base sm:text-lg font-semibold tabular-nums text-foreground"
                        >
                          {displayToday.toLocaleString()}
                        </motion.span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NavVisitorCounter;
