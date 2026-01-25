
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { AboutContent } from '@/types/content';

export const useAboutContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['about-content', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('about_content')
        .select('*')
        .eq('mode', mode)
        .order('order_index');
      
      if (error) throw error;
      return data as AboutContent[];
    },
  });
};

export const useCreateAboutContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (content: Omit<AboutContent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('about_content')
        .insert(content)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about-content'] });
    },
  });
};

export const useUpdateAboutContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...content }: Partial<AboutContent> & { id: string }) => {
      const { data, error } = await supabase
        .from('about_content')
        .update(content)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about-content'] });
    },
  });
};

export const useDeleteAboutContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('about_content')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about-content'] });
    },
  });
};
