import { format, parse } from 'date-fns';

const FORMATS = ['d MMM yyyy', 'MMM d, yyyy', 'MMM yyyy', 'yyyy'];

// project_date is free text ("15 Oct 2026", "Oct 2026", "2026"); epoch if it cannot be read.
export const parseProjectDate = (value?: string | null): Date => {
  if (!value) return new Date(0);
  for (const pattern of FORMATS) {
    const date = parse(value, pattern, new Date());
    if (!isNaN(date.getTime())) return date;
  }
  return new Date(0);
};

interface DatedProject {
  project_date?: string | null;
  date_display?: 'month' | 'full' | null;
}

// What visitors see: the month only, unless the project is set to show the full date.
export const formatProjectDate = (project: DatedProject): string => {
  const raw = project.project_date;
  if (!raw) return '';
  const date = parseProjectDate(raw);
  if (date.getTime() === 0) return raw;
  return format(date, project.date_display === 'full' ? 'd MMM yyyy' : 'MMM yyyy');
};

// Newest-first comparator; equal dates fall back to when the project was added.
export const compareProjectDates = (
  a: { project_date?: string | null; created_at?: string },
  b: { project_date?: string | null; created_at?: string },
): number => {
  const diff = parseProjectDate(b.project_date).getTime() - parseProjectDate(a.project_date).getTime();
  if (diff !== 0) return diff;
  return (b.created_at ?? '').localeCompare(a.created_at ?? '');
};
