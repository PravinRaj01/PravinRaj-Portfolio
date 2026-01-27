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
import { X, Image, Video, Plus, GripVertical, Play, Images } from 'lucide-react';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { cn } from '@/lib/utils';
import { ProjectImageFolder } from '@/types/cms';

export type MediaType = 'none' | 'images' | 'video' | 'both';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
}

interface FolderMediaManagerProps {
  folder: ProjectImageFolder;
  onUpdate: (id: string, updates: Partial<ProjectImageFolder>) => Promise<void>;
  onOpenFilePicker: (target: 'image' | 'video' | 'thumbnail') => void;
  onOpenMultiFilePicker: () => void;
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
            <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
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
          <GripVertical className="w-3 h-3 text-white" />
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
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
};

const FolderMediaManager = ({
  folder,
  onUpdate,
  onOpenFilePicker,
  onOpenMultiFilePicker,
}: FolderMediaManagerProps) => {
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  const mediaType = folder.media_type || 'images';
  const images = folder.images || [];
  const videoUrl = folder.video_url || '';
  const videoThumbnail = folder.video_thumbnail || '';

  // Create combined media items for display
  const mediaItems = useMemo((): MediaItem[] => {
    const items: MediaItem[] = [];
    
    if (mediaType === 'none') return items;
    
    let imageCounter = 0;
    let videoAdded = false;
    
    images.forEach((img) => {
      if (img === VIDEO_MARKER) {
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
        items.push({
          id: `image-${imageCounter}`,
          type: 'image',
          url: img.startsWith('http') ? img : generateDriveImageUrl(img, 'small')
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
    
    return items;
  }, [images, videoUrl, videoThumbnail, mediaType]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = mediaItems.findIndex(item => item.id === active.id);
    const newIndex = mediaItems.findIndex(item => item.id === over.id);
    const newItems = arrayMove(mediaItems, oldIndex, newIndex);
    
    // Rebuild images array with VIDEO_MARKER
    const newImages: string[] = [];
    newItems.forEach(item => {
      if (item.type === 'video') {
        newImages.push(VIDEO_MARKER);
      } else {
        // Find original image URL (without the preview transform)
        const originalImg = images.find(img => 
          img !== VIDEO_MARKER && 
          (img.startsWith('http') ? img === item.url : generateDriveImageUrl(img, 'small') === item.url)
        );
        if (originalImg) newImages.push(originalImg);
      }
    });
    
    await onUpdate(folder.id, { images: newImages });
  }, [mediaItems, images, folder.id, onUpdate]);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    const item = mediaItems.find(m => m.id === itemId);
    if (!item) return;
    
    if (item.type === 'video') {
      const newImages = images.filter(img => img !== VIDEO_MARKER);
      await onUpdate(folder.id, { video_url: '', video_thumbnail: '', images: newImages });
    } else {
      // Find and remove the original image
      const originalImg = images.find(img => 
        img !== VIDEO_MARKER && 
        (img.startsWith('http') ? img === item.url : generateDriveImageUrl(img, 'small') === item.url)
      );
      if (originalImg) {
        const newImages = images.filter(img => img !== originalImg);
        await onUpdate(folder.id, { images: newImages });
      }
    }
  }, [mediaItems, images, folder.id, onUpdate]);

  const handleAddImage = useCallback(async () => {
    if (!newImageUrl.trim()) return;
    const updatedImages = [...images, newImageUrl.trim()];
    await onUpdate(folder.id, { images: updatedImages });
    setNewImageUrl('');
  }, [newImageUrl, images, folder.id, onUpdate]);

  const handleAddVideo = useCallback(async () => {
    if (!newVideoUrl.trim()) return;
    await onUpdate(folder.id, { video_url: newVideoUrl.trim() });
    setNewVideoUrl('');
  }, [newVideoUrl, folder.id, onUpdate]);

  const handleMediaTypeChange = useCallback(async (value: MediaType) => {
    const updates: Partial<ProjectImageFolder> = { media_type: value };
    
    // Clear data when switching away from a type
    if (value === 'images' || value === 'none') {
      updates.video_url = '';
      updates.video_thumbnail = '';
    }
    if (value === 'video' || value === 'none') {
      updates.images = [];
    }
    
    await onUpdate(folder.id, updates);
  }, [folder.id, onUpdate]);

  const handleRemoveVideoThumbnail = useCallback(async () => {
    await onUpdate(folder.id, { video_thumbnail: '' });
  }, [folder.id, onUpdate]);

  return (
    <div className="space-y-4 pt-3">
      {/* Media Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Media Type</Label>
        <RadioGroup
          value={mediaType}
          onValueChange={(v) => handleMediaTypeChange(v as MediaType)}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="none" id={`media-none-${folder.id}`} />
            <Label htmlFor={`media-none-${folder.id}`} className="cursor-pointer text-xs">None</Label>
          </div>
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="images" id={`media-images-${folder.id}`} />
            <Label htmlFor={`media-images-${folder.id}`} className="cursor-pointer text-xs flex items-center gap-1">
              <Image className="w-3 h-3" /> Images
            </Label>
          </div>
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="video" id={`media-video-${folder.id}`} />
            <Label htmlFor={`media-video-${folder.id}`} className="cursor-pointer text-xs flex items-center gap-1">
              <Video className="w-3 h-3" /> Video
            </Label>
          </div>
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="both" id={`media-both-${folder.id}`} />
            <Label htmlFor={`media-both-${folder.id}`} className="cursor-pointer text-xs flex items-center gap-1">
              <Image className="w-3 h-3" />+<Video className="w-3 h-3" /> Both
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Media Grid */}
      {mediaType !== 'none' && (
        <>
          {mediaItems.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={mediaItems.map(m => m.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
            <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-xs">
              No media added yet
            </div>
          )}

          {/* Add Images Section */}
          {(mediaType === 'images' || mediaType === 'both') && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Add Images</Label>
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
                  className="text-xs h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddImage} disabled={!newImageUrl.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenFilePicker('image')} className="text-xs h-7">
                  <Image className="w-3 h-3 mr-1" /> Add Single
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenMultiFilePicker} className="text-xs h-7">
                  <Images className="w-3 h-3 mr-1" /> Add Multiple
                </Button>
              </div>
            </div>
          )}

          {/* Add Video Section */}
          {(mediaType === 'video' || mediaType === 'both') && !videoUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Add Video</Label>
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
                  className="text-xs h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddVideo} disabled={!newVideoUrl.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenFilePicker('video')} className="text-xs h-7">
                <Video className="w-3 h-3 mr-1" /> From Google Drive
              </Button>
            </div>
          )}

          {/* Video Thumbnail Section */}
          {(mediaType === 'video' || mediaType === 'both') && videoUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Video Thumbnail (Optional)</Label>
              {videoThumbnail ? (
                <div className="flex items-center gap-2">
                  <img
                    src={videoThumbnail.startsWith('http') ? videoThumbnail : generateDriveImageUrl(videoThumbnail, 'small')}
                    alt="Video thumbnail"
                    className="w-16 h-10 object-cover rounded border"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveVideoThumbnail} className="text-xs h-7">
                    <X className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenFilePicker('thumbnail')} className="text-xs h-7">
                  <Image className="w-3 h-3 mr-1" /> Add Thumbnail
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FolderMediaManager;
