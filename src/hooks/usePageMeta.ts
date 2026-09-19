import { useEffect } from 'react';

const DEFAULT_TITLE = 'Pravin Raj Muralitharan | AI Engineer & UI/UX Designer';
const DEFAULT_DESCRIPTION =
  'AI Engineer & UI/UX Designer passionate about creating intelligent, user-centered digital experiences. Skilled in machine learning, visual design, and crafting intuitive interfaces.';
const DEFAULT_IMAGE = 'https://pravinraj.dev/og-image.png';
const DEFAULT_URL = 'https://pravinraj.dev/';
const DEFAULT_ROBOTS = 'index,follow';

interface PageMetaOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
  /** Self-referencing canonical URL for this page. Defaults to `url`. */
  canonical?: string;
  /** e.g. 'noindex,nofollow' for pages that shouldn't be indexed. */
  robots?: string;
  /** Page-level structured data (see src/lib/seo.ts). Replaces #page-jsonld. */
  jsonLd?: object | object[];
}

const PAGE_JSONLD_ID = 'page-jsonld';

function setPageJsonLd(jsonLd: object | object[] | undefined) {
  const existing = document.getElementById(PAGE_JSONLD_ID);
  if (!jsonLd) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement('script');
  el.id = PAGE_JSONLD_ID;
  el.setAttribute('type', 'application/ld+json');
  el.textContent = JSON.stringify(jsonLd);
  if (!existing) document.head.appendChild(el);
}

function setMeta(selector: string, attr: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    const [attrName, attrValue] = selector
      .replace('meta[', '')
      .replace(']', '')
      .split('="');
    el.setAttribute(attrName, attrValue.replace('"', ''));
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function usePageMeta({ title, description, image, url, canonical, robots, jsonLd }: PageMetaOptions) {
  // Serialized so callers can pass a freshly built object every render
  // without re-running the effect.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const resolvedImage = image || DEFAULT_IMAGE;
    const resolvedUrl = url || canonical || DEFAULT_URL;
    const resolvedCanonical = canonical || resolvedUrl;
    const resolvedRobots = robots || DEFAULT_ROBOTS;

    setPageJsonLd(jsonLdKey ? JSON.parse(jsonLdKey) : undefined);

    // Document title
    document.title = title;

    // Standard meta
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[name="robots"]', 'content', resolvedRobots);
    setCanonical(resolvedCanonical);

    // Open Graph
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', resolvedUrl);
    setMeta('meta[property="og:image"]', 'content', resolvedImage);

    // Twitter
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', resolvedImage);

    // Restore defaults on unmount
    return () => {
      setPageJsonLd(undefined);
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', 'content', DEFAULT_DESCRIPTION);
      setMeta('meta[name="robots"]', 'content', DEFAULT_ROBOTS);
      setCanonical(DEFAULT_URL);
      setMeta('meta[property="og:title"]', 'content', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', 'content', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:url"]', 'content', DEFAULT_URL);
      setMeta('meta[property="og:image"]', 'content', DEFAULT_IMAGE);
      setMeta('meta[name="twitter:title"]', 'content', DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', 'content', DEFAULT_DESCRIPTION);
      setMeta('meta[name="twitter:image"]', 'content', DEFAULT_IMAGE);
    };
  }, [title, description, image, url, canonical, robots, jsonLdKey]);
}
