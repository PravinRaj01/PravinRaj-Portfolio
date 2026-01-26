import React from 'react';
import { motion } from 'framer-motion';
import { Folder, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProjectFolder } from '@/hooks/useProjectFolders';
import { generateDriveImageUrl } from '@/utils/googleDrive';

interface FolderCardProps {
  folder: ProjectFolder;
  mode: 'professional' | 'creative';
  onClick: () => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, mode, onClick }) => {
  const coverImage = folder.cover_image_drive_id
    ? (folder.cover_image_drive_id.startsWith('http')
        ? folder.cover_image_drive_id
        : generateDriveImageUrl(folder.cover_image_drive_id, 'medium'))
    : null;

  const accentColors = mode === 'creative' 
    ? 'from-orange-500/20 to-orange-600/20 border-orange-500/30 hover:border-orange-500/50'
    : 'from-purple-500/20 to-blue-600/20 border-purple-500/30 hover:border-purple-500/50';

  const iconColor = mode === 'creative' ? 'text-orange-400' : 'text-purple-400';

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative cursor-pointer rounded-xl overflow-hidden
        bg-gradient-to-br ${accentColors}
        border backdrop-blur-sm
        transition-all duration-300
        group
      `}
      onClick={onClick}
    >
      {/* Cover Image or Gradient Background - Match project card height */}
      <div className="h-32 sm:h-40 md:h-48 relative">
        {coverImage ? (
          <img
            src={coverImage}
            alt={folder.name}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${
            mode === 'creative' 
              ? 'from-orange-500/10 to-orange-600/20' 
              : 'from-purple-500/10 to-blue-600/20'
          }`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Folder className={`w-16 h-16 ${iconColor} opacity-30`} />
            </div>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Folder className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
              <h3 className="font-semibold text-foreground truncate">
                {folder.name}
              </h3>
            </div>
            {folder.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {folder.description}
              </p>
            )}
          </div>
          <ChevronRight className={`w-5 h-5 ${iconColor} flex-shrink-0 group-hover:translate-x-1 transition-transform`} />
        </div>

        {/* Project count badge */}
        <Badge 
          className={`mt-3 ${
            mode === 'creative'
              ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
          }`}
        >
          {folder.project_count} project{folder.project_count !== 1 ? 's' : ''}
        </Badge>
      </div>
    </motion.div>
  );
};

export default FolderCard;
