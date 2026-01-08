import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Monitor, Tablet, Move, RotateCcw, ZoomIn, Square } from 'lucide-react';
import { CropPosition } from '@/types/cms';

interface ImageCropPreviewProps {
  imageUrl: string;
  cropLandscape: CropPosition;
  cropSquare: CropPosition;
  cropTablet?: CropPosition;
  onCropLandscapeChange: (crop: CropPosition) => void;
  onCropSquareChange: (crop: CropPosition) => void;
  onCropTabletChange?: (crop: CropPosition) => void;
}

type PreviewType = 'landscape' | 'square' | 'tablet';

const ImageCropPreview = ({
  imageUrl,
  cropLandscape,
  cropSquare,
  cropTablet = { x: 50, y: 50, zoom: 100 },
  onCropLandscapeChange,
  onCropSquareChange,
  onCropTabletChange,
}: ImageCropPreviewProps) => {
  const [activePreview, setActivePreview] = React.useState<PreviewType>('landscape');

  const resetCrop = (type: PreviewType) => {
    const defaultCrop = { x: 50, y: 50, zoom: 100 };
    switch (type) {
      case 'landscape':
        onCropLandscapeChange(defaultCrop);
        break;
      case 'square':
        onCropSquareChange(defaultCrop);
        break;
      case 'tablet':
        onCropTabletChange?.(defaultCrop);
        break;
    }
  };

  const getActiveCrop = (): CropPosition => {
    switch (activePreview) {
      case 'landscape':
        return cropLandscape;
      case 'square':
        return cropSquare;
      case 'tablet':
        return cropTablet;
    }
  };

  const setActiveCrop = (crop: CropPosition) => {
    switch (activePreview) {
      case 'landscape':
        onCropLandscapeChange(crop);
        break;
      case 'square':
        onCropSquareChange(crop);
        break;
      case 'tablet':
        onCropTabletChange?.(crop);
        break;
    }
  };

  const activeCrop = getActiveCrop();
  const currentZoom = activeCrop.zoom ?? 100;

  const getPreviewLabel = (type: PreviewType): string => {
    switch (type) {
      case 'landscape':
        return 'Projects Page';
      case 'square':
        return 'Home Cards';
      case 'tablet':
        return 'Tablet Projects';
    }
  };

  const renderPreview = (
    type: PreviewType,
    crop: CropPosition,
    icon: React.ReactNode,
    aspectClass: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {getPreviewLabel(type)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => resetCrop(type)}
          className="h-6 px-2 text-xs"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
      <div
        onClick={() => setActivePreview(type)}
        className={`relative w-full ${aspectClass} rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
          activePreview === type
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border hover:border-muted-foreground'
        }`}
      >
        <img
          src={imageUrl}
          alt={`${type} preview`}
          className="w-full h-full object-cover"
          style={{
            objectPosition: `${crop.x}% ${crop.y}%`,
            transform: `scale(${(crop.zoom ?? 100) / 100})`,
            transformOrigin: `${crop.x}% ${crop.y}%`,
          }}
        />
        {activePreview === type && (
          <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
            Editing
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Adjust Image Position</Label>
      </div>

      {/* Preview Container - 3 columns */}
      <div className="grid grid-cols-3 gap-4">
        {/* Landscape Preview - Projects Page */}
        {renderPreview(
          'landscape',
          cropLandscape,
          <Monitor className="w-3 h-3" />,
          'aspect-[16/9]'
        )}

        {/* Square Preview - Home Cards */}
        {renderPreview(
          'square',
          cropSquare,
          <Square className="w-3 h-3" />,
          'aspect-square'
        )}

        {/* Tablet Preview - Vertical for tablet projects page */}
        {renderPreview(
          'tablet',
          cropTablet,
          <Tablet className="w-3 h-3" />,
          'aspect-[3/4]'
        )}
      </div>

      {/* Position Controls */}
      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Move className="w-3 h-3" />
          <span>Adjust focus point for {getPreviewLabel(activePreview)}</span>
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