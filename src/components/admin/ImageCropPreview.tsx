import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Monitor, Smartphone, Move, RotateCcw, ZoomIn } from 'lucide-react';
import { CropPosition } from '@/types/cms';

interface ImageCropPreviewProps {
  imageUrl: string;
  cropLandscape: CropPosition;
  cropSquare: CropPosition;
  onCropLandscapeChange: (crop: CropPosition) => void;
  onCropSquareChange: (crop: CropPosition) => void;
}

const ImageCropPreview = ({
  imageUrl,
  cropLandscape,
  cropSquare,
  onCropLandscapeChange,
  onCropSquareChange,
}: ImageCropPreviewProps) => {
  const [activePreview, setActivePreview] = React.useState<'landscape' | 'square'>('landscape');

  const resetCrop = (type: 'landscape' | 'square') => {
    if (type === 'landscape') {
      onCropLandscapeChange({ x: 50, y: 50, zoom: 100 });
    } else {
      onCropSquareChange({ x: 50, y: 50, zoom: 100 });
    }
  };

  const activeCrop = activePreview === 'landscape' ? cropLandscape : cropSquare;
  const setActiveCrop = activePreview === 'landscape' ? onCropLandscapeChange : onCropSquareChange;

  // Ensure zoom has a default value
  const currentZoom = activeCrop.zoom ?? 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Adjust Image Position</Label>
      </div>

      {/* Preview Container - Clickable to select */}
      <div className="grid grid-cols-2 gap-4">
        {/* Landscape Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              Projects Page
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => resetCrop('landscape')}
              className="h-6 px-2 text-xs"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
          <div 
            onClick={() => setActivePreview('landscape')}
            className={`relative w-full aspect-[16/9] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
              activePreview === 'landscape' 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            <img
              src={imageUrl}
              alt="Landscape preview"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${cropLandscape.x}% ${cropLandscape.y}%`,
                transform: `scale(${(cropLandscape.zoom ?? 100) / 100})`,
                transformOrigin: `${cropLandscape.x}% ${cropLandscape.y}%`
              }}
            />
            {activePreview === 'landscape' && (
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                Editing
              </div>
            )}
          </div>
        </div>

        {/* Square Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              Home Cards
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => resetCrop('square')}
              className="h-6 px-2 text-xs"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
          <div 
            onClick={() => setActivePreview('square')}
            className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
              activePreview === 'square' 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            <img
              src={imageUrl}
              alt="Square preview"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${cropSquare.x}% ${cropSquare.y}%`,
                transform: `scale(${(cropSquare.zoom ?? 100) / 100})`,
                transformOrigin: `${cropSquare.x}% ${cropSquare.y}%`
              }}
            />
            {activePreview === 'square' && (
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                Editing
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Position Controls */}
      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Move className="w-3 h-3" />
          <span>Adjust focus point for {activePreview === 'landscape' ? 'Projects Page' : 'Home Cards'}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Horizontal</Label>
            <Slider
              value={[activeCrop.x]}
              onValueChange={([x]) => setActiveCrop({ ...activeCrop, x })}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-8 text-right">{activeCrop.x}%</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Vertical</Label>
            <Slider
              value={[activeCrop.y]}
              onValueChange={([y]) => setActiveCrop({ ...activeCrop, y })}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-8 text-right">{activeCrop.y}%</span>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs w-16 flex items-center gap-1">
              <ZoomIn className="w-3 h-3" />
              Zoom
            </Label>
            <Slider
              value={[currentZoom]}
              onValueChange={([zoom]) => setActiveCrop({ ...activeCrop, zoom })}
              min={100}
              max={200}
              step={5}
              className="flex-1"
            />
            <span className="text-xs w-8 text-right">{currentZoom}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropPreview;
