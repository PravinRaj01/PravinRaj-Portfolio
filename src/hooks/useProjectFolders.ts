import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

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
}

export const useProjectFolders = (mode?: 'professional' | 'creative') => {
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('project_folders')
        .select('*')
        .order('order_index', { ascending: true });

      if (mode) {
        query = query.eq('mode', mode);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get project counts for each folder
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          const { count } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folder.id);

          return {
            ...folder,
            project_count: count || 0,
          } as ProjectFolder;
        })
      );

      setFolders(foldersWithCounts);
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
    try {
      const { data, error } = await supabase
        .from('project_folders')
        .insert([folder])
        .select()
        .single();

      if (error) throw error;
      setFolders(prev => [...prev, { ...data, project_count: 0 }]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add folder');
    }
  };

  const updateFolder = async (id: string, updates: Partial<ProjectFolder>) => {
    try {
      const { data, error } = await supabase
        .from('project_folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setFolders(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update folder');
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFolders(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete folder');
    }
  };

  const reorderFolders = async (reorderedFolders: ProjectFolder[]) => {
    try {
      const updates = reorderedFolders.map((folder, index) => ({
        id: folder.id,
        order_index: index,
      }));

      for (const update of updates) {
        await supabase
          .from('project_folders')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }

      setFolders(reorderedFolders.map((f, i) => ({ ...f, order_index: i })));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to reorder folders');
    }
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
