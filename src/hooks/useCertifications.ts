
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { Certification } from '@/types/academic';

export const useCertifications = () => {
  return useQuery({
    queryKey: ['certifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as Certification[];
    },
  });
};

export const useCreateCertification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (certification: Omit<Certification, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('certifications')
        .insert([certification])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
};

export const useUpdateCertification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...certification }: Partial<Certification> & { id: string }) => {
      const { data, error } = await supabase
        .from('certifications')
        .update(certification)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
};

export const useDeleteCertification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('certifications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
};
