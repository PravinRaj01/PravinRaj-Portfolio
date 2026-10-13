import { ArrowRight, Bot, Compass, ExternalLink, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { describeAction, toInternalPath } from "@/lib/assistantNavigation";
import { useAssistantNavigation } from "@/hooks/useAssistantNavigation";
import type { NavigateAction } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  role: string;
  content: string;
  isStreaming?: boolean;
  compact?: boolean;
  /** Set on a reply that navigated the visitor; renders a chip to open it again. */
  action?: NavigateAction;
}

type MessagePart = { type: 'text' | 'button'; content?: string; label?: string; url?: string };

// The model writes button URLs, so they're untrusted: a prompt-injected
// `javascript:` or `data:` URL would otherwise be handed straight to
// window.open. Only these schemes (or site-relative paths, which resolve to
// the site's own origin) become clickable.
const SAFE_BUTTON_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

const safeButtonUrl =(raw: string): string | null => {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    const url = new URL(raw.trim(), base);
    return SAFE_BUTTON_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

// Appends text, merging into the previous text part so a rejected button's
// label stays inline with the sentence around it instead of becoming its own block.
const pushText = (parts: MessagePart[], text: string) => {
  const last = parts[parts.length - 1];
  if (last && last.type === 'text') {
    last.content = (last.content ?? '') + text;
  } else {
    parts.push({ type: 'text', content: text });
  }
};

// Parse button syntax: [button:Label](URL)
const parseButtons = (content: string): MessagePart[] => {
  const buttonRegex = /\[button:([^\]]+)\]\(([^)]+)\)/g;
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = buttonRegex.exec(content)) !== null) {
    // Add text before the button
    if (match.index > lastIndex) {
      pushText(parts, content.slice(lastIndex, match.index));
    }
    // Add the button -- or just its label when the URL isn't on the allowlist
    const url = safeButtonUrl(match[2]);
    if (url) {
      parts.push({ type: 'button', label: match[1], url });
    } else {
      pushText(parts, match[1]);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last button
  if (lastIndex < content.length) {
    pushText(parts, content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
};

const ChatMessage = ({ role, content, isStreaming, compact = false, action }: ChatMessageProps) => {
  const isUser = role === "user";
  const parts = isUser ? [{ type: 'text' as const, content }] : parseButtons(content);
  const navigate = useNavigate();
  const { open: openAction } = useAssistantNavigation();

  // Links to this site navigate inside the app; anything else opens a new tab.
  const openLink = (url: string) => {
    const internal = toInternalPath(url);
    if (internal) navigate(internal);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getButtonIcon = (label: string, url: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('download') || lowerLabel.includes('resume')) {
      return <Download className="w-3 h-3" />;
    }
    return toInternalPath(url) ? <ArrowRight className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />;
  };

  return (
    <div
      className={cn(
        "flex animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row",
        compact ? "gap-2" : "gap-3"
      )}
    >
      {!isUser && (
        <Avatar className={cn(
          "shrink-0 border border-primary/20 mt-1",
          compact ? "h-6 w-6" : "h-8 w-8"
        )}>
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-2xl shadow-sm overflow-hidden",
          compact ? "px-3 py-2 text-xs max-w-[90%]" : "px-4 py-3 max-w-[85%]",
          isUser
            ? "bg-primary/80 backdrop-blur-sm text-primary-foreground"
            : "bg-white/15 dark:bg-white/10 backdrop-blur-md border border-white/20"
        )}
      >
        <div
          className={cn(
            "prose max-w-none break-words overflow-hidden",
            compact ? "prose-xs" : "prose-sm",
            isUser ? "prose-invert" : "prose-slate dark:prose-invert",
            // Better spacing for assistant messages
            !isUser && "leading-relaxed"
          )}
        >
          {parts.map((part, index) => {
            if (part.type === 'button' && part.label && part.url) {
              return (
                <Button
                  key={index}
                  variant="secondary"
                  size="sm"
                  className={cn(
                    "inline-flex items-center gap-1.5 mt-2 mb-1",
                    compact ? "h-6 text-xs px-2" : "h-8 text-xs px-3"
                  )}
                  onClick={() => openLink(part.url as string)}
                >
                  {getButtonIcon(part.label, part.url)}
                  {part.label}
                </Button>
              );
            }
            return (
              <ReactMarkdown
                key={index}
                // remark-breaks keeps single line breaks (Shift+Enter in the chat box);
                // remark-gfm adds tables, ~~strikethrough~~, task lists and bare links.
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  p: ({ children }) => (
                    <p className={cn(
                      "leading-relaxed",
                      compact ? "mb-2 last:mb-0" : "mb-3 last:mb-0"
                    )}>
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className={cn(
                      "list-disc space-y-1.5",
                      compact ? "my-2 ml-4 pl-1" : "my-3 ml-5 pl-1"
                    )}>
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className={cn(
                      "list-decimal space-y-1.5",
                      compact ? "my-2 ml-4 pl-1" : "my-3 ml-5 pl-1"
                    )}>
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed pl-1 break-words">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground/95">
                      {children}
                    </strong>
                  ),
                  a: ({ href, children }) => {
                    const internal = href ? toInternalPath(href) : null;
                    return (
                      <a
                        href={href}
                        target={internal ? undefined : "_blank"}
                        rel={internal ? undefined : "noopener noreferrer"}
                        onClick={
                          internal
                            ? (e) => {
                                e.preventDefault();
                                navigate(internal);
                              }
                            : undefined
                        }
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {children}
                        {!internal && <ExternalLink className="w-3 h-3" />}
                      </a>
                    );
                  },
                  code: ({ children }) => (
                    <code className={cn(
                      "bg-background/50 rounded font-mono overflow-x-auto break-all",
                      compact ? "px-1 py-0.5 text-xs" : "px-1.5 py-0.5 text-sm"
                    )}>
                      {children}
                    </code>
                  ),
                  hr: () => <hr className="my-3 border-white/20" />,
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto">
                      <table className="w-full border-collapse text-left">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-white/20 px-2 py-1 font-semibold">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-white/20 px-2 py-1 align-top">{children}</td>
                  ),
                }}
              >
                {part.content || ''}
              </ReactMarkdown>
            );
          })}
        </div>
        {action && !isUser && (
          <button
            type="button"
            onClick={() => openAction(action)}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10",
              "hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
              compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
            )}
          >
            <Compass className="w-3 h-3" aria-hidden="true" />
            {describeAction(action)}
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
        {isStreaming && (
          <span className="inline-flex gap-1 ml-1 mt-2">
            <span className={cn("bg-current rounded-full animate-bounce [animation-delay:-0.3s]", compact ? "w-1 h-1" : "w-1.5 h-1.5")} />
            <span className={cn("bg-current rounded-full animate-bounce [animation-delay:-0.15s]", compact ? "w-1 h-1" : "w-1.5 h-1.5")} />
            <span className={cn("bg-current rounded-full animate-bounce", compact ? "w-1 h-1" : "w-1.5 h-1.5")} />
          </span>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
