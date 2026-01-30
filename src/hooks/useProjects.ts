
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Project, ProjectLink } from '@/types/cms';

interface UseProjectsOptions {
  includeInactive?: boolean;
}

// Helper to properly parse project_links from JSON
const parseProjectLinks = (links: unknown): ProjectLink[] => {
  if (!links) return [];
  if (Array.isArray(links)) {
    return links.map(link => ({
      label: link.label || '',
      url: link.url || '',
      show_on_card: Boolean(link.show_on_card)
    }));
  }
  return [];
};

export const useProjects = (mode?: 'professional' | 'creative', options: UseProjectsOptions = {}) => {
  const { includeInactive = false } = options;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('projects')
        .select('*')
        .order('order_index', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (mode) {
        query = query.eq('mode', mode);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Parse project_links properly for each project
      const parsedProjects = (data || []).map(p => ({
        ...p,
        project_links: parseProjectLinks(p.project_links)
      })) as Project[];
      
      setProjects(parsedProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [mode]);

  const addProject = async (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([project])
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => [...prev, data]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add project');
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === id ? data : p));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update project');
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete project');
    }
  };

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects
  };
};
