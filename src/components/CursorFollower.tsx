import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useLocation } from 'react-router-dom';

const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const { mode } = usePortfolio();
  const location = useLocation();
  const hasInitialized = useRef(false);

  // Detect touch device
  useEffect(() => {
    const checkTouchDevice = () => {
      const hasTouch = 'ontouchstart' in window || 
                       navigator.maxTouchPoints > 0 ||
                       window.matchMedia('(pointer: coarse)').matches;
      setIsTouchDevice(hasTouch);
    };
    
    checkTouchDevice();
    
    // Also listen for window resize to recheck (e.g., when connecting/disconnecting external displays)
    window.addEventListener('resize', checkTouchDevice);
    return () => window.removeEventListener('resize', checkTouchDevice);
  }, []);

  // Mode-aware cursor colors - white-purple (pro) and white-orange (creative)
  const cursorBorderColor = mode === 'creative'
    ? 'border-orange-300' // Light orange for creative
    : 'border-purple-200'; // White-purple for professional

  const cursorBgColor = mode === 'creative'
    ? 'bg-orange-400' // Orange for creative
    : 'bg-purple-200'; // White-purple for professional

  // Hide cursor briefly on route change to prevent jump to top-left
  useEffect(() => {
    if (hasInitialized.current) {
      setIsVisible(false);
      // Re-show after a brief delay to allow position to update
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
    hasInitialized.current = true;
  }, [location.pathname]);

  useEffect(() => {
    // Don't add mouse listeners on touch devices
    if (isTouchDevice) return;

    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    // Add event listeners for hoverable elements
    const hoverableElements = document.querySelectorAll('a, button, [data-hover="true"]');
    
    hoverableElements.forEach(el => {
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mouseleave', handleMouseLeave);
    });

    window.addEventListener('mousemove', updateMousePosition);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      hoverableElements.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, [isVisible, isTouchDevice]);

  // Don't render on touch devices or if not visible
  if (isTouchDevice || !isVisible) return null;

  // Creative mode: Triangle/arrow cursor design
  // Professional mode: Circle cursor design
  if (mode === 'creative') {
    return (
      <>
        {/* Creative mode: Diamond/arrow shape cursor */}
        <motion.div
          className="fixed top-0 left-0 pointer-events-none z-[10000]"
          style={{
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            x: mousePosition.x,
            y: mousePosition.y,
            scale: isHovering ? 1.3 : 1,
            rotate: isHovering ? 45 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 28,
            mass: 0.5,
          }}
        >
          {/* Main diamond shape */}
          <div 
            className="w-4 h-4 bg-orange-400 rotate-45"
            style={{
              boxShadow: '0 0 20px rgba(251, 146, 60, 0.6), 0 0 40px rgba(251, 146, 60, 0.3)'
            }}
          />
        </motion.div>
        
        {/* Trailing cursor - Creative: square/diamond ring */}
        <motion.div
          className="fixed top-0 left-0 pointer-events-none z-[9998]"
          style={{
            opacity: 0.6,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            x: mousePosition.x,
            y: mousePosition.y,
            scale: isHovering ? 1.5 : 1,
            rotate: isHovering ? 90 : 45,
          }}
          transition={{
            type: "spring",
            stiffness: 150,
            damping: 15,
            mass: 0.1,
          }}
        >
          <div 
            className="w-8 h-8 border-2 border-orange-300"
            style={{
              boxShadow: '0 0 15px rgba(251, 146, 60, 0.4)'
            }}
          />
        </motion.div>
      </>
    );
  }

  // Professional mode: Circle cursor (original design)
  return (
    <>
      {/* Main cursor dot - no glow */}
      <motion.div
        className={`fixed top-0 left-0 w-3 h-3 ${cursorBgColor} rounded-full pointer-events-none z-[10000]`}
        style={{
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          x: mousePosition.x,
          y: mousePosition.y,
          scale: isHovering ? 1.5 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 28,
          mass: 0.5,
        }}
      />
      
      {/* Trailing cursor ring - no glow */}
      <motion.div
        className={`fixed top-0 left-0 w-8 h-8 border-2 ${cursorBorderColor} rounded-full pointer-events-none z-[9998]`}
        style={{
          opacity: 0.7,
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          x: mousePosition.x,
          y: mousePosition.y,
          scale: isHovering ? 1.5 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 150,
          damping: 15,
          mass: 0.1,
        }}
      />
    </>
  );
};

export default CursorFollower;
