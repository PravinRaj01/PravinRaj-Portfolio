import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion, animate } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePortfolio } from '@/contexts/PortfolioContext';

interface HangingCardProps {
  name: string;
  title: string;
  photoUrl?: string;
  birthDate?: string | null;
  funFacts?: string[] | null;
  mode: 'professional' | 'creative';
}

// Parsed as local date parts (not `new Date(str)`) so a "YYYY-MM-DD" birth
// date can't shift a day depending on the visitor's timezone.
function getAge(birthDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const hadBirthdayThisYear =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const ACCENTS = {
  professional: {
    label: 'PROFESSIONAL · ID',
    border: 'border-purple-500/30',
    frameBorder: 'border-purple-500',
    frameGlow: 'shadow-purple-500/20',
    text: 'text-purple-400',
    textSoft: 'text-purple-300',
    hint: 'text-purple-400/70',
    footerTag: 'text-purple-400/50',
    backBorder: 'border-purple-400/40',
    backTint: 'from-purple-950/40 via-zinc-950 to-black',
    strapFrom: 'from-purple-900',
    dot: 'bg-purple-500',
  },
  creative: {
    label: 'CREATIVE · ID',
    border: 'border-[#ff6a3d]/30',
    frameBorder: 'border-[#ff6a3d]',
    frameGlow: 'shadow-[#ff6a3d]/20',
    text: 'text-[#ff6a3d]',
    textSoft: 'text-[#ff8a5f]',
    hint: 'text-[#ff6a3d]/70',
    footerTag: 'text-[#ff6a3d]/50',
    backBorder: 'border-[#ff8a5f]/40',
    backTint: 'from-[#ff6a3d]/20 via-zinc-950 to-black',
    strapFrom: 'from-[#a8431f]',
    dot: 'bg-[#ff6a3d]',
  },
} as const;

const HangingCard = ({ name, title, photoUrl, birthDate, funFacts, mode }: HangingCardProps) => {
  const [flipped, setFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastTapRef = useRef(0);
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const { isTransitioning } = usePortfolio();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const cardRotate = useTransform(x, [-140, 140], [12, -12]);

  // Momentum swing on mode switch -- not a canned keyframe wiggle, a real
  // damped spring kicked with an initial angular velocity, like the card got
  // physically knocked. `impulseRotate` swings the whole pendulum (cord +
  // clip + card together); `lagged` trails it on a softer spring, and the
  // gap between the two gives the card a slight hinge-lag at the clip, the
  // way a badge whips a beat behind the lanyard it's clipped to.
  const impulseRotate = useMotionValue(0);
  const lagged = useSpring(impulseRotate, { stiffness: 120, damping: 8 });
  const combinedCardRotate = useTransform(
    [cardRotate, impulseRotate, lagged],
    ([drag, imp, lag]: number[]) => drag + (lag - imp) * 0.6
  );

  // Fires on the falling edge of isTransitioning -- the moment
  // ModeTransitionOverlay starts fading, not when the sweep begins (that's
  // covered by the overlay itself, and the card remounts mid-sweep anyway).
  // A fresh `wasTransitioningRef` on the remounted instance means it can
  // only fire once isTransitioning has been observed true and then goes
  // false, so a plain mount mid-transition can't trigger it early.
  const wasTransitioningRef = useRef(false);
  useEffect(() => {
    const wasTransitioning = wasTransitioningRef.current;
    wasTransitioningRef.current = isTransitioning;
    if (wasTransitioning && !isTransitioning && !prefersReducedMotion) {
      // Kicks the bottom of the card rightward (away from the bottom-left
      // corner the color sweep originates from), then lets the spring decay.
      const controls = animate(impulseRotate, 0, {
        type: 'spring',
        velocity: -90,
        stiffness: 60,
        damping: 4,
        mass: 1,
        restDelta: 0.01,
      });
      return () => controls.stop();
    }
  }, [isTransitioning, prefersReducedMotion, impulseRotate]);

  const accent = ACCENTS[mode];
  const age = birthDate ? getAge(birthDate) : null;
  const facts = (funFacts ?? []).filter(Boolean);
  const canFlip = facts.length > 0;

  // Mobile drags on the x axis only: framer sets touch-action: pan-y for an
  // x-only drag, so a vertical swipe that starts on the card still scrolls
  // the page instead of being captured as a drag gesture.
  // Memoized so the object identity is stable across re-renders -- an inline
  // literal here gets recreated every render, and framer-motion can drop an
  // in-progress drag gesture if dragConstraints changes identity mid-drag
  // (e.g. from an unrelated parent re-render, like a react-query refetch).
  const dragConstraints = useMemo(
    () => (isMobile ? { left: -60, right: 60 } : { left: -140, right: 140, top: -20, bottom: 60 }),
    [isMobile]
  );

  const handleFlip = () => {
    if (!canFlip) return;
    setFlipped((prev) => !prev);
  };

  // Framer's onTap doesn't fire after a drag, so this can't be triggered by
  // dragging the card around -- only genuine taps/clicks count.
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleFlip();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleFlip();
    }
  };

  return (
    <div
      className="relative z-20 flex flex-col items-center select-none"
      style={{ perspective: '1400px' }}
    >
      {/* Mode-switch impulse pivot -- swings the whole pendulum (cord + clip
          + card) as one rigid body; see the impulseRotate effect above */}
      <motion.div style={{ rotate: impulseRotate, transformOrigin: 'top center' }}>
        {/* Idle pendulum sway -- suspended for reduced-motion and while dragging, so it
            doesn't fight the drag gesture's own rotation */}
        <motion.div
          animate={prefersReducedMotion || isDragging ? { rotate: 0 } : { rotate: [-1.5, 1.5, -1.5] }}
          transition={
            prefersReducedMotion || isDragging
              ? { duration: 0.3 }
              : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ transformOrigin: 'top center' }}
          className="flex flex-col items-center"
        >
          {/* Cord */}
          <div
            className={`w-[3px] h-16 md:h-24 bg-gradient-to-b ${accent.strapFrom} to-zinc-600 rounded-t-full shadow-md`}
          />
          {/* Clip */}
          <div className="w-4 h-4 bg-zinc-800 border border-zinc-600 rounded-full -mt-1 shadow-inner flex items-center justify-center">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${accent.dot}`} />
          </div>

          {/* Draggable hanging body. No dragSnapToOrigin here -- it silently
              stops applying the drag transform at all when x/y are externally
              owned motion values (as they are here, for the rotation tilt),
              so the "snap back to the hanging position" behavior it would
              have given us is done by hand in onDragEnd instead. */}
          <motion.div
            drag={isMobile ? 'x' : true}
            dragConstraints={dragConstraints}
            dragElastic={0.15}
            whileDrag={{ scale: 1.03 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => {
              setIsDragging(false);
              animate(x, 0, { type: 'spring', stiffness: 200, damping: 12 });
              animate(y, 0, { type: 'spring', stiffness: 200, damping: 12 });
            }}
            style={{ x, y, rotate: combinedCardRotate, transformOrigin: 'top center' }}
            className="cursor-grab active:cursor-grabbing -mt-1"
          >
            {/* 3D flip engine */}
            <motion.div
              role="button"
              tabIndex={0}
              aria-pressed={flipped}
              aria-label={canFlip ? `${name} ID card. Press Enter to flip and see fun facts.` : `${name} ID card`}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              onTap={handleTap}
              onKeyDown={handleKeyDown}
              className="w-56 h-80 md:w-64 md:h-[380px] lg:w-72 lg:h-[420px] rounded-2xl shadow-2xl relative outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* FRONT */}
              <div
                className={`absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border-2 ${accent.border} p-5 md:p-6 flex flex-col items-center justify-between text-white shadow-2xl shadow-black/40`}
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                aria-hidden={flipped}
              >
                <div className={`w-full flex justify-center text-[10px] tracking-widest font-mono ${accent.text}`}>
                  <span>{accent.label}</span>
                </div>

                <div
                  className={`w-28 h-28 md:w-32 md:h-32 rounded-full border-2 ${accent.frameBorder} p-1 bg-zinc-800/50 shadow-lg ${accent.frameGlow} overflow-hidden my-3`}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      width={128}
                      height={128}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-cover rounded-full pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full flex items-center justify-center bg-zinc-800 text-2xl font-bold text-zinc-300">
                      {getInitials(name)}
                    </div>
                  )}
                </div>

                <div className="text-center w-full">
                  <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase text-zinc-100 leading-tight">
                    {name}
                  </h2>
                  <p className={`text-xs font-mono tracking-widest mt-1 uppercase ${accent.text}`}>{title}</p>
                </div>

                <div className="w-full border-t border-zinc-800/80 pt-3 flex justify-between items-center text-xs text-zinc-400 font-mono">
                  {age !== null ? (
                    <span>
                      AGE: <strong className="text-white">{age}</strong>
                    </span>
                  ) : (
                    <span />
                  )}
                  {canFlip && (
                    <span className={`text-[9px] animate-pulse ${accent.hint}`}>⚡ DOUBLE TAP TO FLIP</span>
                  )}
                </div>
              </div>

              {/* BACK */}
              <div
                className={`absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-b ${accent.backTint} backdrop-blur-md border-2 ${accent.backBorder} p-5 md:p-6 flex flex-col justify-between text-white shadow-2xl`}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                aria-hidden={!flipped}
              >
                <div>
                  <div className={`text-[10px] tracking-widest font-mono mb-4 border-b pb-2 ${accent.textSoft} border-white/10`}>
                    // FUN FACTS ABOUT ME
                  </div>
                  <ul className="space-y-3 text-xs font-sans text-zinc-300 leading-relaxed">
                    {facts.map((fact, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className={`font-mono mt-0.5 ${accent.text}`}>▸</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`w-full text-center font-mono text-[9px] tracking-widest ${accent.footerTag}`}>
                  [ SECURE_ACCESS_GRANTED ]
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HangingCard;
