import { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
} from "framer-motion";
import { wrap } from "@motionone/utils";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useGithubTicker } from "@/hooks/useGithubTicker";

interface ParallaxProps {
  children: React.ReactNode;
  baseVelocity: number;
}

function ParallaxText({ children, baseVelocity = 100 }: ParallaxProps) {
  const [isMobile, setIsMobile] = useState(false);
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
    clamp: false,
  });

  const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);
  const directionFactor = useRef<number>(1);

  useAnimationFrame((t, delta) => {
    let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

    if (velocityFactor.get() < 0) {
      directionFactor.current = -1;
    } else if (velocityFactor.get() > 0) {
      directionFactor.current = 1;
    }

    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.set(baseX.get() + moveBy);
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="overflow-hidden whitespace-nowrap flex flex-nowrap m-0">
      <motion.div
        className="font-semibold text-base sm:text-lg md:text-xl lg:text-2xl xl:text-4xl flex whitespace-nowrap flex-nowrap uppercase tracking-wide"
        style={{ x }}
      >
        {isMobile ? (
          <>
            <span className="block mr-8 md:mr-12">{children}</span>
            <span className="block mr-8 md:mr-12">{children}</span>
            <span className="block mr-8 md:mr-12">{children}</span>
            <span className="block mr-8 md:mr-12">{children}</span>
          </>
        ) : (
          <>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
            <span className="block mr-12">{children}</span>
          </>
        )}
      </motion.div>
    </div>
  );
}

const GithubTicker = () => {
  const { mode } = usePortfolio();
  const { data: tickerData } = useGithubTicker();
  
  const tickerText = tickerData?.text || 'More Projects on Github';
  const tickerUrl = tickerData?.url || 'https://github.com';

  // Purple-ish background in professional, orange-ish in creative
  const bgColor = mode === 'creative' 
    ? 'bg-gradient-to-r from-orange-500 to-orange-600' 
    : 'bg-gradient-to-r from-purple-600 to-indigo-600';
  const textColor = 'text-white';

  return (
    <div className={`${bgColor} py-3 md:py-4 -rotate-3 flex justify-center items-center scale-[1.15] relative z-10 w-full overflow-hidden`}>
      <ParallaxText baseVelocity={-2}>
        <a
          href={tickerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <span className={textColor}>&lt;</span>
          <span className={`${textColor} font-medium`}>{tickerText}</span>
          <span className={textColor}>/&gt;</span>
        </a>
      </ParallaxText>
    </div>
  );
};

export default GithubTicker;
