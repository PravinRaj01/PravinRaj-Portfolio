import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { speechTextFrom, splitForSpeech } from '@/lib/speech';

// The Web Speech API's synthesis half: the assistant's replies read aloud with
// the visitor's own device voices. Free, offline-capable, supported in every
// current browser. Off by default; the choice is remembered on this device.

const STORAGE_KEY = 'portfolio_chatbot_speak';

const readStoredPreference = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // private mode / blocked storage: just default to off
  }
};

export function useSpeechSynthesis() {
  const supported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance !== 'undefined',
    []
  );
  const [enabled, setEnabled] = useState<boolean>(readStoredPreference);
  const [speaking, setSpeaking] = useState(false);

  // Bumped on every speak()/cancel() so callbacks from an utterance that was
  // interrupted can't flip `speaking` for the one that replaced it.
  const generation = useRef(0);

  const cancel = useCallback(() => {
    generation.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /** Reads a reply aloud (markdown and button syntax are cleaned first). */
  const speak = useCallback(
    (markdown: string) => {
      if (!supported) return;
      const chunks = splitForSpeech(speechTextFrom(markdown));
      if (chunks.length === 0) return;

      window.speechSynthesis.cancel();
      const mine = ++generation.current;
      const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

      chunks.forEach((chunk, index) => {
        const utterance = new window.SpeechSynthesisUtterance(chunk);
        utterance.lang = lang;
        if (index === 0) {
          utterance.onstart = () => {
            if (generation.current === mine) setSpeaking(true);
          };
        }
        if (index === chunks.length - 1) {
          const finish = () => {
            if (generation.current === mine) setSpeaking(false);
          };
          utterance.onend = finish;
          utterance.onerror = finish;
        }
        window.speechSynthesis.speak(utterance);
      });
    },
    [supported]
  );

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* the preference just won't persist */
    }
    if (!next) cancel();
  }, [enabled, cancel]);

  useEffect(() => cancel, [cancel]);

  return { supported, enabled, speaking, speak, cancel, toggle };
}
