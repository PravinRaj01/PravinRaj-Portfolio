import React, { useState, useCallback, useMemo } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { X, Image, Video, Plus, GripVertical, Play, Images } from 'lucide-react';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { cn } from '@/lib/utils';

export type MediaType = 'none' | 'images' | 'video' | 'both';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
}

interface ProjectMediaManagerProps {
  galleryImages: string[];
  videoUrl: string;
  videoThumbnail: string;
  includeThumbnailInGallery: boolean;
  onGalleryImagesChange: (images: string[]) => void;
  onVideoUrlChange: (url: string) => void;
  onVideoThumbnailChange: (url: string) => void;
  onIncludeThumbnailInGalleryChange: (value: boolean) => void;
  onOpenFilePicker: (target: 'gallery' | 'video' | 'thumbnail') => void;
  onOpenMultiFilePicker?: () => void;
}

interface SortableMediaItemProps {
  item: MediaItem;
  onRemove: () => void;
}

const VIDEO_MARKER = '__VIDEO__';

const SortableMediaItem = ({ item, onRemove }: SortableMediaItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const thumbnailUrl = item.type === 'video' 
    ? (item.thumbnailUrl || '/placeholder.svg')
    : item.url;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group bg-card border rounded-lg overflow-hidden",
        isDragging && "opacity-50 z-50 shadow-lg"
      )}
    >
      <div className="aspect-video relative">
        <img
          src={thumbnailUrl}
          alt={item.type === 'video' ? 'Video thumbnail' : 'Gallery image'}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        
        {/* Video overlay */}
        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Type badge */}
        <div className={cn(
          "absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded",
          item.type === 'video' 
            ? "bg-purple-500 text-white" 
            : "bg-blue-500 text-white"
        )}>
          {item.type === 'video' ? 'VIDEO' : 'IMAGE'}
        </div>

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute top-1 right-8 p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-white" />
        </button>

        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-1 bg-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

const ProjectMediaManager = ({
  galleryImages,
  videoUrl,
  videoThumbnail,
  includeThumbnailInGallery,
  onGalleryImagesChange,
  onVideoUrlChange,
  onVideoThumbnailChange,
  onIncludeThumbnailInGalleryChange,
  onOpenFilePicker,
  onOpenMultiFilePicker,
}: ProjectMediaManagerProps) => {
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  // Determine current media type based on existing data
  const getInitialMediaType = useCallback((): MediaType => {
    const hasImages = galleryImages.filter(img => img !== VIDEO_MARKER).length > 0;
    const hasVideo = !!videoUrl;
    if (hasImages && hasVideo) return 'both';
    if (hasImages) return 'images';
    if (hasVideo) return 'video';
    return 'none';
  }, [galleryImages, videoUrl]);

  const [mediaType, setMediaType] = useState<MediaType>(getInitialMediaType());

  // Create combined media items for reordering - memoized to prevent unnecessary recalculation
  const mediaItems = useMemo((): MediaItem[] => {
    const items: MediaItem[] = [];
    
    if (mediaType === 'both' || mediaType === 'images' || mediaType === 'video') {
      let imageCounter = 0;
      let videoAdded = false;
      
      galleryImages.forEach((img) => {
        if (img === VIDEO_MARKER) {
          // Insert video at this position
          if (videoUrl && (mediaType === 'both' || mediaType === 'video') && !videoAdded) {
            items.push({
              id: 'video-0',
              type: 'video',
              url: videoUrl,
              thumbnailUrl: videoThumbnail ? 
                (videoThumbnail.startsWith('http') ? videoThumbnail : generateDriveImageUrl(videoThumbnail, 'medium')) 
                : undefined
            });
            videoAdded = true;
          }
        } else {
          // Regular image
          items.push({
            id: `image-${imageCounter}`,
            type: 'image',
            url: img
          });
          imageCounter++;
        }
      });
      
      // Add video at end if not already added
      if ((mediaType === 'both' || mediaType === 'video') && videoUrl && !videoAdded) {
        items.push({
          id: 'video-0',
          type: 'video',
          url: videoUrl,
          thumbnailUrl: videoThumbnail ? 
            (videoThumbnail.startsWith('http') ? videoThumbnail : generateDriveImageUrl(videoThumbnail, 'medium')) 
            : undefined
        });
      }
    }
    
    return items;
  }, [galleryImages, videoUrl, videoThumbnail, mediaType]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = mediaItems.findIndex(item => item.id === active.id);
      const newIndex = mediaItems.findIndex(item => item.id === over.id);
      
      const newItems = arrayMove(mediaItems, oldIndex, newIndex);
      
      // Build new gallery_images array with VIDEO_MARKER to preserve video position
      const newGalleryImages: string[] = [];
      
      newItems.forEach(item => {
        if (item.type === 'video') {
          newGalleryImages.push(VIDEO_MARKER);
        } else {
          newGalleryImages.push(item.url);
        }
      });
      
      onGalleryImagesChange(newGalleryImages);
    }
  }, [mediaItems, onGalleryImagesChange]);

  const handleRemoveItem = useCallback((itemId: string) => {
    const item = mediaItems.find(m => m.id === itemId);
    if (!item) return;
    
    if (item.type === 'video') {
      onVideoUrlChange('');
      onVideoThumbnailChange('');
      // Remove the video marker from gallery images
      const newImages = galleryImages.filter(img => img !== VIDEO_MARKER);
      onGalleryImagesChange(newImages);
    } else {
      // Remove the specific image URL, keep video markers intact
      const newImages = galleryImages.filter(img => img !== item.url);
      onGalleryImagesChange(newImages);
    }
  }, [mediaItems, galleryImages, onGalleryImagesChange, onVideoUrlChange, onVideoThumbnailChange]);

  const handleAddImage = useCallback(() => {
    if (newImageUrl.trim()) {
      onGalleryImagesChange([...galleryImages, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  }, [newImageUrl, galleryImages, onGalleryImagesChange]);

  const handleAddVideo = useCallback(() => {
    if (newVideoUrl.trim()) {
      onVideoUrlChange(newVideoUrl.trim());
      setNewVideoUrl('');
    }
  }, [newVideoUrl, onVideoUrlChange]);

  const handleMediaTypeChange = useCallback((value: MediaType) => {
    setMediaType(value);
    // Clear data when switching away from a type
    if (value === 'images' || value === 'none') {
      onVideoUrlChange('');
      onVideoThumbnailChange('');
    }
    if (value === 'video' || value === 'none') {
      onGalleryImagesChange([]);
    }
  }, [onVideoUrlChange, onVideoThumbnailChange, onGalleryImagesChange]);

  return (
    <div className="space-y-6 border rounded-lg p-4 bg-muted/30">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Project Media</Label>
        <p className="text-xs text-muted-foreground">
          Choose what type of media this project has. You can reorder items by dragging.
        </p>
        
        <RadioGroup
          value={mediaType}
          onValueChange={(v) => handleMediaTypeChange(v as MediaType)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="media-none" />
            <Label htmlFor="media-none" className="cursor-pointer">No media</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="images" id="media-images" />
            <Label htmlFor="media-images" className="cursor-pointer flex items-center gap-1">
              <Image className="w-4 h-4" /> Images only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="video" id="media-video" />
            <Label htmlFor="media-video" className="cursor-pointer flex items-center gap-1">
              <Video className="w-4 h-4" /> Video only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="media-both" />
            <Label htmlFor="media-both" className="cursor-pointer flex items-center gap-1">
              <Image className="w-4 h-4" /><span>+</span><Video className="w-4 h-4" /> Both
            </Label>
          </div>
        </RadioGroup>

        {/* Include Thumbnail Toggle */}
        {(mediaType === 'images' || mediaType === 'both') && (
          <div className="flex items-center space-x-2 pt-2 border-t mt-3">
            <Switch
              id="include_thumbnail"
              checked={includeThumbnailInGallery}
              onCheckedChange={onIncludeThumbnailInGalleryChange}
            />
            <Label htmlFor="include_thumbnail" className="text-sm cursor-pointer">
              Include main project thumbnail in detail gallery
            </Label>
          </div>
        )}
      </div>

      {/* Media Grid with Drag & Drop */}
      {(mediaType === 'images' || mediaType === 'both' || mediaType === 'video') && (
        <div className="space-y-4">
          {mediaItems.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={mediaItems.map(m => m.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {mediaItems.map((item) => (
                    <SortableMediaItem
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {mediaItems.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <p>No media added yet. Add images or videos below.</p>
            </div>
          )}

          {/* Add Images Section */}
          {(mediaType === 'images' || mediaType === 'both') && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Add Images</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter image URL"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImage();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddImage}
                  disabled={!newImageUrl.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenFilePicker('gallery')}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Add Single Image
                </Button>
                {onOpenMultiFilePicker && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenMultiFilePicker}
                  >
                    <Images className="w-4 h-4 mr-2" />
                    Add Multiple Images
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Add Video Section */}
          {(mediaType === 'video' || mediaType === 'both') && !videoUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Add Video</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="YouTube, Vimeo, or Google Drive URL"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVideo();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddVideo}
                  disabled={!newVideoUrl.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenFilePicker('video')}
              >
                <Video className="w-4 h-4 mr-2" />
                Select from Google Drive
              </Button>
            </div>
          )}

          {/* Video Thumbnail Section */}
          {(mediaType === 'video' || mediaType === 'both') && videoUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Video Thumbnail (Optional)</Label>
              {videoThumbnail ? (
                <div className="flex items-center gap-2">
                  <img
                    src={videoThumbnail.startsWith('http') ? videoThumbnail : generateDriveImageUrl(videoThumbnail, 'medium')}
                    alt="Video thumbnail"
                    className="w-20 h-12 object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onVideoThumbnailChange('')}
                  >
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Thumbnail URL"
                    onChange={(e) => onVideoThumbnailChange(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenFilePicker('thumbnail')}
                  >
                    <Image className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                If not set, the main project image will be used as thumbnail.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectMediaManager;
