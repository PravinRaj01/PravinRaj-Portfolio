import React, { useState, useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagazineIssue } from '@/types/magazine';

const ONBOARDING_KEY = 'gg_portfolio_onboarding_seen';
const MAGAZINE_POPUP_KEY = 'magazine_popup_shown';

interface MagazinePopupProps {
  issue: MagazineIssue;
  onReadNow: () => void;
}

const MagazinePopup: React.FC<MagazinePopupProps> = ({ issue, onReadNow }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(MAGAZINE_POPUP_KEY)) return;

    const checkAndShow = () => {
      // If onboarding was never seen, wait for it to be dismissed
      const onboardingSeen = localStorage.getItem(ONBOARDING_KEY);
      if (!onboardingSeen) {
        // Poll until onboarding is dismissed
        const interval = setInterval(() => {
          if (localStorage.getItem(ONBOARDING_KEY)) {
            clearInterval(interval);
            setTimeout(() => setVisible(true), 1200);
          }
        }, 500);
        // Timeout after 30s
        setTimeout(() => clearInterval(interval), 30000);
        return () => clearInterval(interval);
      } else {
        // Onboarding already seen, show after short delay
        const timer = setTimeout(() => setVisible(true), 2500);
        return () => clearTimeout(timer);
      }
    };

    const cleanup = checkAndShow();
    return () => { if (cleanup) cleanup(); };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(MAGAZINE_POPUP_KEY, 'true');
    setVisible(false);
  };

  const handleRead = () => {
    sessionStorage.setItem(MAGAZINE_POPUP_KEY, 'true');
    setVisible(false);
    onReadNow();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 right-6 z-[200] w-[320px] rounded-2xl overflow-hidden shadow-2xl border border-white/15"
          style={{ background: 'linear-gradient(135deg, rgba(26,26,26,0.95), rgba(40,32,28,0.95))' }}
        >
          {/* Close */}
          <button onClick={handleDismiss} className="absolute top-3 right-3 z-10 text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>

          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-[#c4a882]" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#c4a882] font-sans">New Issue</span>
            </div>

            <h3 className="text-white font-serif text-lg font-bold leading-snug mb-1">
              {issue.content.cover.headline}
            </h3>
            <p className="text-white/50 font-serif text-xs italic mb-4">
              {issue.content.cover.subhead}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRead}
                className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all border border-white/10 hover:border-white/20 font-serif"
              >
                Read Now
              </button>
              <button
                onClick={handleDismiss}
                className="py-2.5 px-4 text-white/40 hover:text-white/70 text-xs transition-colors font-sans"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MagazinePopup;
