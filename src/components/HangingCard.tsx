import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { RotateCcw } from 'lucide-react';
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
    pass: 'PROFESSIONAL PASS',
    hex: '#a855f7',
    text: 'text-purple-400',
    textSoft: 'text-purple-300',
    ring: 'ring-purple-500/60',
    pill: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    backTint: 'from-purple-950/60 via-zinc-950 to-black',
    edge: 'border-purple-500/25',
  },
  creative: {
    pass: 'CREATIVE PASS',
    hex: '#ff6a3d',
    text: 'text-[#ff6a3d]',
    textSoft: 'text-[#ff8a5f]',
    ring: 'ring-[#ff6a3d]/60',
    pill: 'bg-[#ff6a3d]/15 text-[#ff8a5f] border-[#ff6a3d]/30',
    backTint: 'from-[#ff6a3d]/25 via-zinc-950 to-black',
    edge: 'border-[#ff6a3d]/25',
  },
} as const;

// ---- Physics ---------------------------------------------------------------
//
// A Verlet-integrated rope (the lanyard) whose first point is pinned to the
// top edge of the hero section, and whose last point is the pivot of a rigid
// two-point body (the card: pivot at the clasp, second point at the card's
// bottom edge). Everything -- idle sway, drag, toss, the mode-switch knock --
// comes out of the same simulation, so the strap always bends with the card.
// Positions are in px relative to the anchor (top-centre of the strap).

const SEGMENTS = 18; // rope segments between the anchor and the card pivot
const PIVOT = SEGMENTS; // index of the card pivot (end of the rope)
const BOTTOM = SEGMENTS + 1; // index of the card's bottom-centre point
const COUNT = SEGMENTS + 2;
const STEP = 1 / 120; // fixed physics timestep (s)
const GRAVITY = 2600; // px/s²
const ITERATIONS = 16;
const MAX_STEP_MOVE = 48; // px per step -- caps runaway tosses
const CLASP_H = 30; // px of metal clasp above the card face (part of the body)
const TAP_SLOP = 6; // px of movement before a press becomes a drag
const DOUBLE_TAP_MS = 350;

interface Sim {
  x: Float32Array;
  y: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  w: Float32Array; // inverse mass
  segLen: number;
  bodyLen: number;
  ropeLen: number;
  acc: number;
  tilt: number;
  ready: boolean;
}

interface Drag {
  active: boolean; // a real drag (past TAP_SLOP)
  pressed: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  pointerX: number; // local coords
  pointerY: number;
  t: number; // grab position along the card axis, 0 = pivot, 1 = bottom
  perp: number; // grab offset perpendicular to the card axis
}

function createSim(): Sim {
  return {
    x: new Float32Array(COUNT),
    y: new Float32Array(COUNT),
    ox: new Float32Array(COUNT),
    oy: new Float32Array(COUNT),
    w: new Float32Array(COUNT),
    segLen: 1,
    bodyLen: 1,
    ropeLen: 1,
    acc: 0,
    tilt: 0,
    ready: false,
  };
}

function solveDistance(s: Sim, a: number, b: number, rest: number, minOnly: boolean) {
  const dx = s.x[b] - s.x[a];
  const dy = s.y[b] - s.y[a];
  const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  if (minOnly && d >= rest) return;
  const wa = s.w[a];
  const wb = s.w[b];
  const wsum = wa + wb;
  if (wsum === 0) return;
  const k = (d - rest) / (d * wsum);
  s.x[a] += dx * k * wa;
  s.y[a] += dy * k * wa;
  s.x[b] -= dx * k * wb;
  s.y[b] -= dy * k * wb;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const HangingCard = ({ name, title, photoUrl, birthDate, funFacts, mode }: HangingCardProps) => {
  const [flipped, setFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const { isTransitioning } = usePortfolio();

  const placeholderRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const simRef = useRef<Sim>(createSim());
  const inViewRef = useRef(true);
  const lastTapRef = useRef(0);
  const dragRef = useRef<Drag>({
    active: false,
    pressed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    pointerX: 0,
    pointerY: 0,
    t: 0,
    perp: 0,
  });

  const strapId = useId().replace(/:/g, '');

  // Card transform, written by the frame loop (never via React state).
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const cardRotate = useMotionValue(0);
  const cardTilt = useMotionValue(0);
  const sheenPosition = useTransform(
    () => `${50 + cardRotate.get() * 1.4 + cardTilt.get() * 1.8}% 0%`
  );

  const accent = ACCENTS[mode];
  const age = birthDate ? getAge(birthDate) : null;
  const facts = (funFacts ?? []).filter(Boolean);
  const canFlip = facts.length > 0;

  useEffect(() => {
    const query = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setCoarsePointer(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Anchor the strap to the top edge of the hero section, and lay the rope out
  // straight down to where the card rests (the in-flow placeholder's top).
  const measure = useCallback(
    (swingIn: boolean) => {
      const placeholder = placeholderRef.current;
      const body = bodyRef.current;
      if (!placeholder || !body || dragRef.current.pressed) return;
      const section = placeholder.closest('section') ?? placeholder.parentElement;
      if (!section) return;

      const ropeLen = Math.max(
        80,
        placeholder.getBoundingClientRect().top - section.getBoundingClientRect().top
      );
      const bodyLen = body.offsetHeight;
      const s = simRef.current;
      s.ropeLen = ropeLen;
      s.segLen = ropeLen / SEGMENTS;
      s.bodyLen = bodyLen;

      if (originRef.current) originRef.current.style.top = `${-ropeLen}px`;

      for (let i = 0; i <= SEGMENTS; i++) {
        s.x[i] = 0;
        s.y[i] = (ropeLen * i) / SEGMENTS;
        s.w[i] = 1;
      }
      s.w[0] = 0; // anchor
      s.w[PIVOT] = 0.3; // the card is far heavier than the strap,
      s.w[BOTTOM] = 0.15; // and bottom-heavy, so it settles hanging straight

      // Entrance: start the card swung out so it falls into place on a real
      // pendulum arc instead of just appearing.
      const angle = swingIn ? 0.42 : 0;
      s.x[BOTTOM] = Math.sin(angle) * bodyLen;
      s.y[BOTTOM] = ropeLen + Math.cos(angle) * bodyLen;
      for (let i = 0; i < COUNT; i++) {
        s.ox[i] = s.x[i];
        s.oy[i] = s.y[i];
      }
      s.acc = 0;
      s.ready = true;
    },
    []
  );

  useLayoutEffect(() => {
    measure(!prefersReducedMotion);
    const placeholder = placeholderRef.current;
    const section = placeholder?.closest('section');
    if (!placeholder) return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(false));
    });
    observer.observe(placeholder);
    if (section) observer.observe(section);

    const visibility = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
    });
    visibility.observe(section ?? placeholder);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure]);

  // Mode switch: the colour sweep "knocks" the card -- a shove to the bottom
  // of the body, fired as the overlay starts fading (falling edge).
  const wasTransitioningRef = useRef(false);
  useEffect(() => {
    const was = wasTransitioningRef.current;
    wasTransitioningRef.current = isTransitioning;
    if (was && !isTransitioning && !prefersReducedMotion) {
      simRef.current.ox[BOTTOM] -= 14;
    }
  }, [isTransitioning, prefersReducedMotion]);

  useAnimationFrame((time, delta) => {
    const s = simRef.current;
    const drag = dragRef.current;
    if (!s.ready) return;
    if (!inViewRef.current && !drag.pressed) {
      s.acc = 0;
      return;
    }

    s.acc += Math.min(delta, 50) / 1000;
    const damping = prefersReducedMotion ? 0.95 : 0.994;
    const seconds = time / 1000;

    while (s.acc >= STEP) {
      s.acc -= STEP;

      // Gentle ambient air on the card -- two incommensurate sines so the
      // sway never looks like a loop.
      const wind =
        prefersReducedMotion || drag.active
          ? 0
          : 55 * Math.sin(seconds * 0.7) + 22 * Math.sin(seconds * 1.73 + 1.3);

      for (let i = 1; i < COUNT; i++) {
        let vx = (s.x[i] - s.ox[i]) * damping;
        let vy = (s.y[i] - s.oy[i]) * damping;
        vx = clamp(vx, -MAX_STEP_MOVE, MAX_STEP_MOVE);
        vy = clamp(vy, -MAX_STEP_MOVE, MAX_STEP_MOVE);
        s.ox[i] = s.x[i];
        s.oy[i] = s.y[i];
        const ax = i === BOTTOM ? wind : 0;
        s.x[i] += vx + ax * STEP * STEP;
        s.y[i] += vy + GRAVITY * STEP * STEP;
      }

      for (let k = 0; k < ITERATIONS; k++) {
        // Strap: inextensible links, plus a soft anti-fold so a flat fabric
        // strap curves instead of kinking into a zig-zag.
        for (let i = 0; i < SEGMENTS; i++) solveDistance(s, i, i + 1, s.segLen, false);
        for (let i = 0; i < SEGMENTS - 1; i++) solveDistance(s, i, i + 2, s.segLen * 1.6, true);
        // Card: rigid.
        solveDistance(s, PIVOT, BOTTOM, s.bodyLen, false);

        if (drag.active) {
          // Pin the grabbed point of the card to the pointer. The grab point
          // sits at `t` along the card axis, offset `perp` sideways, so the
          // card pivots around where it was actually picked up.
          const x0 = s.x[PIVOT];
          const y0 = s.y[PIVOT];
          const ux = (s.x[BOTTOM] - x0) / s.bodyLen;
          const uy = (s.y[BOTTOM] - y0) / s.bodyLen;
          let tx = drag.pointerX + uy * drag.perp;
          let ty = drag.pointerY - ux * drag.perp;
          // Can't pull further than the taut strap allows.
          const reach = s.ropeLen * 1.02 + drag.t * s.bodyLen;
          const dist = Math.sqrt(tx * tx + ty * ty);
          if (dist > reach) {
            tx *= reach / dist;
            ty *= reach / dist;
          }
          const t = drag.t;
          const cx = tx - (x0 + (s.x[BOTTOM] - x0) * t);
          const cy = ty - (y0 + (s.y[BOTTOM] - y0) * t);
          const norm = (1 - t) * (1 - t) + t * t;
          s.x[PIVOT] += (cx * (1 - t)) / norm;
          s.y[PIVOT] += (cy * (1 - t)) / norm;
          s.x[BOTTOM] += (cx * t) / norm;
          s.y[BOTTOM] += (cy * t) / norm;
        }
      }
    }

    // Render: card transform + strap path. No React renders here.
    const x0 = s.x[PIVOT];
    const y0 = s.y[PIVOT];
    const angle = Math.atan2(s.x[BOTTOM] - x0, s.y[BOTTOM] - y0);
    cardX.set(x0);
    cardY.set(y0);
    cardRotate.set((-angle * 180) / Math.PI);

    // The card turns in 3D a little as it swings sideways, like a real badge.
    const vx = (s.x[BOTTOM] - s.ox[BOTTOM]) / STEP;
    const targetTilt = prefersReducedMotion ? 0 : clamp(vx * 0.03, -28, 28);
    s.tilt += (targetTilt - s.tilt) * 0.12;
    cardTilt.set(s.tilt);

    const path = pathRef.current;
    if (path) {
      // Smooth curve through the rope points (quadratic through midpoints).
      let d = `M${s.x[0].toFixed(1)} ${s.y[0].toFixed(1)}`;
      for (let i = 1; i < SEGMENTS; i++) {
        const mx = (s.x[i] + s.x[i + 1]) / 2;
        const my = (s.y[i] + s.y[i + 1]) / 2;
        d += `Q${s.x[i].toFixed(1)} ${s.y[i].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      }
      d += `L${x0.toFixed(1)} ${y0.toFixed(1)}`;
      path.setAttribute('d', d);
    }
  });

  const toggleFlip = useCallback(() => {
    if (!canFlip) return;
    setFlipped((prev) => !prev);
    // A flip is a physical flick -- give the card a small kick.
    if (!prefersReducedMotion) simRef.current.ox[BOTTOM] += 6;
  }, [canFlip, prefersReducedMotion]);

  const toLocal = (clientX: number, clientY: number) => {
    const origin = originRef.current!.getBoundingClientRect();
    return { x: clientX - origin.left, y: clientY - origin.top };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const s = simRef.current;
    const drag = dragRef.current;
    const p = toLocal(event.clientX, event.clientY);
    const x0 = s.x[PIVOT];
    const y0 = s.y[PIVOT];
    const ux = (s.x[BOTTOM] - x0) / s.bodyLen;
    const uy = (s.y[BOTTOM] - y0) / s.bodyLen;
    const along = (p.x - x0) * ux + (p.y - y0) * uy;
    drag.t = clamp(along / s.bodyLen, 0, 1);
    drag.perp = (p.x - x0) * -uy + (p.y - y0) * ux;
    drag.pressed = true;
    drag.active = false;
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.pointerX = p.x;
    drag.pointerY = p.y;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.pressed || event.pointerId !== drag.pointerId) return;
    const p = toLocal(event.clientX, event.clientY);
    drag.pointerX = p.x;
    drag.pointerY = p.y;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > TAP_SLOP) {
      drag.active = true;
      setIsDragging(true);
    }
  };

  const endPress = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag.pressed || event.pointerId !== drag.pointerId) return;
    const wasDrag = drag.active;
    drag.pressed = false;
    drag.active = false;
    if (wasDrag) setIsDragging(false);
    if (cancelled || wasDrag) {
      lastTapRef.current = 0;
      return;
    }
    // A clean tap. Two within DOUBLE_TAP_MS flip the card.
    const now = performance.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      toggleFlip();
    } else {
      lastTapRef.current = now;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleFlip();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      simRef.current.ox[BOTTOM] += event.key === 'ArrowLeft' ? 10 : -10;
    }
  };

  const faceBase =
    'absolute inset-0 rounded-[20px] overflow-hidden border bg-gradient-to-b text-white [backface-visibility:hidden] [-webkit-backface-visibility:hidden]';
  const faceShadow = {
    boxShadow:
      '0 30px 60px -20px rgba(0,0,0,0.75), 0 12px 24px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.6)',
  };
  const sheen = (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.10) 47%, rgba(255,255,255,0.02) 53%, transparent 62%)',
        backgroundSize: '300% 100%',
        backgroundPosition: sheenPosition,
      }}
    />
  );
  const barcode = (
    <div
      aria-hidden
      className="h-7 w-24 opacity-70"
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, #d4d4d8 0 2px, transparent 2px 4px, #d4d4d8 4px 5px, transparent 5px 8px, #d4d4d8 8px 11px, transparent 11px 12px)',
      }}
    />
  );
  const strapText = 'PRAVINRAJ.DEV  •  '.repeat(24);

  return (
    <div
      ref={placeholderRef}
      className="relative z-20 w-[260px] h-[422px] sm:w-[280px] sm:h-[452px] lg:w-[300px] lg:h-[482px] select-none"
    >
      {/* Local origin = the strap anchor, pinned to the hero section's top
          edge (its `top` is set by measure()). Everything is positioned from
          here by the simulation. */}
      <div
        ref={originRef}
        className="absolute left-1/2 w-0 h-0"
        style={{ top: 0, perspective: '1600px' }}
      >
        {/* Lanyard strap */}
        <svg
          aria-hidden
          className="absolute left-0 top-0 overflow-visible pointer-events-none"
          width="1"
          height="1"
        >
          <defs>
            <path id={strapId} ref={pathRef} d="M0 0" fill="none" />
          </defs>
          <use href={`#${strapId}`} stroke="#050506" strokeWidth={20} strokeLinecap="butt" fill="none" />
          <use href={`#${strapId}`} stroke="#141417" strokeWidth={16} strokeLinecap="butt" fill="none" />
          <use
            href={`#${strapId}`}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
            fill="none"
            transform="translate(-6 0)"
          />
          <text
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fontWeight={700}
            letterSpacing="1.5"
            fill={accent.hex}
            fillOpacity={0.85}
            dominantBaseline="central"
          >
            <textPath href={`#${strapId}`} startOffset="8">
              {strapText}
            </textPath>
          </text>
        </svg>

        {/* Card body -- pivot (top-centre of the clasp) sits on the origin */}
        <motion.div
          ref={bodyRef}
          role="button"
          tabIndex={0}
          aria-pressed={canFlip ? flipped : undefined}
          aria-label={
            canFlip
              ? `${name} ID card. Drag to swing it; double-tap or press Enter to flip for fun facts.`
              : `${name} ID card. Drag to swing it.`
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => endPress(e, false)}
          onPointerCancel={(e) => endPress(e, true)}
          onKeyDown={handleKeyDown}
          className={`absolute left-0 top-0 -ml-[130px] sm:-ml-[140px] lg:-ml-[150px] w-[260px] sm:w-[280px] lg:w-[300px] outline-none focus-visible:[&_.card-face]:ring-2 focus-visible:[&_.card-face]:ring-white/70 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            x: cardX,
            y: cardY,
            rotate: cardRotate,
            rotateY: cardTilt,
            transformOrigin: '50% 0%',
            transformStyle: 'preserve-3d',
            touchAction: 'pan-y',
            willChange: 'transform',
          }}
        >
          {/* Metal clasp: swivel eye (strap end) + hook into the card slot */}
          <svg aria-hidden width="40" height={CLASP_H + 6} viewBox={`0 0 40 ${CLASP_H + 6}`} className="block mx-auto -mb-[6px] relative z-10">
            <defs>
              <linearGradient id={`${strapId}-metal`} x1="0" x2="1">
                <stop offset="0" stopColor="#6b7280" />
                <stop offset="0.45" stopColor="#f4f4f5" />
                <stop offset="0.6" stopColor="#a1a1aa" />
                <stop offset="1" stopColor="#52525b" />
              </linearGradient>
            </defs>
            <rect x="12" y="0" width="16" height="7" rx="3.5" fill="none" stroke={`url(#${strapId}-metal)`} strokeWidth="2.5" />
            <rect x="17.5" y="6" width="5" height="9" rx="1.5" fill={`url(#${strapId}-metal)`} />
            <path
              d={`M20 14 C 11 14, 9 22, 12 ${CLASP_H - 2} L 28 ${CLASP_H - 2} C 31 22, 29 14, 20 14 Z`}
              fill="none"
              stroke={`url(#${strapId}-metal)`}
              strokeWidth="3"
            />
            <rect x="11" y={CLASP_H - 4} width="18" height="5" rx="2.5" fill={`url(#${strapId}-metal)`} />
          </svg>

          {/* Flip engine */}
          <motion.div
            className="relative h-[392px] sm:h-[422px] lg:h-[452px]"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.2 }
                : { type: 'spring', visualDuration: 0.7, bounce: 0.22 }
            }
          >
            {/* FRONT */}
            <div
              className={`card-face ${faceBase} ${accent.edge} from-zinc-900 via-zinc-950 to-black`}
              style={faceShadow}
              aria-hidden={flipped}
            >
              {/* punched slot the clasp hooks through */}
              <div className="absolute left-1/2 top-3 -translate-x-1/2 h-2 w-14 rounded-full bg-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.07)]" />

              <div className="relative flex h-full flex-col px-5 pb-4 pt-8">
                <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.18em]">
                  <span className="font-bold text-zinc-100">PRAVINRAJ.DEV</span>
                  <span className="text-zinc-500">ID № 0001</span>
                </div>
                <div className="mt-2">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-mono font-bold tracking-[0.2em] ${accent.pill}`}>
                    {accent.pass}
                  </span>
                </div>

                <div className={`relative mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl bg-zinc-800 ring-1 ${accent.ring}`}>
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      draggable={false}
                      className="pointer-events-none h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-zinc-400">
                      {getInitials(name)}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
                </div>

                <h2 className="mt-3 text-[22px] font-extrabold uppercase leading-[1.05] tracking-tight text-zinc-50 sm:text-2xl">
                  {name}
                </h2>
                <p className={`mt-1 truncate text-[10px] font-mono uppercase tracking-[0.2em] ${accent.text}`}>{title}</p>

                <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
                  <div className="font-mono text-[10px] leading-tight text-zinc-400">
                    {age !== null && (
                      <div>
                        AGE <span className="text-sm font-bold text-zinc-100">{age}</span>
                      </div>
                    )}
                    {canFlip && (
                      <div className={`mt-0.5 text-[9px] tracking-widest ${accent.textSoft} opacity-80`}>
                        {coarsePointer ? 'DOUBLE-TAP TO FLIP' : 'DOUBLE-CLICK TO FLIP'}
                      </div>
                    )}
                  </div>
                  {barcode}
                </div>
              </div>
              {sheen}
            </div>

            {/* BACK */}
            <div
              className={`card-face ${faceBase} ${accent.edge} ${accent.backTint}`}
              style={{ ...faceShadow, transform: 'rotateY(180deg)' }}
              aria-hidden={!flipped}
            >
              <div className="absolute left-1/2 top-3 -translate-x-1/2 h-2 w-14 rounded-full bg-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.07)]" />
              <div className="relative flex h-full flex-col px-5 pb-4 pt-8">
                <div className={`border-b border-white/10 pb-2 text-[10px] font-mono tracking-[0.2em] ${accent.textSoft}`}>
                  // FUN FACTS ABOUT ME
                </div>
                <ul className="mt-4 flex-1 space-y-3 overflow-hidden text-[13px] leading-relaxed text-zinc-200">
                  {facts.map((fact, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className={`mt-0.5 font-mono ${accent.text}`}>▸</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
                  <span className={`font-mono text-[9px] tracking-[0.2em] ${accent.textSoft} opacity-70`}>
                    SECURE ACCESS GRANTED
                  </span>
                  {barcode}
                </div>
              </div>
              {sheen}
            </div>
          </motion.div>

          {canFlip && (
            <button
              type="button"
              aria-label={flipped ? 'Flip card to the front' : 'Flip card to see fun facts'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleFlip();
              }}
              className="absolute bottom-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-zinc-300 backdrop-blur transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ transform: 'translateZ(2px)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default HangingCard;
