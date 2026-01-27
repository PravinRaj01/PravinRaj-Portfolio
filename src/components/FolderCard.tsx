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
  compact?: boolean;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, mode, onClick, compact = false }) => {
  const coverImage = folder.cover_image_drive_id
    ? (folder.cover_image_drive_id.startsWith('http')
        ? folder.cover_image_drive_id
        : generateDriveImageUrl(folder.cover_image_drive_id, 'medium'))
    : null;

  const iconColor = mode === 'creative' ? 'text-orange-400' : 'text-purple-400';
  const bgGradient = mode === 'creative' 
    ? 'bg-gradient-to-br from-orange-500/10 to-orange-600/20' 
    : 'bg-gradient-to-br from-purple-500/10 to-blue-600/20';

  // Compact horizontal layout
  if (compact) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="group relative cursor-pointer rounded-xl overflow-hidden bg-card border border-border hover:shadow-lg transition-all duration-300"
        onClick={onClick}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Small cover image or icon */}
          <div className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ${!coverImage ? bgGradient : ''}`}>
            {coverImage ? (
              <img
                src={coverImage}
                alt={folder.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Folder className={`w-8 h-8 ${iconColor} opacity-60`} />
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-[10px] ${
                mode === 'creative' 
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                  : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
              }`}>
                <Folder className="w-2.5 h-2.5 mr-1" />
                Folder
              </Badge>
            </div>
            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
              {folder.name}
            </h3>
            {folder.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {folder.description}
              </p>
            )}
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {folder.project_count} project{folder.project_count !== 1 ? 's' : ''}
            </Badge>
            <ChevronRight className={`w-4 h-4 ${iconColor} group-hover:translate-x-1 transition-transform`} />
          </div>
        </div>
        
        {/* Hover effect */}
        <div className="absolute inset-0 border border-primary/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </motion.div>
    );
  }

  // Default tall card layout
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="group relative cursor-pointer rounded-xl overflow-hidden bg-card border border-border hover:shadow-2xl transition-all duration-300"
      onClick={onClick}
    >
      {/* Cover Image - Matches ProjectCard height */}
      <div className="relative overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={folder.name}
            className="w-full h-48 md:h-64 object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className={`w-full h-48 md:h-64 flex items-center justify-center ${bgGradient}`}>
            <Folder className={`w-20 h-20 ${iconColor} opacity-40`} />
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Folder badge */}
        <div className="absolute top-4 left-4">
          <Badge className={`${
            mode === 'creative' 
              ? 'bg-orange-500/90 hover:bg-orange-500' 
              : 'bg-purple-500/90 hover:bg-purple-500'
          } text-white`}>
            <Folder className="w-3 h-3 mr-1" />
            Folder
          </Badge>
        </div>
      </div>

      {/* Content - Matches ProjectCard p-6 structure */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-1">
            {folder.name}
          </h3>
          <ChevronRight className={`w-5 h-5 ${iconColor} flex-shrink-0 group-hover:translate-x-1 transition-transform`} />
        </div>
        
        {folder.description && (
          <p className="text-muted-foreground mt-3 mb-4 line-clamp-2">
            {folder.description}
          </p>
        )}

        {/* Project count badge - same spacing as ProjectCard technologies */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge 
            variant="secondary"
            className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {folder.project_count} project{folder.project_count !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Hover effect - matches ProjectCard */}
      <div className="absolute inset-0 border border-primary/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </motion.div>
  );
};

export default FolderCard;
