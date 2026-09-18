import { useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';
import { MagazineIssue } from '@/types/magazine';

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11).
export const useMagazine = () => {
  const [issue, setIssue] = useState<MagazineIssue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiClient.get<MagazineIssue | null>('/magazine/latest');
        if (data) {
          setIssue(data);
        }
      } catch (err) {
        console.error('Failed to fetch magazine:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { issue, loading };
};

export const useMagazineAdmin = () => {
  const [issues, setIssues] = useState<MagazineIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<MagazineIssue[]>('/magazine');
      setIssues(data);
    } catch (err) {
      console.error('Failed to fetch magazine issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const publishIssue = async (id: string) => {
    // One request, one transaction on the backend (unpublish whatever's
    // currently published + publish this one, both in the same commit) --
    // replaces the original two separate, non-atomic Supabase calls
    // (MIGRATION_PLAN.md §1 finding 8).
    await apiClient.post(`/magazine/${id}/publish`);
    await fetchIssues();
  };

  const unpublishIssue = async (id: string) => {
    await apiClient.post(`/magazine/${id}/unpublish`);
    await fetchIssues();
  };

  const deleteIssue = async (id: string) => {
    await apiClient.delete(`/magazine/${id}`);
    await fetchIssues();
  };

  const saveIssue = async (issue: Omit<MagazineIssue, 'id' | 'created_at' | 'updated_at'>) => {
    const data = await apiClient.post<MagazineIssue>('/magazine', issue);
    await fetchIssues();
    return data;
  };

  return { issues, loading, publishIssue, unpublishIssue, deleteIssue, saveIssue, refetch: fetchIssues };
};
