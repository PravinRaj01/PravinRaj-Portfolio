import { useEffect } from 'react';

const DEFAULT_TITLE = 'Pravin Raj Muralitharan | AI Engineer & UI/UX Designer';
const DEFAULT_DESCRIPTION =
  'AI Engineer & UI/UX Designer passionate about creating intelligent, user-centered digital experiences. Skilled in machine learning, visual design, and crafting intuitive interfaces.';
const DEFAULT_IMAGE = 'https://pravinraj.dev/og-image.png';
const DEFAULT_URL = 'https://pravinraj.dev/';

interface PageMetaOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
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

export function usePageMeta({ title, description, image, url }: PageMetaOptions) {
  useEffect(() => {
    const resolvedImage = image || DEFAULT_IMAGE;
    const resolvedUrl = url || DEFAULT_URL;

    // Document title
    document.title = title;

    // Standard meta
    setMeta('meta[name="description"]', 'content', description);

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
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', 'content', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:title"]', 'content', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', 'content', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:url"]', 'content', DEFAULT_URL);
      setMeta('meta[property="og:image"]', 'content', DEFAULT_IMAGE);
      setMeta('meta[name="twitter:title"]', 'content', DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', 'content', DEFAULT_DESCRIPTION);
      setMeta('meta[name="twitter:image"]', 'content', DEFAULT_IMAGE);
    };
  }, [title, description, image, url]);
}
