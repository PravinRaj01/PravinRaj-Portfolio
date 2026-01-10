
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { Stat } from '@/types/content';

export const useStats = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['stats', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stats')
        .select('*')
        .eq('mode', mode)
        .order('order_index');
      
      if (error) throw error;
      return data as Stat[];
    },
  });
};

export const useCreateStat = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stat: Omit<Stat, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('stats')
        .insert(stat)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};

export const useUpdateStat = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...stat }: Partial<Stat> & { id: string }) => {
      const { data, error } = await supabase
        .from('stats')
        .update(stat)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};

export const useDeleteStat = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stats')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};
