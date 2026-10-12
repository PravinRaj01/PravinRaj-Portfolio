import type { Mode } from '@/lib/modePath';

/** Pages the chat assistant is allowed to take a visitor to. Mirrors the backend's navigate_to tool. */
export type AssistantPage = 'home' | 'projects' | 'experience' | 'academic' | 'contact' | 'podcast';

/**
 * A navigation the assistant asked for, as sent by the backend's `action`
 * stream event (backend/app/services/chat_stream.py). Everything except `page`
 * is optional context for choosing the exact URL.
 */
export interface NavigateAction {
  page: AssistantPage;
  /** Set only if the visitor clearly asked for a specific side of the portfolio. */
  mode: Mode | null;
  /** Projects page: a technology or keyword to filter by. */
  search: string | null;
  /** A single project or experience to open directly (the backend only ever sends real slugs). */
  slug: string | null;
  /** The one-line message shown to the visitor. */
  announcement: string;
}

export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present on assistant replies that navigated the visitor, so the chip can re-open it. */
  action?: NavigateAction;
}
