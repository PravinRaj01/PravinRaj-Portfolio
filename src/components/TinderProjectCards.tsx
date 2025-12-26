
import React, { useState, useRef } from 'react';
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
  const [cards, setCards] = useState(projects);
  const [currentIndex, setCurrentIndex] = useState(0);
  const dragControls = useAnimation();

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
      }, 300);
    } else {
      // Snap back to center
      dragControls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 500, damping: 30 }
      });
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
          className="absolute inset-0 bg-card rounded-xl border-2 shadow-lg cursor-grab active:cursor-grabbing"
          style={{
            zIndex: cards.length - index,
            scale: 1 - index * 0.05,
            y: index * 10,
            rotateZ: index * 2,
          }}
          drag={index === 0 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={index === 0 ? handleDragEnd : undefined}
          animate={index === 0 ? dragControls : undefined}
          whileHover={index === 0 ? { scale: 1.02 } : {}}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <div className="h-full flex flex-col">
            {/* Project Image */}
            <div className="relative h-48 overflow-hidden rounded-t-xl">
              {project.image_drive_id ? (
                <img 
                  src={generateDriveImageUrl(project.image_drive_id, 'medium')} 
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
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
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {project.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs px-2 py-1"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {project.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-1">
                      +{project.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {project.live_url && (
                  <Button size="sm" className="flex-1 text-xs" asChild>
                    <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      {mode === 'professional' ? 'Live' : 'View'}
                    </a>
                  </Button>
                )}
                {project.github_url && (
                  <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                    <a href={project.github_url} target="_blank" rel="noopener noreferrer">
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
