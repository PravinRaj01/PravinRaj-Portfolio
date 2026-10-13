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

/** How long a stop may take to be confirmed by the speech service before we force it. */
const STOP_GRACE_MS = 1200;

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
  // Everything heard so far in this session: finished phrases plus the phrase in progress.
  const heardText = useRef('');
  const errorCode = useRef<string | null>(null);
  const cancelled = useRef(false);
  // True between the visitor tapping stop and the speech service confirming it.
  const stopping = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callers pass fresh closures every render; keep the latest without
  // re-creating start/stop (which would drop an active session).
  const handlers = useRef({ onFinalTranscript, onError });
  handlers.current = { onFinalTranscript, onError };

  /**
   * Ends `session` exactly once, from whichever comes first: the service's own
   * `onend`, the stop fallback below, or a cancel. Late events from a session
   * that has already been finished are ignored everywhere else.
   */
  const finish = useCallback((session: Recognition) => {
    if (recognition.current !== session) return;
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    recognition.current = null;
    stopping.current = false;
    setListening(false);
    setInterim('');
    if (cancelled.current) return;
    const text = heardText.current.trim();
    if (errorCode.current) handlers.current.onError?.(errorCode.current);
    else if (text) handlers.current.onFinalTranscript(text);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor) return;

    if (recognition.current) {
      if (!stopping.current) return; // already listening
      // The previous session is still winding down after a stop: wrap it up now.
      const old = recognition.current;
      try {
        old.abort();
      } catch {
        // already ended
      }
      finish(old);
    }

    const session = new Ctor();
    session.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    session.interimResults = true;
    session.continuous = false; // one utterance per press
    session.maxAlternatives = 1;

    heardText.current = '';
    errorCode.current = null;
    cancelled.current = false;
    stopping.current = false;

    let finalPart = '';
    session.onresult = (event) => {
      if (recognition.current !== session) return;
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalPart += transcript;
        else interimText += transcript;
      }
      heardText.current = (finalPart + interimText).trim();
      setInterim(heardText.current);
    };

    session.onerror = (event) => {
      if (recognition.current !== session) return;
      // abort() reports 'aborted'; when we aborted a slow stop on purpose that is not a failure.
      if (event.error === 'aborted' && stopping.current) return;
      errorCode.current = event.error;
    };

    // Fires after a result, an error, stop() and abort() alike.
    session.onend = () => finish(session);

    recognition.current = session;
    try {
      session.start();
      setListening(true);
    } catch {
      // e.g. start() called while a previous session is still shutting down
      recognition.current = null;
      handlers.current.onError?.('start-failed');
    }
  }, [finish]);

  /**
   * Finish now and send what was heard. The button reacts at once; the browser's
   * service can take a while to finalise (or never answer), so after a short
   * grace period the session is aborted and the text heard so far is sent.
   */
  const stop = useCallback(() => {
    const session = recognition.current;
    if (!session || stopping.current) return;
    stopping.current = true;
    setListening(false);
    try {
      session.stop();
    } catch {
      // already ended
    }
    stopTimer.current = setTimeout(() => {
      try {
        session.abort();
      } catch {
        // already ended
      }
      finish(session);
    }, STOP_GRACE_MS);
  }, [finish]);

  /** Abandon the session without sending anything. */
  const cancel = useCallback(() => {
    cancelled.current = true;
    const session = recognition.current;
    if (!session) return;
    try {
      session.abort();
    } catch {
      // already ended
    }
    finish(session);
  }, [finish]);

  useEffect(() => cancel, [cancel]);

  return { supported, listening, interim, start, stop, cancel };
}
