import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isBraveBrowser } from '@/lib/speech';

// The Web Speech API's recognition half. It is free and needs no key, but it is
// only in Chromium browsers (as webkitSpeechRecognition) and Safari, and Chrome
// streams the audio to Google's speech service -- hence the explicit, tap-to-talk
// design below: nothing listens until the visitor presses the microphone.
// Firefox has no implementation, and Brave has the API but not the service behind
// it, so `supported` is false in both and the UI simply doesn't show a microphone.

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

const getRecognitionConstructor = (): RecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface UseSpeechRecognitionOptions {
  /** Called once with the full transcript when the visitor finishes speaking. */
  onFinalTranscript: (transcript: string) => void;
  /** Called with a SpeechRecognition error code ('not-allowed', 'no-speech', ...). */
  onError?: (code: string) => void;
}

export function useSpeechRecognition({ onFinalTranscript, onError }: UseSpeechRecognitionOptions) {
  const supported = useMemo(
    () =>
      getRecognitionConstructor() !== null &&
      !isBraveBrowser(typeof navigator === 'undefined' ? undefined : navigator),
    []
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');

  const recognition = useRef<Recognition | null>(null);
  const finalText = useRef('');
  const errorCode = useRef<string | null>(null);
  const cancelled = useRef(false);

  // Callers pass fresh closures every render; keep the latest without
  // re-creating start/stop (which would drop an active session).
  const handlers = useRef({ onFinalTranscript, onError });
  handlers.current = { onFinalTranscript, onError };

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor || recognition.current) return;

    const session = new Ctor();
    session.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    session.interimResults = true;
    session.continuous = false; // one utterance per press
    session.maxAlternatives = 1;

    finalText.current = '';
    errorCode.current = null;
    cancelled.current = false;

    session.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText.current += transcript;
        else interimText += transcript;
      }
      setInterim((finalText.current + interimText).trim());
    };

    session.onerror = (event) => {
      errorCode.current = event.error;
    };

    // Fires after a result, an error, stop() and abort() alike.
    session.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim('');
      if (cancelled.current) return;
      const text = finalText.current.trim();
      if (errorCode.current) handlers.current.onError?.(errorCode.current);
      else if (text) handlers.current.onFinalTranscript(text);
    };

    recognition.current = session;
    try {
      session.start();
      setListening(true);
    } catch {
      // e.g. start() called while a previous session is still shutting down
      recognition.current = null;
      handlers.current.onError?.('start-failed');
    }
  }, []);

  /** Finish now and send what was heard. */
  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  /** Abandon the session without sending anything. */
  const cancel = useCallback(() => {
    cancelled.current = true;
    recognition.current?.abort();
  }, []);

  useEffect(() => cancel, [cancel]);

  return { supported, listening, interim, start, stop, cancel };
}
