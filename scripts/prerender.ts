// scripts/prerender.ts — SEO_GEO_PLAN.md Phases 2 + 3.
//
// Runs after `vite build` (wired as package.json's `postbuild`, invoked
// automatically by `bun run build`). For every real, currently-visible page
// it writes a static dist/<path>/index.html: the built shell with the right
// <title>/description/canonical/OG/Twitter tags, per-page JSON-LD, and a small
// semantic HTML summary in place of the empty <div id="root">. React's
// createRoot (src/main.tsx) replaces that content on load, so real users still
// get the normal SPA — this is purely so crawlers that don't run JavaScript
// (GPTBot, ClaudeBot, PerplexityBot, ...) see real content instead of an empty
// shell.
//
// Also writes dist/404.html (Vercel serves it, with a real 404 status, for any
// request matching neither a static file nor a rewrite/redirect),
// dist/sitemap.xml, dist/llms.txt and dist/llms-full.txt.
//
// All titles, descriptions, canonicals and JSON-LD come from src/lib/seo.ts —
// the same builders the page components use — so what's prerendered can't
// drift from what the live app sets.
//
// Hard-fails (non-zero exit) on any error, so a broken prerender fails the
// Vercel build instead of silently shipping a stale or partial dist/.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Mode, getModeHomePath, getModePath } from '../src/lib/modePath';
import {
  DEFAULT_IMAGE,
  SITE_DESCRIPTION,
  type PageMeta,
  academicMeta,
  buildSiteGraph,
  contactMeta,
  experienceListMeta,
  experienceMeta,
  folderMeta,
  homeMeta,
  notFoundMeta,
  playgroundMeta,
  podcastMeta,
  projectMeta,
  projectsListMeta,
} from '../src/lib/seo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const API_BASE_URL = process.env.PRERENDER_API_BASE_URL || 'https://api.pravinraj.dev/api/v1';

async function fetchJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${pathname}`);
  if (!response.ok) {
    throw new Error(`GET ${pathname} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

interface SiteSettingsModes {
  professional_mode_enabled: boolean;
  creative_mode_enabled: boolean;
  default_mode: string;
  professional_visible_pages: string[];
  creative_visible_pages: string[];
}

interface Dated {
  updated_at?: string | null;
  created_at?: string | null;
}

interface ProjectRow extends Dated {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  category?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  project_date?: string | null;
  github_url?: string | null;
  live_url?: string | null;
  image_drive_id?: string | null;
  folder_id?: string | null;
  is_active?: boolean;
}

interface FolderRow extends Dated {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

interface ExperienceRow extends Dated {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  company?: string | null;
  location?: string | null;
  period?: string | null;
  event_date?: string | null;
  role?: string | null;
}

interface SocialRow {
  url: string;
  enabled?: boolean | null;
}

type Kind = 'home' | 'list' | 'project' | 'folder' | 'experience' | 'page';

interface Target {
  kind: Kind;
  /** null for mode-neutral pages (playground). */
  mode: Mode | null;
  /** URL path, e.g. '/', '/pro/projects', '/creative/projects/my-app'. */
  urlPath: string;
  meta: PageMeta;
  lastmod?: string | null;
  /** Rendered as a <ul> of links inside <main>, for list-shaped pages. */
  links?: { href: string; label: string }[];
  /** Rendered as a single link back to the list page, for detail pages. */
  backLink?: { href: string; label: string };
  /** Short factual lines shown under the description (category, date, ...). */
  facts?: string[];
  /** Full untruncated text, for llms-full.txt. */
  fullText?: string;
}

/** Display form of a <title>: drops the trailing "— Pravin Raj …" site suffix. */
function shortTitle(title: string): string {
  return title.replace(/ — Pravin Raj (Portfolio|Muralitharan)$/, '');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** JSON for embedding in a <script> — `<` is escaped so it can't close the tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildSameAs(socials: SocialRow[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const social of socials) {
    if (social.enabled === false) continue;
    const url = (social.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result;
}

function projectFacts(project: ProjectRow): string[] {
  const facts: string[] = [];
  const category = project.category || project.categories?.[0];
  facts.push(
    `${category ? `A ${category} project` : 'A project'} by Pravin Raj Muralitharan${
      project.project_date ? ` (${project.project_date})` : ''
    }.`
  );
  if (project.tags && project.tags.length > 0) facts.push(`Tags: ${project.tags.join(', ')}.`);
  if (project.live_url) facts.push(`Live: ${project.live_url}`);
  if (project.github_url) facts.push(`Source: ${project.github_url}`);
  return facts;
}

async function buildTargets(): Promise<{ targets: Target[]; sameAs: string[]; defaultMode: Mode; modes: Mode[] }> {
  const [settings, socials] = await Promise.all([
    fetchJson<SiteSettingsModes>('/site-settings/modes'),
    fetchJson<SocialRow[]>('/socials'),
  ]);
  const defaultMode: Mode = settings.default_mode === 'creative' ? 'creative' : 'professional';
  const modes: Mode[] = [
    ...(settings.professional_mode_enabled ? (['professional'] as const) : []),
    ...(settings.creative_mode_enabled ? (['creative'] as const) : []),
  ];
  const visiblePages = (mode: Mode) =>
    mode === 'professional' ? settings.professional_visible_pages : settings.creative_visible_pages;

  const targets: Target[] = [];

  for (const mode of modes) {
    const [projects, folders, experiences] = await Promise.all([
      fetchJson<ProjectRow[]>(`/projects?mode=${mode}`),
      fetchJson<FolderRow[]>(`/project-folders?mode=${mode}`),
      fetchJson<ExperienceRow[]>(`/experiences?mode=${mode}`),
    ]);
    const activeProjects = projects.filter((p) => p.is_active !== false);
    const activeFolders = folders.filter((f) => f.is_active !== false);
    const pages = visiblePages(mode);
    const path_ = (suffix: string) => getModePath(mode, defaultMode, suffix);

    // The default mode's home is '/', the other mode's is '/<prefix>' —
    // getModeHomePath does the collapsing, so the two iterations naturally
    // produce two distinct home targets.
    targets.push({
      kind: 'home',
      mode,
      urlPath: getModeHomePath(mode, defaultMode),
      meta: { ...homeMeta(mode, defaultMode), image: DEFAULT_IMAGE },
      links: [
        { href: path_('/projects'), label: 'Projects' },
        { href: path_('/experience'), label: 'Experience' },
        { href: path_('/contact'), label: 'Contact' },
      ],
    });

    if (pages.includes('projects')) {
      targets.push({
        kind: 'list',
        mode,
        urlPath: path_('/projects'),
        meta: projectsListMeta(mode, defaultMode, activeProjects),
        links: activeProjects.map((p) => ({ href: path_(`/projects/${p.slug || p.id}`), label: p.title })),
      });

      for (const project of activeProjects) {
        const folder = activeFolders.find((f) => f.id === project.folder_id) ?? null;
        const meta = projectMeta(mode, defaultMode, project, folder);
        targets.push({
          kind: 'project',
          mode,
          urlPath: path_(`/projects/${project.slug || project.id}`),
          meta,
          lastmod: project.updated_at || project.created_at,
          backLink: { href: path_('/projects'), label: '← All projects' },
          facts: projectFacts(project),
          fullText: project.description,
        });
      }

      for (const folder of activeFolders) {
        const folderProjects = activeProjects.filter((p) => p.folder_id === folder.id);
        targets.push({
          kind: 'folder',
          mode,
          urlPath: path_(`/projects/folder/${folder.id}`),
          meta: folderMeta(mode, defaultMode, folder.id, folder, folderProjects),
          lastmod: folder.updated_at || folder.created_at,
          links: folderProjects.map((p) => ({ href: path_(`/projects/${p.slug || p.id}`), label: p.title })),
          fullText: folder.description ?? undefined,
        });
      }
    }

    if (pages.includes('experience')) {
      targets.push({
        kind: 'list',
        mode,
        urlPath: path_('/experience'),
        meta: experienceListMeta(mode, defaultMode, experiences),
        links: experiences.map((e) => ({ href: path_(`/experience/${e.slug || e.id}`), label: e.title })),
      });

      for (const exp of experiences) {
        const facts: string[] = [];
        if (exp.role) facts.push(`Role: ${exp.role}`);
        if (exp.company) facts.push(`${exp.company}${exp.location ? `, ${exp.location}` : ''}`);
        const when = exp.event_date || exp.period;
        if (when) facts.push(when);
        targets.push({
          kind: 'experience',
          mode,
          urlPath: path_(`/experience/${exp.slug || exp.id}`),
          meta: experienceMeta(mode, defaultMode, exp),
          lastmod: exp.updated_at || exp.created_at,
          backLink: { href: path_('/experience'), label: '← All experience' },
          facts,
          fullText: exp.description,
        });
      }
    }

    const simplePages: [string, PageMeta][] = [
      ['academic', academicMeta(mode, defaultMode)],
      ['contact', contactMeta(mode, defaultMode)],
      ['podcast', podcastMeta(mode, defaultMode)],
    ];
    for (const [pageId, meta] of simplePages) {
      if (pages.includes(pageId)) {
        targets.push({ kind: 'page', mode, urlPath: path_(`/${pageId}`), meta });
      }
    }
  }

  // Playground — mode-neutral, unprefixed, always indexable (SEO_GEO_PLAN.md §3).
  targets.push({ kind: 'page', mode: null, urlPath: '/playground', meta: playgroundMeta() });

  return { targets, sameAs: buildSameAs(socials), defaultMode, modes };
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, () => replacement) : html;
}

/** Points the shell's #site-jsonld at the live socials-derived sameAs list. */
function withSiteJsonLd(shell: string, sameAs: string[]): string {
  const block = `<script type="application/ld+json" id="site-jsonld">${jsonForScript(buildSiteGraph(sameAs))}</script>`;
  const pattern = /<script type="application\/ld\+json" id="site-jsonld">[\s\S]*?<\/script>/;
  if (!pattern.test(shell)) throw new Error('index.html has no #site-jsonld block to rewrite');
  return shell.replace(pattern, () => block);
}

function renderTarget(shell: string, target: Target): string {
  const { meta } = target;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = meta.image || DEFAULT_IMAGE;

  let html = shell;
  html = html.replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`);
  html = replaceTag(html, /<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`);
  html = replaceTag(html, /<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`);
  html = replaceTag(html, /<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`);
  html = replaceTag(html, /<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${meta.canonical}" />`);
  html = replaceTag(html, /<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${image}" />`);
  html = replaceTag(html, /<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`);
  html = replaceTag(html, /<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${description}" />`);
  html = replaceTag(html, /<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${image}" />`);

  // Canonical + per-page JSON-LD go just before </head>. usePageMeta finds
  // both by selector/id once JS runs and updates them in place.
  const headExtras = [`<link rel="canonical" href="${meta.canonical}" />`];
  if (meta.jsonLd) {
    headExtras.push(`<script type="application/ld+json" id="page-jsonld">${jsonForScript(meta.jsonLd)}</script>`);
  }
  html = html.replace('</head>', () => `    ${headExtras.join('\n    ')}\n  </head>`);

  const linksHtml = (target.links || [])
    .map((link) => `        <li><a href="${link.href}">${escapeHtml(link.label)}</a></li>`)
    .join('\n');
  const factsHtml = (target.facts || []).map((fact) => `        <li>${escapeHtml(fact)}</li>`).join('\n');
  const content = [
    `<header><h1>${escapeHtml(shortTitle(meta.title))}</h1></header>`,
    '<main>',
    `  <p>${description}</p>`,
    target.facts && target.facts.length > 0 ? `  <ul>\n${factsHtml}\n  </ul>` : '',
    target.links ? `  <ul>\n${linksHtml}\n  </ul>` : '',
    target.backLink ? `  <p><a href="${target.backLink.href}">${escapeHtml(target.backLink.label)}</a></p>` : '',
    '</main>',
  ]
    .filter(Boolean)
    .join('\n    ');

  // Visually hidden (same technique as Tailwind's `sr-only`), not display:none —
  // it stays ordinary text in the HTML for crawlers that don't run JS, but
  // people never see an unstyled flash of it before React replaces #root.
  // Inline styles because the app's stylesheet doesn't apply to this markup.
  const hiddenFromView =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0;';
  html = html.replace(
    '<div id="root"></div>',
    () => `<div id="root">\n    <div style="${hiddenFromView}">\n    ${content}\n    </div>\n  </div>`
  );
  return html;
}

function renderNotFound(shell: string): string {
  const meta = notFoundMeta();
  let html = shell;
  html = html.replace(/<title>.*?<\/title>/s, () => `<title>${escapeHtml(meta.title)}</title>`);
  html = replaceTag(
    html,
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  html = html.replace('</head>', () => `    <meta name="robots" content="${meta.robots}" />\n  </head>`);
  html = html.replace(
    '<div id="root"></div>',
    () =>
      [
        '<div id="root">',
        '    <main style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:sans-serif;">',
        '      <h1>404</h1>',
        '      <p>Oops! Page not found</p>',
        '      <a href="/">Return to Home</a>',
        '    </main>',
        '  </div>',
      ].join('\n')
  );
  return html;
}

function renderSitemap(targets: Target[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = targets
    .map((t) => {
      const lastmod = t.lastmod ? new Date(t.lastmod).toISOString().slice(0, 10) : today;
      return `  <url>\n    <loc>${t.meta.canonical}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const MODE_LABEL: Record<Mode, string> = { professional: 'Professional', creative: 'Creative' };

function oneLine(text: string, max = 155): string {
  const flat = text.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** llmstxt.org format: H1, blockquote summary, then H2 sections of links. */
function renderLlmsTxt(targets: Target[], modes: Mode[]): string {
  const lines = ['# Pravin Raj Muralitharan', '', `> ${SITE_DESCRIPTION}`, ''];
  lines.push(
    'This site has two sides: a Professional portfolio and a Creative one. Each page below lives at exactly one URL.',
    ''
  );

  for (const mode of modes) {
    const own = targets.filter((t) => t.mode === mode);
    const pages = own.filter((t) => t.kind === 'home' || t.kind === 'list' || t.kind === 'page');
    lines.push(`## ${MODE_LABEL[mode]} portfolio`, '');
    for (const page of pages) {
      lines.push(`- [${shortTitle(page.meta.title)}](${page.meta.canonical}): ${oneLine(page.meta.description)}`);
    }
    lines.push('');

    const projects = own.filter((t) => t.kind === 'project');
    if (projects.length > 0) {
      lines.push(`## ${MODE_LABEL[mode]} projects`, '');
      for (const p of projects) lines.push(`- [${shortTitle(p.meta.title)}](${p.meta.canonical}): ${oneLine(p.meta.description)}`);
      lines.push('');
    }

    const experiences = own.filter((t) => t.kind === 'experience');
    if (experiences.length > 0) {
      lines.push(`## ${MODE_LABEL[mode]} experience`, '');
      for (const e of experiences) lines.push(`- [${shortTitle(e.meta.title)}](${e.meta.canonical}): ${oneLine(e.meta.description)}`);
      lines.push('');
    }
  }

  const neutral = targets.filter((t) => t.mode === null);
  if (neutral.length > 0) {
    lines.push('## Optional', '');
    for (const t of neutral) lines.push(`- [${shortTitle(t.meta.title)}](${t.meta.canonical}): ${oneLine(t.meta.description)}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Full text of every project and experience, grouped by mode. */
function renderLlmsFullTxt(targets: Target[], modes: Mode[]): string {
  const lines = ['# Pravin Raj Muralitharan — full content', '', `> ${SITE_DESCRIPTION}`, ''];
  for (const mode of modes) {
    for (const [kind, heading] of [
      ['project', 'projects'],
      ['experience', 'experience'],
    ] as const) {
      const entries = targets.filter((t) => t.mode === mode && t.kind === kind);
      if (entries.length === 0) continue;
      lines.push(`## ${MODE_LABEL[mode]} ${heading}`, '');
      for (const entry of entries) {
        lines.push(`### ${shortTitle(entry.meta.title)}`, '', `URL: ${entry.meta.canonical}`, '');
        for (const fact of entry.facts || []) lines.push(`- ${fact}`);
        if (entry.facts && entry.facts.length > 0) lines.push('');
        if (entry.fullText) lines.push(entry.fullText.trim(), '');
      }
    }
  }
  return lines.join('\n');
}

async function main() {
  const { targets, sameAs, modes } = await buildTargets();
  const shell = withSiteJsonLd(await readFile(path.join(DIST_DIR, 'index.html'), 'utf-8'), sameAs);

  for (const target of targets) {
    const html = renderTarget(shell, target);
    const outFile =
      target.urlPath === '/'
        ? path.join(DIST_DIR, 'index.html')
        : path.join(DIST_DIR, target.urlPath.slice(1), 'index.html');
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, html, 'utf-8');
  }

  await writeFile(path.join(DIST_DIR, '404.html'), renderNotFound(shell), 'utf-8');
  await writeFile(path.join(DIST_DIR, 'sitemap.xml'), renderSitemap(targets), 'utf-8');
  await writeFile(path.join(DIST_DIR, 'llms.txt'), renderLlmsTxt(targets, modes), 'utf-8');
  await writeFile(path.join(DIST_DIR, 'llms-full.txt'), renderLlmsFullTxt(targets, modes), 'utf-8');

  console.log(
    `[prerender] wrote ${targets.length} pages + 404.html, sitemap.xml, llms.txt, llms-full.txt (sameAs: ${sameAs.length})`
  );
}

main().catch((error) => {
  console.error('[prerender] failed:', error);
  process.exit(1);
});
