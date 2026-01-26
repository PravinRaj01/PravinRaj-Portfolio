
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Experience } from '@/types/cms';

export const useExperience = (mode?: 'professional' | 'creative') => {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiences = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('experiences')
        .select('*');

      if (mode) {
        query = query.eq('mode', mode);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Sort experiences: by event_date for creative mode (newest first), by order_index otherwise
      const sortedData = (data || []).sort((a, b) => {
        if (mode === 'creative') {
          // Parse event_date for proper date comparison (format: "DD MMM YYYY" or similar)
          const dateA = a.event_date ? new Date(a.event_date) : new Date(0);
          const dateB = b.event_date ? new Date(b.event_date) : new Date(0);
          // Newest first (descending)
          return dateB.getTime() - dateA.getTime();
        }
        // Default: order_index descending
        return (b.order_index || 0) - (a.order_index || 0);
      });
      
      setExperiences(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch experiences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences();
  }, [mode]);

  const addExperience = async (experience: Omit<Experience, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('experiences')
        .insert([experience])
        .select()
        .single();

      if (error) throw error;
      setExperiences(prev => [...prev, data]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add experience');
    }
  };

  const updateExperience = async (id: string, updates: Partial<Experience>) => {
    try {
      const { data, error } = await supabase
        .from('experiences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setExperiences(prev => prev.map(e => e.id === id ? data : e));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update experience');
    }
  };

  const deleteExperience = async (id: string) => {
    try {
      const { error } = await supabase
        .from('experiences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setExperiences(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete experience');
    }
  };

  return {
    experiences,
    loading,
    error,
    addExperience,
    updateExperience,
    deleteExperience,
    refetch: fetchExperiences
  };
};
