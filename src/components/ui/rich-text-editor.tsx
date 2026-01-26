import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Bold, Italic, Underline, List, ListOrdered, Heading2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip";

export interface RichTextEditorProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

const RichTextEditor = React.forwardRef<HTMLTextAreaElement, RichTextEditorProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    
    // Merge refs
    React.useImperativeHandle(ref, () => textareaRef.current!);

    const insertMarkdown = (prefix: string, suffix: string = prefix) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      
      let newText: string;
      let newCursorPos: number;

      if (selectedText) {
        // Wrap selected text
        newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
        newCursorPos = end + prefix.length + suffix.length;
      } else {
        // Insert placeholder
        newText = value.substring(0, start) + prefix + suffix + value.substring(end);
        newCursorPos = start + prefix.length;
      }

      onChange(newText);
      
      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    };

    const insertAtLineStart = (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      
      const newText = value.substring(0, lineStart) + prefix + value.substring(lineStart);
      onChange(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    };

    const formatButtons = [
      { 
        icon: Bold, 
        label: "Bold", 
        action: () => insertMarkdown("**"),
        shortcut: "Ctrl+B"
      },
      { 
        icon: Italic, 
        label: "Italic", 
        action: () => insertMarkdown("*"),
        shortcut: "Ctrl+I"
      },
      { 
        icon: Underline, 
        label: "Underline", 
        action: () => insertMarkdown("<u>", "</u>"),
        shortcut: "Ctrl+U"
      },
      { 
        icon: Heading2, 
        label: "Heading", 
        action: () => insertAtLineStart("## "),
        shortcut: ""
      },
      { 
        icon: List, 
        label: "Bullet List", 
        action: () => insertAtLineStart("- "),
        shortcut: ""
      },
      { 
        icon: ListOrdered, 
        label: "Numbered List", 
        action: () => insertAtLineStart("1. "),
        shortcut: ""
      },
    ];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            insertMarkdown("**");
            break;
          case 'i':
            e.preventDefault();
            insertMarkdown("*");
            break;
          case 'u':
            e.preventDefault();
            insertMarkdown("<u>", "</u>");
            break;
        }
      }
    };

    return (
      <TooltipProvider>
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center gap-1 p-1 border border-input rounded-md bg-background">
            {formatButtons.map((button) => (
              <Tooltip key={button.label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={button.action}
                  >
                    <button.icon className="h-4 w-4" />
                    <span className="sr-only">{button.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{button.label}{button.shortcut && ` (${button.shortcut})`}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className={cn(
              "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono",
              className
            )}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            {...props}
          />

          {/* Help text */}
          <p className="text-xs text-muted-foreground">
            Supports Markdown: **bold**, *italic*, &lt;u&gt;underline&lt;/u&gt;, ## heading, - list
          </p>
        </div>
      </TooltipProvider>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";

export { RichTextEditor };
