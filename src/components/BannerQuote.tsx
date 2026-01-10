import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useMotionValue } from "framer-motion";
import { usePortfolio } from "@/contexts/PortfolioContext";

interface BannerQuoteProps {
  style: "withBG" | "noBG";
  content: string;
  sectionTitle?: string;
}

// Component for animated text that reveals character by character on scroll + idle auto-animation
const AnimatedQuoteText: React.FC<{ text: string; className?: string; style?: React.CSSProperties }> = ({ text, className, style }) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollProgressRef = useRef(0);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end center"],
  });

  // Track scroll progress changes
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (value) => {
      lastScrollProgressRef.current = value;
      setAutoProgress(value); // Sync auto progress with scroll
      setIsScrolling(true);
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set scrolling to false after 150ms of no scroll
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    });
    
    return () => {
      unsubscribe();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollYProgress]);

  // Detect if element is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting && entry.intersectionRatio > 0.3);
      },
      { threshold: [0, 0.3, 0.5, 1] }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  // Auto-animation when in view and not scrolling
  useEffect(() => {
    if (isInView && !isScrolling && autoProgress < 1) {
      // Start auto-animation
      autoAnimationRef.current = setInterval(() => {
        setAutoProgress((prev) => {
          const next = prev + 0.002; // Very slow auto-animation speed
          if (next >= 1) {
            if (autoAnimationRef.current) {
              clearInterval(autoAnimationRef.current);
            }
            return 1;
          }
          return next;
        });
      }, 80);
    } else {
      // Stop auto-animation
      if (autoAnimationRef.current) {
        clearInterval(autoAnimationRef.current);
      }
    }
    
    return () => {
      if (autoAnimationRef.current) {
        clearInterval(autoAnimationRef.current);
      }
    };
  }, [isInView, isScrolling, autoProgress]);

  // Split text into words
  const words = text.split(" ");
  const totalChars = text.replace(/ /g, "").length;

  return (
    <h2 ref={containerRef} className={className} style={{ color: 'inherit', margin: '0 auto', ...style }}>
      {words.map((word, wordIndex) => (
        <React.Fragment key={wordIndex}>
          <span className="inline-block whitespace-nowrap">
            {word.split("").map((char, charIndex) => {
              // Calculate the progress threshold for this character
              const charsBefore = words.slice(0, wordIndex).join("").length + charIndex;
              const start = charsBefore / totalChars;
              const end = (charsBefore + 1) / totalChars;
              
              return (
                <AnimatedChar 
                  key={charIndex} 
                  char={char} 
                  scrollProgress={scrollYProgress}
                  autoProgress={autoProgress}
                  isScrolling={isScrolling}
                  start={start}
                  end={end}
                />
              );
            })}
          </span>
          {wordIndex < words.length - 1 && <span className="inline"> </span>}
        </React.Fragment>
      ))}
    </h2>
  );
};

// Individual animated character
const AnimatedChar: React.FC<{
  char: string;
  scrollProgress: any;
  autoProgress: number;
  isScrolling: boolean;
  start: number;
  end: number;
}> = ({ char, scrollProgress, autoProgress, isScrolling, start, end }) => {
  const scrollOpacity = useTransform(
    scrollProgress,
    [start, end],
    [0.15, 1]
  );
  
  // Calculate opacity based on auto progress when not scrolling
  const getAutoOpacity = () => {
    if (autoProgress >= end) return 1;
    if (autoProgress <= start) return 0.15;
    const progress = (autoProgress - start) / (end - start);
    return 0.15 + (0.85 * progress);
  };

  const [displayOpacity, setDisplayOpacity] = useState(0.15);
  
  useEffect(() => {
    if (isScrolling) {
      // Use scroll-based opacity
      const unsubscribe = scrollOpacity.on("change", (value) => {
        setDisplayOpacity(value);
      });
      return () => unsubscribe();
    } else {
      // Use auto-progress opacity
      setDisplayOpacity(getAutoOpacity());
    }
  }, [isScrolling, autoProgress, scrollOpacity]);

  return (
    <motion.span 
      style={{ opacity: displayOpacity }}
      className="inline-block transition-opacity duration-100"
    >
      {char}
    </motion.span>
  );
};

const BannerQuote: React.FC<BannerQuoteProps> = ({
  style,
  content,
  sectionTitle = "About Me",
}) => {
  const { mode } = usePortfolio();

  // Get background color based on mode
  const bgColor = mode === 'creative' 
    ? 'bg-[hsl(var(--creative-darkblue))]' 
    : 'bg-secondary';

  const accentColor = mode === 'creative'
    ? 'text-[hsl(var(--creative-orange))]'
    : 'text-primary';

  return style === "withBG" ? (
    <React.Fragment>
      <section className="quote-banner relative overflow-x-clip overflow-y-visible z-10" id="about-me">
        <div
          className={`quote-outer-container ${bgColor} min-h-[40vh] md:h-[50vh] -rotate-3 flex justify-center items-center scale-110 py-8 md:py-0 min-[1921px]:px-96 relative overflow-hidden mt-0`}
        >
          {/* Blurred background image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1920&q=80")`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              filter: "blur(8px)",
              transform: "scale(1.1)",
            }}
          />
          {/* Color tint overlay - purple for professional, orange for creative */}
          <div
            className="absolute inset-0 z-[1]"
            style={{
              backgroundColor: mode === 'creative' 
                ? 'rgba(255, 106, 61, 0.3)' // Orange tint for creative mode
                : 'rgba(139, 92, 246, 0.3)', // Purple tint for professional mode
            }}
          />
          {/* Content overlay */}
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <div className="quote-container rotate-3 flex items-center flex-col justify-center px-6 py-12 md:p-20 lg:p-56 w-full">
              <AnimatedQuoteText 
                text={content}
                className="text-white text-center text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl max-w-5xl mx-auto leading-tight mb-8 md:mb-20 mt-8 md:mt-20"
                style={{ 
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                  fontFamily: '"Poppins", sans-serif',
                  fontWeight: 700,
                  width: '100%',
                  display: 'block'
                }}
              />
              <p className="text-gray-300 mt-4 text-center" style={{ fontFamily: '"Poppins", sans-serif' }}>{sectionTitle}</p>
            </div>
          </div>
        </div>
      </section>
    </React.Fragment>
  ) : (
    <React.Fragment>
      <section className="quote-banner relative overflow-x-clip">
        <div className="min-h-[40vh] -rotate-3 flex justify-center items-center scale-110 py-12">
          <div className="statement-container rotate-3 flex items-center flex-col justify-center px-8 md:px-16 lg:px-32 py-12 max-lg:px-6 max-lg:py-8 max-w-6xl mx-auto">
            <AnimatedQuoteText 
              text={content}
              className="text-foreground text-center text-2xl md:text-3xl lg:text-4xl font-bold leading-snug"
            />
          </div>
        </div>
      </section>
    </React.Fragment>
  );
};

export default BannerQuote;
