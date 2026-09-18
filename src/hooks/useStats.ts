
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { Stat } from '@/types/content';

export const useStats = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['stats', mode],
    queryFn: async () => {
      return apiClient.get<Stat[]>('/stats', { params: { mode } });
    },
  });
};

export const useCreateStat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stat: Omit<Stat, 'id' | 'created_at' | 'updated_at'>) => {
      return apiClient.post<Stat>('/stats', stat);
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
      return apiClient.patch<Stat>(`/stats/${id}`, stat);
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
      await apiClient.delete(`/stats/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};
