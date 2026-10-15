import type { CSSProperties } from 'react';
import type { CropPosition } from '@/types/cms';

// The focus point and zoom picked in the admin crop editor, as an <img> style.
// Same math as ImageCropPreview, so what is saved is what is shown.
export const cropStyle = (crop?: CropPosition | null): CSSProperties => {
  const x = crop?.x ?? 50;
  const y = crop?.y ?? 50;
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${(crop?.zoom ?? 100) / 100})`,
    transformOrigin: `${x}% ${y}%`,
  };
};
