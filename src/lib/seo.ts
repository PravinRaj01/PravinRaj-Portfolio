// Shared page-meta + JSON-LD builders (SEO_GEO_PLAN.md §5/§6, Phase 3).
//
// Pure functions — no DOM, no React — so both the page components (via
// usePageMeta) and scripts/prerender.ts build a page's head from the exact
// same source. That's what keeps the prerendered HTML and the live SPA from
// drifting apart.
//
// Inputs are small structural types rather than src/types/cms.ts, so the
// prerender script's raw API rows fit them too.
import { Mode, SITE_URL, buildCanonical } from './modePath';

export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const PERSON_NAME = 'Pravin Raj Muralitharan';
export const SITE_DESCRIPTION =
  'AI Engineer & UI/UX Designer passionate about creating intelligent, user-centered digital experiences. Skilled in machine learning, visual design, and crafting intuitive interfaces.';

// Fallback profile links, used only when admin's socials list is empty.
export const FALLBACK_SAME_AS = [
  'https://www.linkedin.com/in/pravin-raj-muralitharan',
  'https://github.com/PravinRaj01',
];

type JsonLd = Record<string, unknown>;

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  robots?: string;
  jsonLd?: JsonLd | JsonLd[];
}

export interface ProjectLike {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  tags?: string[] | null;
  categories?: string[] | null;
  category?: string | null;
  github_url?: string | null;
  live_url?: string | null;
  image_drive_id?: string | null;
  folder_id?: string | null;
}

export interface FolderLike {
  id: string;
  name: string;
}

export interface ExperienceLike {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  company?: string | null;
}

interface Crumb {
  name: string;
  suffix: string;
}

function stripMarkdown(text: string): string {
  return text.replace(/[#*_`]/g, '');
}

/** Absolute URL for a project's image — same URL ProjectDetail has always used. */
export function projectImageUrl(project: Pick<ProjectLike, 'image_drive_id'>): string {
  const driveId = project.image_drive_id;
  if (!driveId) return DEFAULT_IMAGE;
  if (driveId.startsWith('http')) return driveId;
  return `https://drive.google.com/uc?export=view&id=${driveId}`;
}

function breadcrumbs(mode: Mode, defaultMode: Mode, crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', suffix: '/' }, ...crumbs].map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: buildCanonical(mode, defaultMode, crumb.suffix),
    })),
  };
}

function collectionPage(
  canonical: string,
  name: string,
  description: string,
  items: { name: string; url: string }[]
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': canonical,
    url: canonical,
    name,
    description,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': PERSON_ID },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

function webPage(type: string, canonical: string, name: string, description: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': canonical,
    url: canonical,
    name,
    description,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': PERSON_ID },
  };
}

/** Site-wide Person + WebSite graph — lives in index.html's #site-jsonld. */
export function buildSiteGraph(sameAs: string[]): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': PERSON_ID,
      name: PERSON_NAME,
      url: `${SITE_URL}/`,
      alternateName: ['Pravin Raj', 'Pravin Raj Portfolio', 'Pravin Raj Muralitharan Portfolio'],
      image: DEFAULT_IMAGE,
      jobTitle: 'AI Engineer & UI/UX Designer',
      description:
        'AI Engineer & UI/UX Designer passionate about creating intelligent, user-centered digital experiences.',
      knowsAbout: [
        'Artificial Intelligence',
        'Machine Learning',
        'UI/UX Design',
        'Computer Vision',
        'Natural Language Processing',
        'Deep Learning',
        'User Research',
        'Interaction Design',
        'Python',
        'React',
        'TypeScript',
        'Figma',
      ],
      sameAs: sameAs.length > 0 ? sameAs : FALLBACK_SAME_AS,
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universiti Malaya' },
      affiliation: { '@type': 'CollegeOrUniversity', name: 'Universiti Malaya' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Pravin Raj Portfolio',
      url: `${SITE_URL}/`,
      publisher: { '@id': PERSON_ID },
    },
  ];
}

export function homeMeta(mode: Mode, defaultMode: Mode): PageMeta {
  const canonical = buildCanonical(mode, defaultMode, '/');
  const title = 'Pravin Raj Muralitharan | AI Engineer & UI/UX Designer';
  return {
    title,
    description: SITE_DESCRIPTION,
    canonical,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': canonical,
      url: canonical,
      name: title,
      isPartOf: { '@id': WEBSITE_ID },
      // Inlined rather than a bare {'@id'} pointer: Google's ProfilePage check
      // requires mainEntity to be a Person with a name, and doesn't reliably
      // follow an @id across to the separate #site-jsonld block. Same @id as
      // the full Person there, so consumers still merge them into one entity.
      mainEntity: {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: PERSON_NAME,
        url: `${SITE_URL}/`,
        image: DEFAULT_IMAGE,
        jobTitle: 'AI Engineer & UI/UX Designer',
        description:
          'AI Engineer & UI/UX Designer passionate about creating intelligent, user-centered digital experiences.',
      },
    },
  };
}

export function projectsListMeta(mode: Mode, defaultMode: Mode, projects: ProjectLike[]): PageMeta {
  const canonical = buildCanonical(mode, defaultMode, '/projects');
  const title = 'Projects — Pravin Raj Muralitharan';
  const description =
    'Explore AI engineering and UI/UX design projects by Pravin Raj — from machine learning pipelines to polished product interfaces.';
  return {
    title,
    description,
    canonical,
    jsonLd: [
      collectionPage(
        canonical,
        title,
        description,
        projects.map((p) => ({
          name: p.title,
          url: buildCanonical(mode, defaultMode, `/projects/${p.slug || p.id}`),
        }))
      ),
      breadcrumbs(mode, defaultMode, [{ name: 'Projects', suffix: '/projects' }]),
    ],
  };
}

export function projectMeta(
  mode: Mode,
  defaultMode: Mode,
  project: ProjectLike | null,
  folder?: FolderLike | null
): PageMeta {
  if (!project) {
    return {
      title: 'Project — Pravin Raj Portfolio',
      description: 'Explore this project by Pravin Raj Muralitharan — AI Engineer & UI/UX Designer.',
      canonical: buildCanonical(mode, defaultMode, '/projects'),
    };
  }

  const suffix = `/projects/${project.slug || project.id}`;
  const canonical = buildCanonical(mode, defaultMode, suffix);
  const plain = stripMarkdown(project.description);
  const description = plain.slice(0, 155) + (project.description.length > 155 ? '…' : '');
  const image = projectImageUrl(project);
  const keywords = [...new Set([...(project.categories || []), ...(project.tags || [])])];
  if (keywords.length === 0 && project.category) keywords.push(project.category);

  const work: JsonLd = {
    '@context': 'https://schema.org',
    '@type': project.github_url ? 'SoftwareSourceCode' : 'CreativeWork',
    '@id': `${canonical}#work`,
    name: project.title,
    description: plain,
    url: canonical,
    image,
    author: { '@id': PERSON_ID },
    creator: { '@id': PERSON_ID },
    mainEntityOfPage: canonical,
  };
  if (keywords.length > 0) work.keywords = keywords.join(', ');
  if (project.github_url) work.codeRepository = project.github_url;
  if (project.live_url) work.sameAs = project.live_url;

  const crumbs: Crumb[] = [{ name: 'Projects', suffix: '/projects' }];
  if (folder) crumbs.push({ name: folder.name, suffix: `/projects/folder/${folder.id}` });
  crumbs.push({ name: project.title, suffix });

  return {
    title: `${project.title} — Pravin Raj Portfolio`,
    description,
    canonical,
    image,
    jsonLd: [work, breadcrumbs(mode, defaultMode, crumbs)],
  };
}

export function folderMeta(
  mode: Mode,
  defaultMode: Mode,
  folderId: string | undefined,
  folder: FolderLike | null,
  projects: ProjectLike[]
): PageMeta {
  const title = folder ? `${folder.name} — Pravin Raj Portfolio` : 'Project Folder — Pravin Raj Portfolio';
  const description = folder
    ? `Explore the ${folder.name} project folder by Pravin Raj Muralitharan — AI Engineer & UI/UX Designer.`
    : 'Explore this project folder by Pravin Raj Muralitharan — AI Engineer & UI/UX Designer.';
  const suffix = folderId ? `/projects/folder/${folderId}` : '/projects';
  const canonical = buildCanonical(mode, defaultMode, suffix);

  if (!folder) return { title, description, canonical };

  return {
    title,
    description,
    canonical,
    jsonLd: [
      collectionPage(
        canonical,
        title,
        description,
        projects.map((p) => ({
          name: p.title,
          url: buildCanonical(mode, defaultMode, `/projects/${p.slug || p.id}`),
        }))
      ),
      breadcrumbs(mode, defaultMode, [
        { name: 'Projects', suffix: '/projects' },
        { name: folder.name, suffix },
      ]),
    ],
  };
}

export function experienceListMeta(mode: Mode, defaultMode: Mode, experiences: ExperienceLike[]): PageMeta {
  const canonical = buildCanonical(mode, defaultMode, '/experience');
  const title = 'Experience — Pravin Raj Muralitharan';
  const description =
    'Professional experience and achievements of Pravin Raj — AI engineering roles, design work, and leadership across industry and academia.';
  return {
    title,
    description,
    canonical,
    jsonLd: [
      collectionPage(
        canonical,
        title,
        description,
        experiences.map((e) => ({
          name: e.title,
          url: buildCanonical(mode, defaultMode, `/experience/${e.slug || e.id}`),
        }))
      ),
      breadcrumbs(mode, defaultMode, [{ name: 'Experience', suffix: '/experience' }]),
    ],
  };
}

export function experienceMeta(mode: Mode, defaultMode: Mode, experience: ExperienceLike | null): PageMeta {
  if (!experience) {
    return {
      title: 'Experience — Pravin Raj Portfolio',
      description: 'Explore this experience by Pravin Raj Muralitharan — AI Engineer & UI/UX Designer.',
      canonical: buildCanonical(mode, defaultMode, '/experience'),
    };
  }

  const suffix = `/experience/${experience.slug || experience.id}`;
  const canonical = buildCanonical(mode, defaultMode, suffix);
  const plain = stripMarkdown(experience.description);
  const title = `${experience.title} — Pravin Raj Portfolio`;

  return {
    title,
    description: plain.slice(0, 155),
    canonical,
    jsonLd: [
      webPage('WebPage', canonical, experience.company ? `${experience.title} — ${experience.company}` : experience.title, plain),
      breadcrumbs(mode, defaultMode, [
        { name: 'Experience', suffix: '/experience' },
        { name: experience.title, suffix },
      ]),
    ],
  };
}

export function academicMeta(mode: Mode, defaultMode: Mode): PageMeta {
  const canonical = buildCanonical(mode, defaultMode, '/academic');
  const title = 'Academic — Pravin Raj Muralitharan';
  const description =
    'Academic background, education, and certifications of Pravin Raj — Computer Science at Universiti Malaya with a focus on AI and design.';
  return { title, description, canonical, jsonLd: webPage('WebPage', canonical, title, description) };
}

export function contactMeta(mode: Mode, defaultMode: Mode): PageMeta {
  const canonical = buildCanonical(mode, defaultMode, '/contact');
  const title = 'Contact — Pravin Raj Muralitharan';
  const description =
    'Get in touch with Pravin Raj — open to collaborations, opportunities, and exciting projects in AI engineering and UI/UX design.';
  return { title, description, canonical, jsonLd: webPage('ContactPage', canonical, title, description) };
}

export function podcastMeta(mode: Mode, defaultMode: Mode): PageMeta {
  const canonical = buildCanonical(mode, defaultMode, '/podcast');
  const title = 'Podcast — Pravin Raj Muralitharan';
  const description =
    'Listen to the Pravin Raj podcast — conversations on AI, creative technology, and the future of design.';
  return { title, description, canonical, jsonLd: webPage('WebPage', canonical, title, description) };
}

export function playgroundMeta(): PageMeta {
  const canonical = `${SITE_URL}/playground`;
  const title = 'Secret Arcade — Pravin Raj Muralitharan';
  const description =
    'A hidden arcade with mini-games — Terminal Quest and Neon Breakout — tucked inside the portfolio.';
  return { title, description, canonical, jsonLd: webPage('WebPage', canonical, title, description) };
}

export function notFoundMeta(): PageMeta {
  return {
    title: 'Page Not Found — Pravin Raj Muralitharan',
    description: 'The page you are looking for could not be found.',
    canonical: `${SITE_URL}/`,
    robots: 'noindex,follow',
  };
}
