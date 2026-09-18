import { useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';

export interface ProjectFolder {
  id: string;
  name: string;
  description: string | null;
  cover_image_drive_id: string | null;
  mode: 'professional' | 'creative';
  order_index: number;
  created_at: string;
  updated_at: string;
  project_count?: number;
  is_active?: boolean;
}

interface UseProjectFoldersOptions {
  includeInactive?: boolean;
}

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11) --
// unlike earlier phases, every operation this hook needs now has a real
// backend endpoint, so there's no reason to keep any of it on Supabase.
export const useProjectFolders = (mode?: 'professional' | 'creative', options: UseProjectFoldersOptions = {}) => {
  const { includeInactive = false } = options;
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      // The backend computes project_count itself via one GROUP BY join
      // (MIGRATION_PLAN.md §1 finding 8 -- the original N+1 count query per
      // folder is gone). include_inactive is only honored when the caller
      // holds a valid admin token (apiClient attaches it automatically when
      // present); an unauthenticated request silently gets the public view.
      const data = await apiClient.get<ProjectFolder[]>('/project-folders', {
        params: { mode, include_inactive: includeInactive },
      });
      setFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, [mode]);

  const addFolder = async (folder: Omit<ProjectFolder, 'id' | 'created_at' | 'updated_at' | 'project_count'>) => {
    const data = await apiClient.post<ProjectFolder>('/project-folders', folder);
    setFolders(prev => [...prev, { ...data, project_count: 0 }]);
    return data;
  };

  const updateFolder = async (id: string, updates: Partial<ProjectFolder>) => {
    const data = await apiClient.patch<ProjectFolder>(`/project-folders/${id}`, updates);
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
    return data;
  };

  const deleteFolder = async (id: string) => {
    await apiClient.delete(`/project-folders/${id}`);
    setFolders(prev => prev.filter(f => f.id !== id));
  };

  const reorderFolders = async (reorderedFolders: ProjectFolder[]) => {
    const items = reorderedFolders.map((folder, index) => ({
      id: folder.id,
      order_index: index,
    }));

    // One request, one transaction on the backend, instead of the original
    // N sequential UPDATE calls (MIGRATION_PLAN.md §1 finding 8).
    await apiClient.put('/project-folders/reorder', items);

    setFolders(reorderedFolders.map((f, i) => ({ ...f, order_index: i })));
  };

  return {
    folders,
    loading,
    error,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
    refetch: fetchFolders,
  };
};
