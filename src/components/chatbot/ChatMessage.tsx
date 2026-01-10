import { Bot, ExternalLink, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  role: string;
  content: string;
  isStreaming?: boolean;
  compact?: boolean;
}

// Parse button syntax: [button:Label](URL)
const parseButtons = (content: string) => {
  const buttonRegex = /\[button:([^\]]+)\]\(([^)]+)\)/g;
  const parts: Array<{ type: 'text' | 'button'; content?: string; label?: string; url?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = buttonRegex.exec(content)) !== null) {
    // Add text before the button
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // Add the button
    parts.push({ type: 'button', label: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last button
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text' as const, content }];
};

const ChatMessage = ({ role, content, isStreaming, compact = false }: ChatMessageProps) => {
  const isUser = role === "user";
  const parts = isUser ? [{ type: 'text' as const, content }] : parseButtons(content);

  const getButtonIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('download') || lowerLabel.includes('resume')) {
      return <Download className="w-3 h-3" />;
    }
    return <ExternalLink className="w-3 h-3" />;
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
          "rounded-2xl shadow-sm",
          compact ? "px-3 py-2 text-xs max-w-[90%]" : "px-4 py-3 max-w-[85%]",
          isUser
            ? "bg-primary/80 backdrop-blur-sm text-primary-foreground"
            : "bg-white/15 dark:bg-white/10 backdrop-blur-md border border-white/20"
        )}
      >
        <div
          className={cn(
            "prose max-w-none",
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
                  onClick={() => window.open(part.url, '_blank', 'noopener,noreferrer')}
                >
                  {getButtonIcon(part.label)}
                  {part.label}
                </Button>
              );
            }
            return (
              <ReactMarkdown
                key={index}
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
                    <li className="leading-relaxed pl-1">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground/95 block mt-3 first:mt-0 mb-1">
                      {children}
                    </strong>
                  ),
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {children}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className={cn(
                      "bg-background/50 rounded font-mono",
                      compact ? "px-1 py-0.5 text-xs" : "px-1.5 py-0.5 text-sm"
                    )}>
                      {children}
                    </code>
                  ),
                  hr: () => <hr className="my-3 border-white/20" />,
                }}
              >
                {part.content || ''}
              </ReactMarkdown>
            );
          })}
        </div>
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
