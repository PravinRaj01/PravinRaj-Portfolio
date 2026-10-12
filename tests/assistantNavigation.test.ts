// Run with: bun test tests/assistantNavigation.test.ts
// Pure-logic tests for the chat assistant's navigation (src/lib/assistantNavigation.ts).
// Lives outside src/ so the app's type-check and build never see `bun:test`.
import { describe, expect, test } from 'bun:test';
import {
  describeAction,
  parseNavigateAction,
  resolveNavigation,
  toInternalPath,
  type NavigationContext,
} from '../src/lib/assistantNavigation';
import type { NavigateAction } from '../src/types/chat';

const ctx = (over: Partial<NavigationContext> = {}): NavigationContext => ({
  mode: 'professional',
  defaultMode: 'professional',
  professionalModeEnabled: true,
  creativeModeEnabled: true,
  professionalVisiblePages: ['home', 'projects', 'experience', 'academic', 'contact'],
  creativeVisiblePages: ['home', 'projects', 'experience', 'contact', 'podcast'],
  ...over,
});

const action = (over: Partial<NavigateAction> = {}): NavigateAction => ({
  page: 'projects',
  mode: null,
  search: null,
  slug: null,
  announcement: 'Here you go!',
  ...over,
});

const event = (over: Record<string, unknown> = {}) => ({
  type: 'action',
  action: 'navigate',
  page: 'projects',
  mode: null,
  search: 'React',
  slug: null,
  announcement: 'Here are the React projects!',
  ...over,
});

describe('parseNavigateAction', () => {
  test('accepts the backend event', () => {
    expect(parseNavigateAction(event())).toEqual({
      page: 'projects', mode: null, search: 'React', slug: null, announcement: 'Here are the React projects!',
    });
  });

  test('rejects anything that is not a navigate action for a known page', () => {
    for (const bad of [null, 'x', 7, {}, event({ type: 'message' }), event({ action: 'delete' }),
      event({ page: 'admin' }), event({ page: '/admin' }), event({ page: ['projects'] }), event({ page: 3 })]) {
      expect(parseNavigateAction(bad)).toBeNull();
    }
  });

  test('keeps search only for projects, slugs only for projects and experience', () => {
    expect(parseNavigateAction(event({ page: 'contact', search: 'x', slug: 'abc' }))).toMatchObject({ search: null, slug: null });
    expect(parseNavigateAction(event({ page: 'experience', search: 'x', slug: 'acme' }))).toMatchObject({ search: null, slug: 'acme' });
  });

  test('drops unsafe slugs and unknown modes', () => {
    for (const slug of ['../admin', 'a/b', 'a b', '-x', 'x'.repeat(200), '<script>']) {
      expect(parseNavigateAction(event({ slug }))?.slug).toBeNull();
    }
    expect(parseNavigateAction(event({ mode: 'hacker' }))?.mode).toBeNull();
    expect(parseNavigateAction(event({ mode: 'creative' }))?.mode).toBe('creative');
  });

  test('cleans and caps free text, and supplies a default announcement', () => {
    const a = parseNavigateAction(event({ search: `re\n\tact ${'x'.repeat(200)}`, announcement: '   ' }))!;
    expect(a.search!.length).toBeLessThanOrEqual(60);
    expect(a.search!.startsWith('re act xxx')).toBe(true);
    expect(a.announcement).toBe('Taking you to the Projects page.');
  });
});

describe('resolveNavigation', () => {
  test('projects with a search term', () => {
    expect(resolveNavigation(action({ search: 'React' }), ctx())?.path).toBe('/pro/projects?search=React');
  });

  test('search terms are URL-encoded', () => {
    expect(resolveNavigation(action({ search: 'c# & .net' }), ctx())?.path).toBe('/pro/projects?search=c%23%20%26%20.net');
  });

  test('plain pages live under the mode prefix', () => {
    expect(resolveNavigation(action({ page: 'contact' }), ctx())?.path).toBe('/pro/contact');
    expect(resolveNavigation(action({ page: 'contact' }), ctx({ mode: 'creative' }))?.path).toBe('/creative/contact');
  });

  test('home is "/" for the default mode and the prefix for the other', () => {
    expect(resolveNavigation(action({ page: 'home' }), ctx())?.path).toBe('/');
    // "home" keeps the visitor in the mode they are in
    expect(resolveNavigation(action({ page: 'home' }), ctx({ mode: 'creative' }))?.path).toBe('/creative');
    // ...unless they asked for the other side
    expect(resolveNavigation(action({ page: 'home', mode: 'professional' }), ctx({ mode: 'creative' }))?.path).toBe('/');
    expect(resolveNavigation(action({ page: 'home' }), ctx({ mode: 'creative', defaultMode: 'creative' }))?.path).toBe('/');
  });

  test('a single item uses the unprefixed URL so the redirect finds its owning mode', () => {
    expect(resolveNavigation(action({ slug: 'viral-automator' }), ctx({ mode: 'creative' }))?.path).toBe('/projects/viral-automator');
    expect(resolveNavigation(action({ page: 'experience', slug: 'acme' }), ctx())?.path).toBe('/experience/acme');
  });

  test('an explicitly requested mode wins, including for a single item', () => {
    expect(resolveNavigation(action({ mode: 'creative', search: 'art' }), ctx())?.path).toBe('/creative/projects?search=art');
    expect(resolveNavigation(action({ mode: 'creative', slug: 'poster' }), ctx())?.path).toBe('/creative/projects/poster');
  });

  test('a page hidden in the current mode is found in another one', () => {
    // academic is only visible in professional
    expect(resolveNavigation(action({ page: 'academic' }), ctx({ mode: 'creative' }))?.path).toBe('/pro/academic');
    // podcast is only visible in creative
    expect(resolveNavigation(action({ page: 'podcast' }), ctx())?.path).toBe('/creative/podcast');
  });

  test('a requested mode that is off or hides the page falls back', () => {
    const noCreative = ctx({ creativeModeEnabled: false });
    expect(resolveNavigation(action({ mode: 'creative', search: 'x' }), noCreative)?.path).toBe('/pro/projects?search=x');
    expect(resolveNavigation(action({ page: 'podcast', mode: 'professional' }), ctx())?.path).toBe('/creative/podcast');
  });

  test('null when the page is not available anywhere', () => {
    const nowhere = ctx({ professionalVisiblePages: ['home'], creativeVisiblePages: ['home'] });
    expect(resolveNavigation(action({ page: 'podcast' }), nowhere)).toBeNull();
    expect(resolveNavigation(action({ page: 'projects', search: 'x' }), nowhere)).toBeNull();
    const both_off = ctx({ professionalModeEnabled: false, creativeModeEnabled: false });
    expect(resolveNavigation(action({ page: 'contact' }), both_off)).toBeNull();
  });
});

describe('describeAction', () => {
  test('reads naturally', () => {
    expect(describeAction(action({ search: 'React' }))).toBe('Open Projects · React');
    expect(describeAction(action({ slug: 'viral-automator' }))).toBe('Open project: viral automator');
    expect(describeAction(action({ page: 'experience', slug: 'acme-engineer' }))).toBe('Open experience: acme engineer');
    expect(describeAction(action({ page: 'contact' }))).toBe('Open Contact');
  });
});

describe('toInternalPath', () => {
  const origin = 'http://localhost:8080';
  test('same-origin and site links become in-app paths', () => {
    expect(toInternalPath('/projects', origin)).toBe('/projects');
    expect(toInternalPath('/pro/projects?search=react#top', origin)).toBe('/pro/projects?search=react#top');
    expect(toInternalPath('http://localhost:8080/experience/acme', origin)).toBe('/experience/acme');
    expect(toInternalPath('https://pravinraj.dev/pro/contact', origin)).toBe('/pro/contact');
  });

  test('everything else stays external', () => {
    for (const url of ['https://github.com/x', 'mailto:a@b.co', 'javascript:alert(1)', 'https://pravinraj.dev.evil.com/x', '//evil.com/x']) {
      expect(toInternalPath(url, origin)).toBeNull();
    }
  });
});
