import React from 'react';
import { useProjects } from '@/hooks/useProjects';
import ProjectSlider from './ProjectSlider';

interface RecentProjectsProps {
  mode: 'professional' | 'creative';
}

const RecentProjects = ({ mode }: RecentProjectsProps) => {
  const { projects, loading } = useProjects(mode);
  
  // Filter projects that should show in recent (show_in_recent = true or undefined for backwards compatibility)
  // Then take first 5 for the slider
  const recentProjects = projects
    .filter(p => p.show_in_recent !== false)
    .sort((a, b) => (a.recent_order_index || 0) - (b.recent_order_index || 0));

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
