import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Folder, Images } from 'lucide-react';
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

const ImageSubfolderGallery = ({ folder, isOpen, onClose, mode }: ImageSubfolderGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const images = folder.images || [];
  const hasMultipleImages = images.length > 1;
  
  const accentColor = mode === 'creative' ? 'orange' : 'purple';

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

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

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

  if (images.length === 0) return null;

  return (
    <>
      {/* Main Popup Dialog */}
      <Dialog open={isOpen && !isFullscreen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent 
          className="!max-w-4xl !w-[95vw] sm:!w-[90vw] p-0 bg-background/95 backdrop-blur-md border-border overflow-hidden"
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
            {/* Main Image Area */}
            <div 
              className="relative aspect-video bg-black/50 group cursor-pointer"
              onClick={() => setIsFullscreen(true)}
            >
              {/* Blurred background */}
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={getImageUrl(images[currentIndex])}
                  alt=""
                  className="w-full h-full object-cover scale-125 blur-xl opacity-50"
                  aria-hidden="true"
                />
              </div>
              
              {/* Main image with swipe support */}
              <motion.div
                key={currentIndex}
                drag={hasMultipleImages ? "x" : false}
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
                  src={getImageUrl(images[currentIndex])}
                  alt={`${folder.name} - Image ${currentIndex + 1}`}
                  className="relative w-full h-full object-contain z-10"
                  draggable={false}
                />
              </motion.div>

              {/* Navigation Arrows */}
              {hasMultipleImages && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}

              {/* Counter */}
              {hasMultipleImages && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  {currentIndex + 1} / {images.length}
                </div>
              )}

              {/* Click to fullscreen hint */}
              <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                Click to expand
              </div>
            </div>

            {/* Thumbnail Strip */}
            {hasMultipleImages && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-background/50 justify-center">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 rounded overflow-hidden border-2 transition-all flex-shrink-0",
                      currentIndex === idx 
                        ? mode === 'creative' ? 'border-orange-500' : 'border-purple-500'
                        : 'border-transparent hover:border-muted-foreground/50'
                    )}
                    aria-label={`View image ${idx + 1}`}
                  >
                    <img 
                      src={getImageUrl(img)} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  </button>
                ))}
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
            <DialogTitle>Fullscreen Image View</DialogTitle>
          </VisuallyHidden>
          
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full w-12 h-12 sm:w-10 sm:h-10"
              aria-label="Close fullscreen"
            >
              <X className="w-6 h-6 sm:w-5 sm:h-5" />
            </Button>

            {/* Blurred background */}
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={getImageUrl(images[currentIndex])}
                alt=""
                className="w-full h-full object-cover scale-125 blur-2xl opacity-50"
                aria-hidden="true"
              />
            </div>
            
            {/* Main image with swipe support */}
            <motion.img
              key={currentIndex}
              src={getImageUrl(images[currentIndex])}
              alt={`${folder.name} - Image ${currentIndex + 1}`}
              className="relative z-10 max-w-[90vw] max-h-[85vh] object-contain"
              drag={hasMultipleImages ? "x" : false}
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

            {/* Navigation */}
            {hasMultipleImages && (
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
            {hasMultipleImages && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                {currentIndex + 1} / {images.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageSubfolderGallery;
