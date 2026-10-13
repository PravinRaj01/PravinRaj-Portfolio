// Pure helpers for the chatbot's voice features (AI v2, Phase 4). The browser
// APIs themselves live in hooks/useSpeechRecognition.ts and useSpeechSynthesis.ts.

/**
 * Turns an assistant reply (markdown plus the widget's `[button:Label](url)`
 * syntax) into text that sounds right when read aloud: no URLs, no markdown
 * symbols, and no action buttons (those are UI, not speech).
 */
export function speechTextFrom(markdown: string): string {
  return markdown
    .replace(/\[button:[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*\|?[\s:-]*\|[\s:|-]*$/gm, ' ') // table divider rows (|---|:--:|)
    .replace(/^\s*(?:#{1,6}|>|[-*+])\s+/gm, '')
    .replace(/[*`~|]+/g, ' ') // markdown symbols and table cell separators
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into utterance-sized pieces on sentence boundaries. Chrome stops
 * speaking a single long utterance after roughly 15 seconds, so replies are
 * queued as several short ones instead. (No regex lookbehind: older Safari
 * rejects it at parse time.)
 */
export function splitForSpeech(text: string, maxLength = 200): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
  const pieces: string[] = [];

  for (const raw of sentences) {
    let sentence = raw.trim();
    // A single sentence longer than the limit is cut at word boundaries.
    while (sentence.length > maxLength) {
      const cut = sentence.lastIndexOf(' ', maxLength);
      const at = cut > maxLength * 0.4 ? cut : maxLength;
      pieces.push(sentence.slice(0, at).trim());
      sentence = sentence.slice(at).trim();
    }
    if (sentence) pieces.push(sentence);
  }

  // Pack neighbouring sentences together up to the limit, so the voice doesn't
  // pause between every one.
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    if (last !== undefined && last.length + 1 + piece.length <= maxLength) {
      chunks[chunks.length - 1] = `${last} ${piece}`;
    } else {
      chunks.push(piece);
    }
  }
  return chunks;
}

/**
 * Brave exposes the speech API but disables the cloud service behind it, so
 * recognition always fails there with a "network" error. Better to offer no
 * microphone than one that can never work. Brave is the only browser that sets
 * `navigator.brave`, which is the documented way to detect it.
 */
export function isBraveBrowser(nav: unknown): boolean {
  return typeof nav === 'object' && nav !== null && 'brave' in nav;
}

/**
 * A visitor-facing message for a SpeechRecognition error code, or null when
 * the visitor needs no message (they stopped it themselves).
 */
export function friendlyRecognitionError(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return "Microphone access is blocked. Allow it in your browser's site settings to talk to the assistant.";
    case 'no-speech':
      return "I didn't hear anything. Tap the microphone and try again.";
    case 'audio-capture':
      return 'No microphone was found on this device.';
    case 'network':
      // Chrome and Edge stream the audio to their own cloud speech service; this means
      // it couldn't be reached. Say what usually causes that, and that typing works.
      return (
        "Your browser's speech service couldn't be reached. Voice input works in Chrome and Edge " +
        '(with online speech recognition turned on), but not in some browsers, VPNs or ad blockers. ' +
        'You can still type your message.'
      );
    case 'language-not-supported':
      return "Voice input isn't available for your browser's language.";
    default:
      return "Voice input isn't working right now.";
  }
}
