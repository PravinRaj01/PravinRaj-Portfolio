
// Google Drive utilities for handling media files
export const generateDriveImageUrl = (driveId: string, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizeMap = {
    small: 's220',
    medium: 's640', 
    large: 's1600'
  };
  
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=${sizeMap[size]}`;
};

export const generateDriveDirectUrl = (driveId: string) => {
  return `https://drive.google.com/file/d/${driveId}/view`;
};

export const extractDriveIdFromUrl = (url: string): string | null => {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};
