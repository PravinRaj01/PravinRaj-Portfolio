
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface Social {
  id: string;
  name: string;
  icon: string;
  url: string;
  enabled: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const useSocials = () => {
  return useQuery({
    queryKey: ['socials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('socials')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as Social[];
    },
  });
};

export const useEnabledSocials = () => {
  return useQuery({
    queryKey: ['socials', 'enabled'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('socials')
        .select('*')
        .eq('enabled', true)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as Social[];
    },
  });
};

export const useUpdateSocial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Social> & { id: string }) => {
      const { data, error } = await supabase
        .from('socials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socials'] });
    },
  });
};

export const useCreateSocial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (social: Omit<Social, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('socials')
        .insert(social)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socials'] });
    },
  });
};

export const useDeleteSocial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('socials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socials'] });
    },
  });
};
