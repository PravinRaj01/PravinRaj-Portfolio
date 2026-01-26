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

  const iconColor = mode === 'creative' ? 'text-orange-400' : 'text-purple-400';

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
          <div className={`w-full h-48 md:h-64 flex items-center justify-center ${
            mode === 'creative' 
              ? 'bg-gradient-to-br from-orange-500/10 to-orange-600/20' 
              : 'bg-gradient-to-br from-purple-500/10 to-blue-600/20'
          }`}>
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
