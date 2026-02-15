import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { MagazineIssue, MagazineContent } from '@/types/magazine';

export const useMagazine = () => {
  const [issue, setIssue] = useState<MagazineIssue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('magazine_issues')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setIssue({
            ...data,
            content: data.content as unknown as MagazineContent,
          } as MagazineIssue);
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
      const { data, error } = await supabase
        .from('magazine_issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues((data || []).map(d => ({
        ...d,
        content: d.content as unknown as MagazineContent,
      })) as MagazineIssue[]);
    } catch (err) {
      console.error('Failed to fetch magazine issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const publishIssue = async (id: string) => {
    // Unpublish all first, then publish the selected one
    await supabase.from('magazine_issues').update({ is_published: false }).eq('is_published', true);
    await supabase.from('magazine_issues').update({ is_published: true }).eq('id', id);
    await fetchIssues();
  };

  const unpublishIssue = async (id: string) => {
    await supabase.from('magazine_issues').update({ is_published: false }).eq('id', id);
    await fetchIssues();
  };

  const deleteIssue = async (id: string) => {
    await supabase.from('magazine_issues').delete().eq('id', id);
    await fetchIssues();
  };

  const saveIssue = async (issue: Omit<MagazineIssue, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('magazine_issues')
      .insert([issue])
      .select()
      .single();
    if (error) throw error;
    await fetchIssues();
    return data;
  };

  return { issues, loading, publishIssue, unpublishIssue, deleteIssue, saveIssue, refetch: fetchIssues };
};
