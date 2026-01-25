import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Maximize2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';

interface ProjectImageGalleryProps {
  images: string[];
  videoUrl?: string;
  videoThumbnail?: string;
  videoPosition?: number; // Position in the gallery where video should appear
  title: string;
  mode: 'professional' | 'creative';
}

const ProjectImageGallery = ({ 
  images, 
  videoUrl, 
  videoThumbnail,
  videoPosition,
  title,
  mode 
}: ProjectImageGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // Calculate video index and total slides
  const videoIndex = videoUrl ? (videoPosition !== undefined ? videoPosition : images.length) : -1;
  const totalSlides = images.length + (videoUrl ? 1 : 0);
  const hasMultipleSlides = totalSlides > 1;
  
  // Map currentIndex to actual content
  const getContentForIndex = (index: number): { type: 'image' | 'video'; url: string; thumbnail?: string } => {
    if (!videoUrl || videoIndex === -1) {
      return { type: 'image', url: images[index] || '' };
    }
    
    if (index === videoIndex) {
      return { type: 'video', url: videoUrl, thumbnail: videoThumbnail };
    }
    
    // Adjust image index based on video position
    const imageIndex = index < videoIndex ? index : index - 1;
    return { type: 'image', url: images[imageIndex] || '' };
  };
  
  // Get thumbnail for a given slide index
  const getThumbnailForIndex = (index: number): string => {
    const content = getContentForIndex(index);
    if (content.type === 'video') {
      return content.thumbnail || '/placeholder.svg';
    }
    return content.url;
  };
  
  const currentContent = getContentForIndex(currentIndex);
  const isVideoSlide = currentContent.type === 'video';

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
    setShowVideo(false);
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    setShowVideo(false);
  }, [totalSlides]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrev();
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'Escape') setIsFullscreen(false);
  }, [goToPrev, goToNext]);

  const handleImageClick = () => {
    if (isVideoSlide) {
      setShowVideo(true);
    } else {
      setIsFullscreen(true);
    }
  };

  // Get embed URL for video
  const getVideoEmbedUrl = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    // Google Drive
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    return url;
  };

  const accentColor = mode === 'creative' ? 'orange' : 'purple';

  if (totalSlides === 0) {
    return (
      <div className="w-full h-64 sm:h-80 md:h-96 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
        <span className="text-muted-foreground">No Media Available</span>
      </div>
    );
  }

  return (
    <>
      {/* Main Gallery */}
      <div 
        className="relative w-full h-64 sm:h-80 md:h-96 rounded-xl overflow-hidden group"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Project image gallery"
      >
        {/* Current Image/Video */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {showVideo && isVideoSlide ? (
              <iframe
                src={getVideoEmbedUrl(currentContent.url)}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={`${title} video`}
              />
            ) : (
              <img
                src={isVideoSlide ? (currentContent.thumbnail || '/placeholder.svg') : currentContent.url}
                alt={`${title} - ${isVideoSlide ? 'Video' : 'Image'} ${currentIndex + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={handleImageClick}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Video Play Overlay */}
        {isVideoSlide && !showVideo && (
          <button
            onClick={() => setShowVideo(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
            aria-label="Play video"
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              `bg-${accentColor}-500/90 hover:bg-${accentColor}-500`
            )}>
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            </div>
          </button>
        )}

        {/* Navigation Arrows - Only show if multiple images and not showing video */}
        {hasMultipleSlides && !showVideo && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </>
        )}

        {/* Fullscreen Button */}
        {!showVideo && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleImageClick}
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="View fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}

        {/* Image Counter */}
        {hasMultipleSlides && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            {currentIndex + 1} / {totalSlides}
            {isVideoSlide && ' (Video)'}
          </div>
        )}

        {/* Thumbnail Strip */}
        {hasMultipleSlides && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            {Array.from({ length: Math.min(5, totalSlides) }).map((_, idx) => {
              const slideContent = getContentForIndex(idx);
              const isVideo = slideContent.type === 'video';
              const thumbUrl = isVideo ? (slideContent.thumbnail || '/placeholder.svg') : slideContent.url;
              
              return (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setShowVideo(false); }}
                  className={cn(
                    "w-10 h-10 rounded overflow-hidden border-2 transition-all relative",
                    currentIndex === idx 
                      ? `border-${accentColor}-500` 
                      : "border-transparent hover:border-white/50"
                  )}
                  aria-label={`View ${isVideo ? 'video' : 'image'} ${idx + 1}`}
                >
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="w-3 h-3 text-white" fill="white" />
                    </div>
                  )}
                </button>
              );
            })}
            {totalSlides > 5 && (
              <div className="w-10 h-10 rounded bg-black/60 flex items-center justify-center text-white text-xs">
                +{totalSlides - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none"
          onKeyDown={handleKeyDown}
        >
          <VisuallyHidden>
            <DialogTitle>Fullscreen Image Gallery</DialogTitle>
          </VisuallyHidden>
          
          <div className="relative w-full h-full flex items-center justify-center min-h-[50vh]">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              aria-label="Close fullscreen"
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Image */}
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={isVideoSlide ? (currentContent.thumbnail || '/placeholder.svg') : currentContent.url}
                alt={`${title} - ${isVideoSlide ? 'Video' : 'Image'} ${currentIndex + 1}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="max-w-full max-h-[90vh] object-contain"
              />
            </AnimatePresence>

            {/* Navigation */}
            {hasMultipleSlides && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </>
            )}

            {/* Counter */}
            {hasMultipleSlides && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                {currentIndex + 1} / {totalSlides}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectImageGallery;
