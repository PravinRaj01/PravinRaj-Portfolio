
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { Education } from '@/types/academic';

export const useEducation = () => {
  return useQuery({
    queryKey: ['education'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('education')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as Education[];
    },
  });
};

export const useCreateEducation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (education: Omit<Education, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('education')
        .insert([education])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
    },
  });
};

export const useUpdateEducation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...education }: Partial<Education> & { id: string }) => {
      const { data, error } = await supabase
        .from('education')
        .update(education)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
    },
  });
};

export const useDeleteEducation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('education')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
    },
  });
};
