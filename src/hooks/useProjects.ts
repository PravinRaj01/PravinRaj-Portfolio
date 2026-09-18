
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';
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

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11) --
// no Supabase import remains in this file. GET /projects now honors
// include_inactive for an authenticated admin (apiClient attaches the
// bearer token automatically when present); an unauthenticated caller
// passing the flag silently gets the public (active-only) view instead.
export const useProjects = (mode?: 'professional' | 'creative', options: UseProjectsOptions = {}) => {
  const { includeInactive = false } = options;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Project[]>('/projects', {
        params: { mode, include_inactive: includeInactive },
      });

      // Parse project_links properly for each project (defensive; a
      // harmless no-op for the already-validated API response).
      const parsedProjects = data.map(p => ({
        ...p,
        project_links: parseProjectLinks(p.project_links)
      }));

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
    const data = await apiClient.post<Project>('/projects', project);
    setProjects(prev => [...prev, data]);
    return data;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const data = await apiClient.patch<Project>(`/projects/${id}`, updates);
    setProjects(prev => prev.map(p => p.id === id ? data : p));
    return data;
  };

  const deleteProject = async (id: string) => {
    await apiClient.delete(`/projects/${id}`);
    setProjects(prev => prev.filter(p => p.id !== id));
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
