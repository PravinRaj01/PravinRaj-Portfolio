import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MagazineIssue } from '@/types/magazine';

interface MagazineViewerProps {
  issue: MagazineIssue;
  onClose: () => void;
}

const driveThumb = (id: string, size = 1600) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=s${size}`;

const PageContent: React.FC<{ children: React.ReactNode; pageNum?: number; totalPages?: number }> = ({ children, pageNum, totalPages }) => (
  <div className="relative w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 50%, #efe9df 100%)' }}>
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'4\' height=\'4\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'1\' height=\'1\' fill=\'%23000\'/%3E%3C/svg%3E")', backgroundSize: '4px 4px' }} />
    <div className="relative w-full h-full overflow-y-auto">{children}</div>
    {pageNum !== undefined && totalPages !== undefined && (
      <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-black/30 font-serif tracking-widest">{pageNum} / {totalPages}</div>
    )}
  </div>
);

// Build all pages from issue content
function buildPages(content: MagazineIssue['content']) {
  const pages: { key: string; render: (pn: number, total: number) => React.ReactNode }[] = [];

  // Cover
  pages.push({
    key: 'cover',
    render: () => (
      <div className="relative w-full h-full flex flex-col items-center justify-center text-center overflow-hidden bg-[#1a1a1a]">
        {content.cover.cover_image_drive_id && (
          <div className="absolute inset-0">
            <img src={driveThumb(content.cover.cover_image_drive_id)} alt="Cover" className="w-full h-full object-cover" style={{ filter: 'sepia(0.25) contrast(1.15) brightness(0.35) saturate(0.8)' }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
        <div className="relative z-10 px-8 max-w-2xl">
          <div className="w-20 h-[1px] bg-white/40 mx-auto mb-6" />
          <p className="text-[10px] uppercase tracking-[0.5em] text-white/50 mb-8 font-sans">Code & Creative</p>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-[1.1] mb-5">{content.cover.headline}</h1>
          <p className="text-base md:text-lg text-white/70 font-serif italic">{content.cover.subhead}</p>
          <div className="w-20 h-[1px] bg-white/40 mx-auto mt-8" />
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/30 mt-6 font-sans">Swipe or click to read →</p>
        </div>
      </div>
    ),
  });

  // Editor's note
  pages.push({
    key: 'editors-note',
    render: (pn, total) => (
      <PageContent pageNum={pn} totalPages={total}>
        <div className="flex flex-col justify-center min-h-full px-8 md:px-16 py-12">
          <p className="text-[10px] uppercase tracking-[0.35em] text-black/40 mb-6 font-sans">From the Editor</p>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#1a1a1a] mb-8 leading-tight">{content.editors_note.title}</h2>
          {content.editors_note.body.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} className={`text-[#2a2a2a]/80 leading-[1.8] font-serif text-base mb-4 ${i === 0 ? 'first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[#1a1a1a] first-letter:leading-none' : ''}`}>{para}</p>
          ))}
        </div>
      </PageContent>
    ),
  });

  // Articles
  content.articles.forEach((article, idx) => {
    const isLeft = article.layout === 'split_left';
    const isFullBleed = article.layout === 'full_bleed';

    pages.push({
      key: `article-${idx}`,
      render: (pn, total) => (
        <PageContent pageNum={pn} totalPages={total}>
          {isFullBleed ? (
            <div className="relative w-full h-full flex flex-col justify-end min-h-full">
              {article.image_drive_id && (
                <div className="absolute inset-0">
                  <img src={driveThumb(article.image_drive_id)} alt={article.headline} className="w-full h-full object-cover" style={{ filter: 'sepia(0.2) contrast(1.1) brightness(0.45) saturate(0.85)' }} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10 p-8 md:p-12">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3 font-sans">Feature {idx + 1}</p>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4 leading-tight">{article.headline}</h2>
                <blockquote className="text-base text-white/60 italic font-serif border-l-2 border-white/30 pl-4 mb-5">"{article.pull_quote}"</blockquote>
                <div className="text-white/75 font-serif leading-relaxed text-sm max-h-48 overflow-y-auto">
                  {article.body.split('\n').filter(Boolean).map((p, i) => <p key={i} className="mb-2">{p}</p>)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row w-full min-h-full">
              <div className={`w-full md:w-1/2 h-56 md:h-auto md:min-h-full ${isLeft ? 'order-1' : 'order-1 md:order-2'}`}>
                {article.image_drive_id ? (
                  <img src={driveThumb(article.image_drive_id)} alt={article.headline} className="w-full h-full object-cover" style={{ filter: 'sepia(0.15) contrast(1.1) saturate(0.9)' }} />
                ) : (
                  <div className="w-full h-full bg-[#e8e0d4] flex items-center justify-center"><span className="text-[#c4b8a8] text-7xl font-serif italic">{idx + 1}</span></div>
                )}
              </div>
              <div className={`w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center ${isLeft ? 'order-2' : 'order-2 md:order-1'}`}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-black/40 mb-4 font-sans">Feature {idx + 1}</p>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#1a1a1a] mb-4 leading-tight">{article.headline}</h2>
                <blockquote className="text-sm text-[#555] italic font-serif border-l-2 border-[#c4a882] pl-4 mb-6">"{article.pull_quote}"</blockquote>
                <div className="text-[#2a2a2a]/80 font-serif leading-[1.8] text-sm">
                  {article.body.split('\n').filter(Boolean).map((p, i) => (
                    <p key={i} className={`mb-3 ${i === 0 ? 'first-letter:text-4xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[#1a1a1a] first-letter:leading-none' : ''}`}>{p}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </PageContent>
      ),
    });
  });

  // Closing
  pages.push({
    key: 'closing',
    render: (pn, total) => (
      <PageContent pageNum={pn} totalPages={total}>
        <div className="flex flex-col items-center justify-center min-h-full text-center px-8 py-12">
          <div className="w-16 h-[1px] bg-[#c4a882] mx-auto mb-8" />
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#1a1a1a] mb-6 leading-tight">{content.closing.title}</h2>
          <p className="text-base text-[#555] font-serif italic max-w-lg leading-relaxed">{content.closing.body}</p>
          <div className="w-16 h-[1px] bg-[#c4a882] mx-auto mt-8" />
          <p className="text-[9px] uppercase tracking-[0.4em] text-black/30 mt-8 font-sans">Code & Creative Magazine</p>
        </div>
      </PageContent>
    ),
  });

  return pages;
}

const FLIP_DURATION = 0.6;

const MagazineViewer: React.FC<MagazineViewerProps> = ({ issue, onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'forward' | 'backward'>('forward');
  const [nextPage, setNextPage] = useState<number | null>(null);
  const flipControls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const pages = buildPages(issue.content);
  const totalPages = pages.length;

  const doFlip = useCallback(async (dir: 'forward' | 'backward') => {
    if (isFlipping) return;
    const target = dir === 'forward' ? currentPage + 1 : currentPage - 1;
    if (target < 0 || target >= totalPages) return;

    setIsFlipping(true);
    setFlipDirection(dir);
    setNextPage(target);

    // Reset flip layer to 0
    await flipControls.set({ rotateY: 0 });

    // Animate the flip
    await flipControls.start({
      rotateY: dir === 'forward' ? -180 : 180,
      transition: { duration: FLIP_DURATION, ease: [0.645, 0.045, 0.355, 1] },
    });

    setCurrentPage(target);
    setNextPage(null);
    setIsFlipping(false);
  }, [currentPage, totalPages, isFlipping, flipControls]);

  const navigate = useCallback((dir: number) => {
    doFlip(dir > 0 ? 'forward' : 'backward');
  }, [doFlip]);

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

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      navigate(diff > 0 ? 1 : -1);
    }
  };

  // Direct page jump (no animation)
  const jumpToPage = (idx: number) => {
    if (isFlipping || idx === currentPage) return;
    setCurrentPage(idx);
  };

  // Determine what the "back" (destination) page is during a flip
  const backPageIdx = nextPage ?? currentPage;
  const frontPageIdx = currentPage;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center"
    >
      {/* Title bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-30">
        <span className="text-white/50 text-xs font-serif tracking-wide">{issue.title}</span>
        <div className="flex items-center gap-4">
          <span className="text-white/30 text-[10px] font-sans">{currentPage + 1} / {totalPages}</span>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Book container */}
      <div
        ref={containerRef}
        className="relative w-[92vw] max-w-[900px] h-[75vh] max-h-[700px]"
        style={{ perspective: '2000px' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Book shadow */}
        <div className="absolute -bottom-4 left-[10%] right-[10%] h-8 bg-black/40 rounded-[50%] blur-xl" />

        {/* Spine shadow */}
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/40 via-black/15 to-transparent z-20 rounded-l-sm pointer-events-none" />

        {/* LAYER 1: Back page (destination — static, always underneath) */}
        <div className="absolute inset-0 rounded-sm overflow-hidden shadow-xl">
          {pages[backPageIdx].render(backPageIdx + 1, totalPages)}
        </div>

        {/* LAYER 2: Flip layer (current page that peels away) — only visible during flip */}
        {isFlipping && (
          <motion.div
            animate={flipControls}
            className="absolute inset-0 rounded-sm overflow-hidden shadow-2xl"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: flipDirection === 'forward' ? 'left center' : 'right center',
              backfaceVisibility: 'hidden',
              zIndex: 10,
            }}
          >
            {pages[frontPageIdx].render(frontPageIdx + 1, totalPages)}
            {/* Page edge shadow during flip */}
            <div
              className="absolute inset-y-0 pointer-events-none"
              style={{
                [flipDirection === 'forward' ? 'right' : 'left']: 0,
                width: '40px',
                background: flipDirection === 'forward'
                  ? 'linear-gradient(to left, rgba(0,0,0,0.15), transparent)'
                  : 'linear-gradient(to right, rgba(0,0,0,0.15), transparent)',
              }}
            />
          </motion.div>
        )}

        {/* LAYER 3: Static current page (when NOT flipping) */}
        {!isFlipping && (
          <div className="absolute inset-0 rounded-sm overflow-hidden shadow-2xl" style={{ zIndex: 5 }}>
            {pages[currentPage].render(currentPage + 1, totalPages)}
          </div>
        )}
      </div>

      {/* Nav buttons */}
      {currentPage > 0 && (
        <button onClick={() => navigate(-1)} className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all border border-white/10">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {currentPage < totalPages - 1 && (
        <button onClick={() => navigate(1)} className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all border border-white/10">
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Page dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => jumpToPage(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentPage ? 'bg-white/80 w-6' : 'bg-white/20 hover:bg-white/40 w-1.5'}`}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default MagazineViewer;
