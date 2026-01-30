
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
      
      // Helper to parse start date from either event_date or period
      const getStartDate = (exp: Experience): Date => {
        const monthMap: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        
        // For single date type, use event_date
        if (exp.date_type === 'single' && exp.event_date) {
          const parts = exp.event_date.trim().split(' ');
          if (parts.length === 3) {
            // "15 Nov 2024" format
            return new Date(parseInt(parts[2]), monthMap[parts[1]] || 0, parseInt(parts[0]));
          }
          if (parts.length === 2) {
            // "Nov 2024" format
            return new Date(parseInt(parts[1]), monthMap[parts[0]] || 0, 1);
          }
        }
        
        // For range type or fallback, parse start date from period "15 Nov 2024 - 6 Dec 2024"
        if (exp.period) {
          const startPart = exp.period.split(' - ')[0].trim();
          const parts = startPart.split(' ');
          if (parts.length === 3) {
            // "15 Nov 2024" format
            return new Date(parseInt(parts[2]), monthMap[parts[1]] || 0, parseInt(parts[0]));
          }
          if (parts.length === 2) {
            // "Nov 2024" format
            return new Date(parseInt(parts[1]), monthMap[parts[0]] || 0, 1);
          }
        }
        
        return new Date(0);
      };

      // Sort experiences: by start date for creative mode (newest first), by order_index otherwise
      const sortedData = (data || []).sort((a, b) => {
        if (mode === 'creative') {
          const dateA = getStartDate(a);
          const dateB = getStartDate(b);
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
