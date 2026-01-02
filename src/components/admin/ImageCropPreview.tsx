import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Monitor, Smartphone, Move, RotateCcw } from 'lucide-react';
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
  const [activePreview, setActivePreview] = useState<'landscape' | 'square'>('landscape');

  const resetCrop = (type: 'landscape' | 'square') => {
    if (type === 'landscape') {
      onCropLandscapeChange({ x: 50, y: 50 });
    } else {
      onCropSquareChange({ x: 50, y: 50 });
    }
  };

  const activeCrop = activePreview === 'landscape' ? cropLandscape : cropSquare;
  const setActiveCrop = activePreview === 'landscape' ? onCropLandscapeChange : onCropSquareChange;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Adjust Image Position</Label>
        <div className="flex gap-1 ml-auto">
          <Button
            type="button"
            variant={activePreview === 'landscape' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePreview('landscape')}
            className="text-xs"
          >
            <Monitor className="w-3 h-3 mr-1" />
            Landscape
          </Button>
          <Button
            type="button"
            variant={activePreview === 'square' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePreview('square')}
            className="text-xs"
          >
            <Smartphone className="w-3 h-3 mr-1" />
            Square
          </Button>
        </div>
      </div>

      {/* Preview Container */}
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
            className={`relative w-full aspect-[16/9] rounded-lg overflow-hidden border-2 ${
              activePreview === 'landscape' ? 'border-primary' : 'border-border'
            }`}
          >
            <img
              src={imageUrl}
              alt="Landscape preview"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${cropLandscape.x}% ${cropLandscape.y}%`
              }}
            />
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
            className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 ${
              activePreview === 'square' ? 'border-primary' : 'border-border'
            }`}
          >
            <img
              src={imageUrl}
              alt="Square preview"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${cropSquare.x}% ${cropSquare.y}%`
              }}
            />
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
        </div>
      </div>
    </div>
  );
};

export default ImageCropPreview;
