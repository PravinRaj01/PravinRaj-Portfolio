import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Folder, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { ProjectImageFolder } from '@/types/cms';
import { cn } from '@/lib/utils';

interface ImageSubfolderGalleryProps {
  folder: ProjectImageFolder;
  isOpen: boolean;
  onClose: () => void;
  mode: 'professional' | 'creative';
}

const VIDEO_MARKER = '__VIDEO__';

const ImageSubfolderGallery = ({ folder, isOpen, onClose, mode }: ImageSubfolderGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  
  const rawImages = folder.images || [];
  const videoUrl = folder.video_url;
  const videoThumbnail = folder.video_thumbnail;
  const mediaType = folder.media_type || 'images';
  
  // Filter images (remove VIDEO_MARKER)
  const images = rawImages.filter(img => img !== VIDEO_MARKER);
  
  // Calculate video position from VIDEO_MARKER
  let videoPosition = -1;
  if (videoUrl && (mediaType === 'video' || mediaType === 'both')) {
    const markerIndex = rawImages.indexOf(VIDEO_MARKER);
    videoPosition = markerIndex >= 0 ? markerIndex : images.length;
  }
  
  // Total slides calculation
  const totalSlides = (mediaType === 'images' || mediaType === 'both' ? images.length : 0) + 
                     (videoUrl && (mediaType === 'video' || mediaType === 'both') ? 1 : 0);
  const hasMultipleSlides = totalSlides > 1;
  
  const accentColor = mode === 'creative' ? 'orange' : 'purple';

  // Map currentIndex to actual content
  const getContentForIndex = (index: number): { type: 'image' | 'video'; url: string; thumbnail?: string } => {
    if (!videoUrl || videoPosition === -1 || mediaType === 'images') {
      return { type: 'image', url: images[index] || '' };
    }
    
    if (mediaType === 'video') {
      return { type: 'video', url: videoUrl, thumbnail: videoThumbnail };
    }
    
    // mediaType === 'both'
    if (index === videoPosition) {
      return { type: 'video', url: videoUrl, thumbnail: videoThumbnail };
    }
    
    const imageIndex = index < videoPosition ? index : index - 1;
    return { type: 'image', url: images[imageIndex] || '' };
  };

  const currentContent = getContentForIndex(currentIndex);
  const isVideoSlide = currentContent.type === 'video';

  // Handle browser back button when popup is open
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ subfolderGallery: true }, '');
      
      const handlePopState = () => {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, isFullscreen, onClose]);

  // Reset state when folder changes
  useEffect(() => {
    setCurrentIndex(0);
    setShowVideo(false);
  }, [folder.id]);

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
    if (e.key === 'Escape') {
      if (isFullscreen) {
        setIsFullscreen(false);
      } else {
        onClose();
      }
    }
  }, [goToPrev, goToNext, isFullscreen, onClose]);

  const getImageUrl = (img: string) => {
    return img.startsWith('http') ? img : generateDriveImageUrl(img, 'large');
  };

  const handleSlideClick = () => {
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

  const getDisplayUrl = () => {
    if (isVideoSlide) {
      return currentContent.thumbnail ? getImageUrl(currentContent.thumbnail) : '/placeholder.svg';
    }
    return getImageUrl(currentContent.url);
  };

  if (totalSlides === 0) return null;

  return (
    <>
      {/* Main Popup Dialog */}
      <Dialog open={isOpen && !isFullscreen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent 
          className="!max-w-4xl !w-[100vw] sm:!w-[90vw] p-0 bg-background/95 backdrop-blur-md border-border overflow-hidden max-h-[95vh]"
          onKeyDown={handleKeyDown}
          hideCloseButton={true}
        >
          <VisuallyHidden>
            <DialogTitle>{folder.name} Gallery</DialogTitle>
          </VisuallyHidden>
          
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between p-4 border-b",
            `border-${accentColor}-500/20`
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                mode === 'creative' ? 'bg-orange-500/20' : 'bg-purple-500/20'
              )}>
                <Folder className={cn(
                  "w-5 h-5",
                  mode === 'creative' ? 'text-orange-400' : 'text-purple-400'
                )} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{folder.name}</h3>
                {folder.description && (
                  <p className="text-xs text-muted-foreground">{folder.description}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10"
              aria-label="Close gallery"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Gallery Content */}
          <div className="relative">
            {/* Main Image/Video Area */}
            <div 
              className="relative aspect-video bg-black/50 group cursor-pointer"
              onClick={handleSlideClick}
            >
              {showVideo && isVideoSlide ? (
                <iframe
                  src={getVideoEmbedUrl(currentContent.url)}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={`${folder.name} video`}
                />
              ) : (
                <>
                  {/* Blurred background */}
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={getDisplayUrl()}
                      alt=""
                      className="w-full h-full object-cover scale-125 blur-xl opacity-50"
                      aria-hidden="true"
                    />
                  </div>
                  
                  {/* Main image with swipe support */}
                  <motion.div
                    key={currentIndex}
                    drag={hasMultipleSlides ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
                      const threshold = 50;
                      if (info.offset.x > threshold) {
                        goToPrev();
                      } else if (info.offset.x < -threshold) {
                        goToNext();
                      }
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full h-full"
                  >
                    <img
                      src={getDisplayUrl()}
                      alt={`${folder.name} - ${isVideoSlide ? 'Video' : 'Image'} ${currentIndex + 1}`}
                      className="relative w-full h-full object-contain z-10"
                      draggable={false}
                    />
                  </motion.div>

                  {/* Video Play Overlay */}
                  {isVideoSlide && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowVideo(true); }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors z-20"
                      aria-label="Play video"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center",
                        mode === 'creative' ? 'bg-orange-500/90 hover:bg-orange-500' : 'bg-purple-500/90 hover:bg-purple-500'
                      )}>
                        <Play className="w-8 h-8 text-white ml-1" fill="white" />
                      </div>
                    </button>
                  )}
                </>
              )}

              {/* Navigation Arrows */}
              {hasMultipleSlides && !showVideo && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Next"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}

              {/* Counter */}
              {hasMultipleSlides && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full z-20">
                  {currentIndex + 1} / {totalSlides}
                  {isVideoSlide && ' (Video)'}
                </div>
              )}

              {/* Click to fullscreen hint */}
              {!isVideoSlide && (
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  Click to expand
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {hasMultipleSlides && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-background/50 justify-start sm:justify-center w-full max-w-full">
                {Array.from({ length: totalSlides }).map((_, idx) => {
                  const content = getContentForIndex(idx);
                  const isVideo = content.type === 'video';
                  const thumbUrl = isVideo 
                    ? (content.thumbnail ? getImageUrl(content.thumbnail) : '/placeholder.svg')
                    : getImageUrl(content.url);
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => { setCurrentIndex(idx); setShowVideo(false); }}
                      className={cn(
                        "w-14 h-14 sm:w-16 sm:h-16 rounded overflow-hidden border-2 transition-all flex-shrink-0 relative",
                        currentIndex === idx 
                          ? mode === 'creative' ? 'border-orange-500' : 'border-purple-500'
                          : 'border-transparent hover:border-muted-foreground/50'
                      )}
                      aria-label={`View ${isVideo ? 'video' : 'image'} ${idx + 1}`}
                    >
                      <img 
                        src={thumbUrl} 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Play className="w-4 h-4 text-white" fill="white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent 
          className="!max-w-none !w-screen !h-screen !max-h-screen p-0 bg-black border-none rounded-none"
          onKeyDown={handleKeyDown}
          hideCloseButton={true}
        >
          <VisuallyHidden>
            <DialogTitle>Fullscreen View</DialogTitle>
          </VisuallyHidden>
          
            <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button - better positioned for mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 sm:top-4 right-4 z-[60] bg-black/70 hover:bg-black/90 text-white rounded-full w-12 h-12 sm:w-10 sm:h-10"
              aria-label="Close fullscreen"
            >
              <X className="w-6 h-6 sm:w-5 sm:h-5" />
            </Button>

            {/* Blurred background */}
            <div className="absolute inset-0 overflow-hidden z-0">
              <img
                src={getDisplayUrl()}
                alt=""
                className="w-full h-full object-cover scale-125 blur-2xl opacity-50"
                aria-hidden="true"
              />
            </div>
            
            {/* Main image with swipe support */}
            <motion.img
              key={currentIndex}
              src={getDisplayUrl()}
              alt={`${folder.name} - ${currentIndex + 1}`}
              className="relative z-10 max-w-[90vw] max-h-[80vh] object-contain touch-pan-y"
              drag={hasMultipleSlides ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
                const threshold = 50;
                if (info.offset.x > threshold) {
                  goToPrev();
                } else if (info.offset.x < -threshold) {
                  goToNext();
                }
              }}
            />

            {/* Navigation - higher z-index, always visible */}
            {hasMultipleSlides && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrev}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[55] bg-black/70 hover:bg-black/90 text-white rounded-full w-10 h-10 sm:w-12 sm:h-12"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[55] bg-black/70 hover:bg-black/90 text-white rounded-full w-10 h-10 sm:w-12 sm:h-12"
                  aria-label="Next"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </>
            )}

            {/* Counter */}
            {hasMultipleSlides && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[55] bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                {currentIndex + 1} / {totalSlides}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageSubfolderGallery;
