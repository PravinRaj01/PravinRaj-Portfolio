import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MagazineIssue } from '@/types/magazine';

interface MagazineViewerProps {
  issue: MagazineIssue;
  onClose: () => void;
}

const DRIVE_PROXY = 'https://kadsdqnpxzgdxnnrdzra.supabase.co/functions/v1/google-drive-proxy?id=';

const MagazineViewer: React.FC<MagazineViewerProps> = ({ issue, onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const { content } = issue;

  // Build pages array
  const pages: React.ReactNode[] = [];

  // Cover page
  pages.push(
    <div className="relative w-full h-full flex flex-col items-center justify-center text-center overflow-hidden">
      {content.cover.cover_image_drive_id && (
        <div className="absolute inset-0">
          <img
            src={`${DRIVE_PROXY}${content.cover.cover_image_drive_id}`}
            alt="Cover"
            className="w-full h-full object-cover"
            style={{ filter: 'sepia(0.2) contrast(1.1) brightness(0.4)' }}
          />
        </div>
      )}
      <div className="relative z-10 px-8 max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/60 mb-6 font-sans">Code & Creative</p>
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight mb-4">{content.cover.headline}</h1>
        <p className="text-lg md:text-xl text-white/80 font-serif italic">{content.cover.subhead}</p>
        <div className="mt-8 w-16 h-[2px] bg-white/40 mx-auto" />
      </div>
    </div>
  );

  // Editor's note
  pages.push(
    <div className="w-full h-full flex flex-col justify-center px-8 md:px-16 py-12 bg-gradient-to-br from-background to-muted">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-6">From the Editor</p>
      <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-8">{content.editors_note.title}</h2>
      <div className="prose prose-lg max-w-none">
        {content.editors_note.body.split('\n').map((para, i) => (
          <p key={i} className={`text-foreground/80 leading-relaxed font-serif ${i === 0 ? 'first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-primary' : ''}`}>
            {para}
          </p>
        ))}
      </div>
    </div>
  );

  // Article pages
  content.articles.forEach((article, idx) => {
    const isLeft = article.layout === 'split_left';
    const isFullBleed = article.layout === 'full_bleed';

    pages.push(
      <div className="w-full h-full flex flex-col md:flex-row overflow-hidden bg-background" key={`article-${idx}`}>
        {isFullBleed ? (
          <div className="relative w-full h-full flex flex-col justify-end">
            {article.image_drive_id && (
              <div className="absolute inset-0">
                <img
                  src={`${DRIVE_PROXY}${article.image_drive_id}`}
                  alt={article.headline}
                  className="w-full h-full object-cover"
                  style={{ filter: 'sepia(0.15) contrast(1.1) brightness(0.5)' }}
                />
              </div>
            )}
            <div className="relative z-10 p-8 md:p-12 bg-gradient-to-t from-black/80 to-transparent">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">{article.headline}</h2>
              <blockquote className="text-lg text-white/70 italic font-serif border-l-2 border-primary pl-4 mb-4">
                "{article.pull_quote}"
              </blockquote>
              <div className="text-white/80 font-serif leading-relaxed text-sm md:text-base max-h-40 overflow-y-auto">
                {article.body.split('\n').map((p, i) => <p key={i} className="mb-2">{p}</p>)}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Image side */}
            <div className={`w-full md:w-1/2 h-64 md:h-full ${isLeft ? 'order-1' : 'order-1 md:order-2'}`}>
              {article.image_drive_id ? (
                <img
                  src={`${DRIVE_PROXY}${article.image_drive_id}`}
                  alt={article.headline}
                  className="w-full h-full object-cover"
                  style={{ filter: 'sepia(0.15) contrast(1.1)' }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground/30 text-6xl font-serif">{idx + 1}</span>
                </div>
              )}
            </div>
            {/* Text side */}
            <div className={`w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center overflow-y-auto ${isLeft ? 'order-2' : 'order-2 md:order-1'}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Feature {idx + 1}</p>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">{article.headline}</h2>
              <blockquote className="text-base text-muted-foreground italic font-serif border-l-2 border-primary pl-4 mb-6">
                "{article.pull_quote}"
              </blockquote>
              <div className="text-foreground/80 font-serif leading-relaxed text-sm md:text-base">
                {article.body.split('\n').map((p, i) => (
                  <p key={i} className={`mb-3 ${i === 0 ? 'first-letter:text-4xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-primary' : ''}`}>
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  });

  // Closing page
  pages.push(
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-background to-muted">
      <div className="w-16 h-[2px] bg-primary/40 mx-auto mb-8" />
      <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">{content.closing.title}</h2>
      <p className="text-lg text-muted-foreground font-serif italic max-w-lg leading-relaxed">{content.closing.body}</p>
      <div className="mt-10 w-16 h-[2px] bg-primary/40 mx-auto" />
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-8">Code & Creative Magazine</p>
    </div>
  );

  const totalPages = pages.length;

  const navigate = useCallback((dir: number) => {
    setDirection(dir);
    setCurrentPage(prev => Math.max(0, Math.min(totalPages - 1, prev + dir)));
  }, [totalPages]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onClose]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', rotateY: dir > 0 ? -15 : 15, opacity: 0 }),
    center: { x: 0, rotateY: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', rotateY: dir > 0 ? 15 : -15, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/95 flex flex-col"
      style={{ perspective: '1200px' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-white/10 z-10">
        <span className="text-white/60 text-sm font-serif">{issue.title}</span>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs">{currentPage + 1} / {totalPages}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Page content */}
      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={(e) => {
          const startX = e.touches[0].clientX;
          const handleEnd = (ev: TouchEvent) => {
            const diff = startX - ev.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1);
            document.removeEventListener('touchend', handleEnd);
          };
          document.addEventListener('touchend', handleEnd);
        }}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentPage}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {pages[currentPage]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav buttons */}
      {currentPage > 0 && (
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {currentPage < totalPages - 1 && (
        <button
          onClick={() => navigate(1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Page dots */}
      <div className="flex items-center justify-center gap-1.5 py-3 bg-black/50 backdrop-blur-sm">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > currentPage ? 1 : -1); setCurrentPage(i); }}
            className={`w-2 h-2 rounded-full transition-all ${i === currentPage ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default MagazineViewer;
