
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { Skill } from '@/types/content';

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11) --
// no Supabase import remains in this file.
export const useSkills = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['skills', mode],
    queryFn: async () => {
      return apiClient.get<Skill[]>('/skills', { params: { mode } });
    },
  });
};

export const useCreateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => {
      return apiClient.post<Skill>('/skills', skill);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
};

export const useUpdateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...skill }: Partial<Skill> & { id: string }) => {
      return apiClient.patch<Skill>(`/skills/${id}`, skill);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
};

export const useDeleteSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
};
