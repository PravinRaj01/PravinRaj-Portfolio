import { useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';
import { ProjectImageFolder } from '@/types/cms';

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11).
export const useProjectImageFolders = (projectId?: string) => {
  const [imageFolders, setImageFolders] = useState<ProjectImageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImageFolders = async () => {
    if (!projectId) {
      setImageFolders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiClient.get<ProjectImageFolder[]>(
        `/projects/${projectId}/image-folders`
      );
      setImageFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch image folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImageFolders();
  }, [projectId]);

  const addImageFolder = async (folder: Omit<ProjectImageFolder, 'id' | 'created_at' | 'updated_at'>) => {
    if (!projectId) throw new Error('projectId is required to add an image folder');
    const data = await apiClient.post<ProjectImageFolder>(
      `/projects/${projectId}/image-folders`,
      folder
    );
    setImageFolders(prev => [...prev, data]);
    return data;
  };

  const updateImageFolder = async (id: string, updates: Partial<ProjectImageFolder>) => {
    const data = await apiClient.patch<ProjectImageFolder>(`/image-folders/${id}`, updates);
    setImageFolders(prev => prev.map(f => f.id === id ? data : f));
    return data;
  };

  const deleteImageFolder = async (id: string) => {
    await apiClient.delete(`/image-folders/${id}`);
    setImageFolders(prev => prev.filter(f => f.id !== id));
  };

  return {
    imageFolders,
    loading,
    error,
    addImageFolder,
    updateImageFolder,
    deleteImageFolder,
    refetch: fetchImageFolders,
  };
};
