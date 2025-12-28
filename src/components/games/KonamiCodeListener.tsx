import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKonamiCode } from '@/hooks/useKonamiCode';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KonamiCodeListener: React.FC = () => {
  const { isActivated, acknowledgeActivation, progress } = useKonamiCode();
  const navigate = useNavigate();

  const handleEnterArcade = () => {
    acknowledgeActivation();
    navigate('/playground');
  };

  const handleClose = () => {
    acknowledgeActivation();
  };

  return (
    <>
      {/* Progress indicator (subtle) */}
      <AnimatePresence>
        {progress > 0 && progress < 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-4 right-4 z-[9999] bg-background/80 backdrop-blur-sm border border-primary/30 rounded-full p-2"
          >
            <div className="flex items-center gap-2 px-2">
              <Gamepad2 className="w-4 h-4 text-primary animate-pulse" />
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success popup */}
      <AnimatePresence>
        {isActivated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateX: -15 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotateX: 15 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative bg-gradient-to-br from-primary/20 via-background to-accent/20 border-2 border-primary/50 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Animated icon */}
              <motion.div
                animate={{ 
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
                className="inline-block mb-4"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Gamepad2 className="w-10 h-10 text-primary-foreground" />
                </div>
              </motion.div>

              {/* Text */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                🎮 Secret Unlocked!
              </motion.h2>
              
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground mb-6"
              >
                You've discovered the hidden arcade! Ready to play?
              </motion.p>

              {/* Buttons */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex gap-3 justify-center"
              >
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="px-6"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={handleEnterArcade}
                  className="px-6 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  Enter Arcade
                </Button>
              </motion.div>

              {/* Decorative elements */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default KonamiCodeListener;
