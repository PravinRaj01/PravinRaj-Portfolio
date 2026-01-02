import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { Project } from '@/types/cms';

interface TinderProjectCardsProps {
  projects: Project[];
  mode: 'professional' | 'creative';
}

const TinderProjectCards = ({ projects, mode }: TinderProjectCardsProps) => {
  const navigate = useNavigate();
  const [cards, setCards] = useState(projects);
  const [currentIndex, setCurrentIndex] = useState(0);
  const dragControls = useAnimation();
  const isDragging = useRef(false);

  const handleDragStart = () => {
    isDragging.current = true;
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      // Card swiped - move it to the back
      const direction = offset > 0 ? 1 : -1;
      
      // Animate the card off screen
      dragControls.start({
        x: direction * 1000,
        opacity: 0,
        transition: { duration: 0.3 }
      });

      // After animation, move card to back and reset
      setTimeout(() => {
        setCards(prev => {
          const newCards = [...prev];
          const swiped = newCards.shift();
          if (swiped) {
            newCards.push(swiped);
          }
          return newCards;
        });
        
        dragControls.set({ x: 0, opacity: 1 });
        isDragging.current = false;
      }, 300);
    } else {
      // Snap back to center
      dragControls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 500, damping: 30 }
      });
      // Small delay to prevent click from firing right after drag
      setTimeout(() => {
        isDragging.current = false;
      }, 100);
    }
  };

  const handleCardClick = (projectId: string) => {
    if (!isDragging.current) {
      navigate(`/projects/${projectId}`);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No projects available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto h-96">
      {cards.slice(0, 3).map((project, index) => (
        <motion.div
          key={`${project.id}-${index}`}
          className={`absolute inset-0 rounded-xl border-2 shadow-lg cursor-grab active:cursor-grabbing ${
            mode === 'creative'
              ? 'bg-gradient-to-br from-[hsl(226,45%,14%)] via-[hsl(20,60%,12%)] to-[hsl(226,45%,10%)] border-orange-500/30 text-white'
              : 'bg-gradient-to-br from-[hsl(260,50%,18%)] via-[hsl(240,40%,14%)] to-[hsl(222,60%,10%)] border-purple-500/30 text-white'
          }`}
          style={{
            zIndex: cards.length - index,
            scale: 1 - index * 0.05,
            y: index * 10,
            rotateZ: index * 2,
          }}
          drag={index === 0 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={index === 0 ? handleDragStart : undefined}
          onDragEnd={index === 0 ? handleDragEnd : undefined}
          animate={index === 0 ? dragControls : undefined}
          whileHover={index === 0 ? { scale: 1.02 } : {}}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          onClick={index === 0 ? () => handleCardClick(project.id) : undefined}
        >
          <div className="h-full flex flex-col">
            {/* Project Image */}
            <div className="relative h-48 overflow-hidden rounded-t-xl">
              {project.image_drive_id ? (
                <img 
                  src={project.image_drive_id.startsWith('http') 
                    ? project.image_drive_id 
                    : generateDriveImageUrl(project.image_drive_id, 'medium')} 
                  alt={project.title}
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: `${project.crop_square?.x ?? 50}% ${project.crop_square?.y ?? 50}%`
                  }}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${
                  mode === 'creative'
                    ? 'bg-gradient-to-br from-orange-900/20 to-[hsl(226,45%,8%)]'
                    : 'bg-gradient-to-br from-purple-900/30 to-[hsl(222,60%,8%)]'
                }`}>
                  <span className="text-muted-foreground text-sm">No Image</span>
                </div>
              )}
              
              {project.featured && (
                <Badge className={`absolute top-3 left-3 bg-gradient-to-r ${
                  mode === 'creative' 
                    ? 'from-orange-500 to-orange-600' 
                    : 'from-blue-600 to-purple-600'
                } text-white`}>
                  Featured
                </Badge>
              )}
            </div>

            {/* Project Content */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2 line-clamp-1">
                  {project.title}
                </h3>
                <p 
                  className="text-sm text-muted-foreground mb-3 line-clamp-2"
                  style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                >
                  {project.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {project.live_url && (
                  <Button size="sm" className="flex-1 text-xs" asChild>
                    <a href={project.live_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="w-3 h-3 mr-1" />
                      {mode === 'professional' ? 'Live' : 'View'}
                    </a>
                  </Button>
                )}
                {project.github_url && (
                  <Button size="sm" variant="outline" className={`flex-1 text-xs border-2 ${
                    mode === 'creative'
                      ? 'border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-white'
                      : 'border-purple-500/50 text-purple-400 hover:bg-purple-500 hover:text-white'
                  }`} asChild>
                    <a href={project.github_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Github className="w-3 h-3 mr-1" />
                      Code
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
      
      {/* Swipe Instruction */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground text-center">
        ← Swipe left or right →
      </div>
    </div>
  );
};

export default TinderProjectCards;
