import { motion, useScroll, useSpring } from 'framer-motion';
import { usePortfolio } from '@/contexts/PortfolioContext';

interface ScrollProgressProps {
  position?: 'left' | 'center' | 'right';
  height?: number;
  smoothness?: boolean;
}

const ScrollProgress = ({
  position = 'left',
  height = 4,
  smoothness = true,
}: ScrollProgressProps) => {
  const { mode } = usePortfolio();
  const { scrollYProgress } = useScroll();

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Determine origin based on position
  let originX = '0%';
  if (position === 'center') {
    originX = '50%';
  } else if (position === 'right') {
    originX = '100%';
  }

  const barAnimation = smoothness ? { scaleX } : { scaleX: scrollYProgress };

  // Use mode-appropriate color - light purple for pro mode, orange for creative
  const bgColor = mode === 'creative' 
    ? 'hsl(12, 100%, 62%)' // orange
    : 'hsl(280, 70%, 80%)'; // light purple like cursor follower

  return (
    <motion.div
      className="fixed top-16 left-0 right-0 z-[45]"
      style={{
        ...barAnimation,
        height,
        backgroundColor: bgColor,
        originX,
        transformOrigin: `${originX} center`,
      }}
    />
  );
};

export default ScrollProgress;
