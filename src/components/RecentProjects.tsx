import React from 'react';
import { useProjects } from '@/hooks/useProjects';
import ProjectSlider from './ProjectSlider';

interface RecentProjectsProps {
  mode: 'professional' | 'creative';
}

const RecentProjects = ({ mode }: RecentProjectsProps) => {
  const { projects, loading } = useProjects(mode);
  
  // Show only the first 5 projects for the slider
  const recentProjects = projects.slice(0, 5);

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        </div>
      </section>
    );
  }

  return <ProjectSlider projects={recentProjects} mode={mode} />;
};

export default RecentProjects;
