import { useState, useEffect, useCallback } from 'react';

const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
];

export const useKonamiCode = () => {
  const [inputSequence, setInputSequence] = useState<string[]>([]);
  const [isActivated, setIsActivated] = useState(false);

  const resetSequence = useCallback(() => {
    setInputSequence([]);
  }, []);

  const acknowledgeActivation = useCallback(() => {
    setIsActivated(false);
    resetSequence();
  }, [resetSequence]);

  // Minimum consecutive correct inputs before showing progress
  const MIN_PROGRESS_THRESHOLD = 3;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = event.code;
      
      setInputSequence(prev => {
        const newSequence = [...prev, key].slice(-KONAMI_CODE.length);
        
        // Check if the sequence matches
        if (newSequence.length === KONAMI_CODE.length) {
          const isMatch = newSequence.every((k, i) => k === KONAMI_CODE[i]);
          if (isMatch) {
            setIsActivated(true);
            return [];
          }
        }
        
        // Reset if wrong key for current position
        const currentPosition = newSequence.length - 1;
        if (newSequence[currentPosition] !== KONAMI_CODE[currentPosition]) {
          // Check if it could be the start of a new sequence
          if (key === KONAMI_CODE[0]) {
            return [key];
          }
          return [];
        }
        
        return newSequence;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-reset sequence after 3 seconds of inactivity
  useEffect(() => {
    if (inputSequence.length > 0) {
      const timeout = setTimeout(resetSequence, 3000);
      return () => clearTimeout(timeout);
    }
  }, [inputSequence, resetSequence]);

  return {
    isActivated,
    acknowledgeActivation,
    // Only show progress after MIN_PROGRESS_THRESHOLD consecutive correct inputs
    progress: inputSequence.length >= MIN_PROGRESS_THRESHOLD 
      ? inputSequence.length / KONAMI_CODE.length 
      : 0,
  };
};
