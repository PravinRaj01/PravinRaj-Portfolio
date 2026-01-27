import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { ProjectImageFolder } from '@/types/cms';

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
      const { data, error } = await supabase
        .from('project_image_folders')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setImageFolders(data || []);
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
    try {
      const { data, error } = await supabase
        .from('project_image_folders')
        .insert([folder])
        .select()
        .single();

      if (error) throw error;
      setImageFolders(prev => [...prev, data]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add image folder');
    }
  };

  const updateImageFolder = async (id: string, updates: Partial<ProjectImageFolder>) => {
    try {
      const { data, error } = await supabase
        .from('project_image_folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setImageFolders(prev => prev.map(f => f.id === id ? data : f));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update image folder');
    }
  };

  const deleteImageFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_image_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setImageFolders(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete image folder');
    }
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
