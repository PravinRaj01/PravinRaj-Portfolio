
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface Social {
  id: string;
  name: string;
  icon: string;
  url: string;
  enabled: boolean;
  order_index: number;
  mode: 'professional' | 'creative';
  created_at: string;
  updated_at: string;
}

export const useSocials = (mode?: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['socials', mode],
    queryFn: async () => {
      return apiClient.get<Social[]>('/socials', { params: { mode } });
    },
  });
};

export const useEnabledSocials = (mode?: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['socials', 'enabled', mode],
    queryFn: async () => {
      return apiClient.get<Social[]>('/socials', { params: { mode, enabled_only: true } });
    },
  });
};

export const useUpdateSocial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Social> & { id: string }) => {
      return apiClient.patch<Social>(`/socials/${id}`, updates);
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
      return apiClient.post<Social>('/socials', social);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['socials'] });
      queryClient.invalidateQueries({ queryKey: ['socials', variables.mode] });
    },
  });
};

export const useDeleteSocial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/socials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socials'] });
    },
  });
};
