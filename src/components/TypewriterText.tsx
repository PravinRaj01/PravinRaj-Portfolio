import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ 
  texts, 
  speed = 100, 
  deleteSpeed = 50,
  pauseDuration = 1500,
  className = "" 
}) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // Reset when texts change (mode change)
  useEffect(() => {
    if (texts.length === 0) return;
    setCurrentTextIndex(0);
    setCurrentText('');
    setIsDeleting(false);
  }, [texts.join(',')]); // Reset when texts array changes

  useEffect(() => {
    if (texts.length === 0) return;

    const targetText = texts[currentTextIndex];
    
    // Handle pause after typing complete, then start deleting
    if (!isDeleting && currentText === targetText) {
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, pauseDuration);
      return () => clearTimeout(timeout);
    }

    // Handle moving to next text after deletion complete
    if (isDeleting && currentText === '') {
      const nextIndex = (currentTextIndex + 1) % texts.length;
      setCurrentTextIndex(nextIndex);
      setIsDeleting(false);
      return;
    }

    // Type or delete character
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (currentText.length < targetText.length) {
          setCurrentText(targetText.slice(0, currentText.length + 1));
        }
      } else {
        // Deleting
        if (currentText.length > 0) {
          setCurrentText(currentText.slice(0, -1));
        }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentTextIndex, texts, speed, deleteSpeed, pauseDuration]);

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  if (texts.length === 0) return null;

  return (
    <span className={className}>
      {currentText}
      <span className={`inline-block ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        |
      </span>
    </span>
  );
};

export default TypewriterText;