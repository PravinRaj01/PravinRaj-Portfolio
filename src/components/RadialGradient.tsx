import React, { useEffect, useState } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";

interface RadialGradientProps {
  scale?: string;
  opacity?: string;
  position?: string;
  overflow?: string;
}

const RadialGradient: React.FC<RadialGradientProps> = ({
  scale = "scale-y-100",
  opacity = "opacity-30",
  position = "top-0",
  overflow,
}) => {
  const [mouseXpercentage, setMouseXPercentage] = useState<number>(50);
  const [mouseYpercentage, setMouseYPercentage] = useState<number>(50);
  const { mode, darkMode, isTransitioning } = usePortfolio();

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const newMouseXPercentage = Math.round((event.pageX / windowWidth) * 100);
      const newMouseYPercentage = Math.round(
        (event.pageY / windowHeight) * 100
      );

      setMouseXPercentage(newMouseXPercentage);
      setMouseYPercentage(newMouseYPercentage);
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Mode-aware colors - orange tint for creative (like purple is majority in pro)
  const primaryColor = mode === 'creative' 
    ? '#ff6a3d' // Orange for creative
    : '#9333ea'; // Purple for professional
  
  const secondaryColor = darkMode 
    ? '#0c1220' // Dark background
    : mode === 'creative' 
      ? '#ff8c5a' // Light orange tint for creative (similar to how purple is majority in pro)
      : '#e9d5ff'; // Light purple for professional

  const radialGradientStyle: React.CSSProperties = {
    background: `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${primaryColor}, ${secondaryColor})`,
    transition: isTransitioning ? 'background 1.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'background 0.3s ease',
  };

  return (
    <div
      className={`radial-gradient-styling absolute ${position} left-0 h-full w-full z-0 pointer-events-none ${opacity} ${scale} ${overflow}`}
      style={radialGradientStyle}
    />
  );
};

export default RadialGradient;

