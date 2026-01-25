import React from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";

interface SplashScreenProps {
  load: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ load }) => {
  const { mode } = usePortfolio();
  
  // Theme colors: purple for professional, orange for creative
  const circleColor = mode === 'creative' 
    ? 'rgba(255, 106, 61, 0.8)' // creative-orange
    : 'rgba(199, 112, 240, 0.8)'; // purple
  
  const bgColor = mode === 'creative'
    ? '#0c0513' // dark background
    : '#0c0513'; // same dark background

  return (
    <div 
      id={load ? "preloader" : "preloader-none"}
      style={{ backgroundColor: bgColor }}
      className="transition-opacity duration-500"
    >
      {load && (
        <div className="preloader-circles">
          <div className="preloader-circle" style={{ borderColor: circleColor, animationDelay: '0s' }}></div>
          <div className="preloader-circle" style={{ borderColor: circleColor, animationDelay: '0.2s' }}></div>
          <div className="preloader-circle" style={{ borderColor: circleColor, animationDelay: '0.4s' }}></div>
        </div>
      )}
    </div>
  );
};

export default SplashScreen;

