import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModeTransitionOverlayProps {
  isTransitioning: boolean;
  targetMode: 'professional' | 'creative';
}

const ModeTransitionOverlay: React.FC<ModeTransitionOverlayProps> = ({ isTransitioning, targetMode }) => {
  // Color based on the mode we're transitioning TO
  const transitionColor = targetMode === 'creative' 
    ? 'hsl(20, 100%, 62%)' // Orange for creative
    : 'hsl(271, 81%, 56%)'; // Purple for professional

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none"
          initial={{ 
            clipPath: 'circle(0% at 0% 100%)',
          }}
          animate={{ 
            clipPath: 'circle(150% at 0% 100%)',
          }}
          exit={{ 
            opacity: 0,
          }}
          transition={{ 
            clipPath: {
              duration: 0.15, // Sweep duration
            },
            opacity: {
              duration: 0.3,
              delay: 0,
              ease: 'easeOut',
            }
          }}
          style={{
            background: transitionColor,
          }}
        />
      )}
    </AnimatePresence>
  );
};

export default ModeTransitionOverlay;
