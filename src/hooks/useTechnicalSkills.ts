
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export interface TechnicalSkill {
  id: string;
  name: string;
  category: string;
  icon_url?: string;
  color: string;
  position_x: number;
  position_y: number;
  position_z: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useTechnicalSkills = () => {
  const [skills, setSkills] = useState<TechnicalSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technical_skills')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSkills(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch technical skills');
      // Enhanced fallback data with working icon URLs
      setSkills([
        {
          id: '1',
          name: 'React',
          category: 'Frontend',
          color: '#61DAFB',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'TypeScript',
          category: 'Frontend',
          color: '#3178C6',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'JavaScript',
          category: 'Frontend',
          color: '#F7DF1E',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '4',
          name: 'Python',
          category: 'Backend',
          color: '#3776AB',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '5',
          name: 'Node.js',
          category: 'Backend',
          color: '#339933',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '6',
          name: 'MongoDB',
          category: 'Database',
          color: '#47A248',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '7',
          name: 'Docker',
          category: 'DevOps',
          color: '#2496ED',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '8',
          name: 'AWS',
          category: 'Cloud',
          color: '#FF9900',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '9',
          name: 'Git',
          category: 'Tools',
          color: '#F05032',
          icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  return {
    skills,
    loading,
    error,
    refetch: fetchSkills
  };
};
