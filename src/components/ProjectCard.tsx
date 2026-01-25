
import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Github, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProjectCardProps {
  title: string;
  description: string;
  image: string;
  technologies: string[];
  liveUrl?: string;
  githubUrl?: string;
  featured?: boolean;
  mode: 'professional' | 'creative';
}

const ProjectCard = ({ 
  title, 
  description, 
  image, 
  technologies, 
  liveUrl, 
  githubUrl, 
  featured = false,
  mode 
}: ProjectCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className={`group relative overflow-hidden rounded-xl bg-card border border-border hover:shadow-2xl transition-all duration-300 ${
        featured ? 'md:col-span-2 lg:col-span-2' : ''
      }`}
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-48 md:h-64 object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Overlay buttons */}
        <div className="absolute inset-0 flex items-center justify-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {liveUrl && (
            <Button
              size="sm"
              className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30"
              data-hover="true"
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          )}
          {githubUrl && mode === 'professional' && (
            <Button
              size="sm"
              variant="outline"
              className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30"
              data-hover="true"
            >
              <Github className="w-4 h-4 mr-2" />
              Code
            </Button>
          )}
        </div>

        {featured && (
          <div className="absolute top-4 left-4">
            <Badge className={`bg-gradient-to-r ${
              mode === 'creative' 
                ? 'from-orange-500 to-orange-600' 
                : 'from-blue-600 to-purple-600'
            } text-white`}>
              Featured
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        <p 
          className="text-muted-foreground mb-4 line-clamp-3"
          style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
        >
          {description}
        </p>

        {/* Technologies */}
        <div className="flex flex-wrap gap-2 mb-4">
          {technologies.slice(0, 4).map((tech) => (
            <Badge
              key={tech}
              variant="secondary"
              className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {tech}
            </Badge>
          ))}
          {technologies.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{technologies.length - 4} more
            </Badge>
          )}
        </div>

        {/* Links */}
        <div className="flex items-center space-x-3">
          {liveUrl && (
            <Button
              size="sm"
              variant="outline"
              className="hover:bg-primary hover:text-primary-foreground"
              data-hover="true"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Live Demo
            </Button>
          )}
          {githubUrl && mode === 'professional' && (
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-muted"
              data-hover="true"
            >
              <Github className="w-4 h-4 mr-2" />
              Source
            </Button>
          )}
        </div>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 border border-primary/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </motion.div>
  );
};

export default ProjectCard;
