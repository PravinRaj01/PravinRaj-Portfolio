// Run with: bun test tests/speech.test.ts
// Pure-logic tests for the chatbot's voice helpers (src/lib/speech.ts).
import { describe, expect, test } from 'bun:test';
import { friendlyRecognitionError, isBraveBrowser, speechTextFrom, splitForSpeech } from '../src/lib/speech';

describe('speechTextFrom', () => {
  test('drops action buttons and urls, keeps link text', () => {
    expect(
      speechTextFrom("Here's the resume! [button:Download Resume](https://x.dev/cv.pdf) See [my GitHub](https://github.com/x) or https://example.com/page now.")
    ).toBe("Here's the resume! See my GitHub or now.");
  });

  test('removes markdown symbols but keeps the words', () => {
    expect(speechTextFrom('## Skills\n- **Python** and `FastAPI`\n- ~~Java~~ React\n> quoted line')).toBe(
      'Skills Python and FastAPI Java React quoted line'
    );
  });

  test('keeps ordinary punctuation, numbers and hyphenated words', () => {
    expect(speechTextFrom('Built in 2024 - a full-stack app (v2.1), 3 users.')).toBe('Built in 2024 - a full-stack app (v2.1), 3 users.');
  });

  test('an image or empty input yields nothing to say', () => {
    expect(speechTextFrom('![logo](https://x.dev/l.png)')).toBe('');
    expect(speechTextFrom('   ')).toBe('');
  });
});

describe('splitForSpeech', () => {
  test('short text is a single chunk', () => {
    expect(splitForSpeech('Hello there. How can I help?')).toEqual(['Hello there. How can I help?']);
  });

  test('long text is split on sentence boundaries within the limit', () => {
    const sentence = 'This is a reasonably long sentence about portfolio projects and skills.';
    const chunks = splitForSpeech(Array(8).fill(sentence).join(' '), 150);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(150);
    expect(chunks.join(' ')).toBe(Array(8).fill(sentence).join(' '));
  });

  test('one huge sentence is cut at word boundaries', () => {
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitForSpeech(words, 100);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
    expect(chunks.join(' ')).toBe(words);
    for (const c of chunks) expect(c.startsWith(' ') || c.endsWith(' ')).toBe(false);
  });

  test('empty and whitespace-only input', () => {
    expect(splitForSpeech('')).toEqual([]);
    expect(splitForSpeech('  \n ')).toEqual([]);
  });

  test('text without terminal punctuation is kept', () => {
    expect(splitForSpeech('no punctuation here')).toEqual(['no punctuation here']);
  });
});

describe('friendlyRecognitionError', () => {
  test('a visitor-cancelled recognition shows nothing', () => {
    expect(friendlyRecognitionError('aborted')).toBeNull();
  });

  test('known codes get a helpful message', () => {
    expect(friendlyRecognitionError('not-allowed')).toContain('Microphone access is blocked');
    expect(friendlyRecognitionError('service-not-allowed')).toContain('Microphone access is blocked');
    expect(friendlyRecognitionError('no-speech')).toContain("didn't hear");
    expect(friendlyRecognitionError('audio-capture')).toContain('No microphone');
    const network = friendlyRecognitionError('network') as string;
    expect(network).toContain("speech service couldn't be reached");
    expect(network).toContain('Chrome and Edge');
    expect(network).toContain('type your message'); // always tells the visitor typing still works
  });

  test('unknown codes fall back to a generic message', () => {
    expect(friendlyRecognitionError('something-new')).toBe("Voice input isn't working right now.");
  });
});

describe('isBraveBrowser', () => {
  test('Brave is the only browser that defines navigator.brave', () => {
    expect(isBraveBrowser({ brave: { isBrave: async () => true } })).toBe(true);
    expect(isBraveBrowser({ userAgent: 'Mozilla/5.0 Chrome/130' })).toBe(false);
    expect(isBraveBrowser({})).toBe(false);
  });

  test('anything that is not an object is not Brave', () => {
    expect(isBraveBrowser(undefined)).toBe(false);
    expect(isBraveBrowser(null)).toBe(false);
    expect(isBraveBrowser('brave')).toBe(false);
  });
});
