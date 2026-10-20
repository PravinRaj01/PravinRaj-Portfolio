import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/apiClient';
import type { RepoStatus } from '@/types/repoImport';

/**
 * Has each connected project's GitHub repository been pushed to since it was
 * last synced? One call per mode; the backend caches GitHub's answers for a few
 * minutes. Failures are non-fatal: the badges simply don't show "Updates
 * available". There is no automatic retry.
 */
export const useGithubSyncStatus = (mode: 'professional' | 'creative') => {
  const [statuses, setStatuses] = useState<Record<string, RepoStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const rows = await apiClient.get<RepoStatus[]>('/ai/repo-status', { params: { mode } });
      if (ticket !== latest.current) return; // a newer request (or a mode switch) superseded this one
      setStatuses(Object.fromEntries(rows.map((row) => [row.project_id, row])));
      setError(null);
    } catch (err) {
      if (ticket !== latest.current) return;
      setStatuses({});
      setError(err instanceof Error ? err.message : 'Could not check GitHub');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void refresh();
    return () => {
      latest.current += 1; // ignore a response that arrives after unmount / mode change
    };
  }, [refresh]);

  return { statuses, loading, error, refresh };
};
