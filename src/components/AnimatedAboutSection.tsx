
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedAboutSectionProps {
  mode: 'professional' | 'creative';
}

const AnimatedAboutSection = ({ mode }: AnimatedAboutSectionProps) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const text = "I am a passionate full-stack developer with expertise in modern web technologies. My journey in software development has led me to work on diverse projects ranging from e-commerce platforms to data visualization tools. I believe in writing clean, efficient code and creating user experiences that make a difference.";

  const words = text.split(' ');

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate how much of the section is visible
      const visibleTop = Math.max(0, -rect.top);
      const visibleBottom = Math.min(rect.height, windowHeight - rect.top);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const progress = Math.min(1, visibleHeight / (rect.height * 0.8));
      
      setScrollProgress(progress);
      
      // Calculate which word should be highlighted based on scroll progress
      const totalWords = words.length;
      const wordIndex = Math.floor(progress * totalWords);
      setHighlightedWordIndex(Math.min(wordIndex, totalWords - 1));
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [words.length]);

  const getWordOpacity = (index: number) => {
    if (index <= highlightedWordIndex) {
      return 1;
    }
    return 0.3;
  };

  const getWordColor = (index: number) => {
    if (index === highlightedWordIndex) {
      return 'text-white bg-primary px-2 py-1 rounded-lg shadow-lg transform scale-105';
    }
    if (index < highlightedWordIndex) {
      return 'text-foreground';
    }
    return 'text-muted-foreground';
  };

  return (
    <section 
      ref={sectionRef}
      id="about-section"
      className="py-12 px-4 min-h-[80vh] flex items-center"
    >
      <div className="container mx-auto text-center">
        <motion.h2 
          className="text-3xl md:text-4xl font-bold mb-8 text-foreground"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: scrollProgress > 0 ? 1 : 0, y: scrollProgress > 0 ? 0 : 30 }}
          transition={{ duration: 0.8 }}
        >
          About Me
        </motion.h2>
        
        <div className="max-w-4xl mx-auto">
          <div className="text-2xl md:text-3xl leading-relaxed font-medium">
            {words.map((word, index) => (
              <span
                key={index}
                className={`inline-block mr-3 mb-2 transition-all duration-700 ${getWordColor(index)}`}
                style={{ 
                  opacity: getWordOpacity(index),
                  transform: index <= highlightedWordIndex ? 'translateY(0)' : 'translateY(10px)'
                }}
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnimatedAboutSection;
