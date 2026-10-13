import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the visitor presses Enter (without Shift). */
  onSubmit: () => void;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  /** Tallest the box grows before it scrolls, in px. */
  maxHeight?: number;
}

/**
 * The chat message box: a textarea that grows with its content.
 * Enter sends, Shift+Enter inserts a line break (the usual chat convention).
 */
const ChatComposerInput = forwardRef<HTMLTextAreaElement, ChatComposerInputProps>(
  ({ value, onChange, onSubmit, placeholder, readOnly, disabled, className, maxHeight = 140 }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [maxHeight]);

    // Re-measure whenever the text changes, including when it is set from outside
    // (cleared after sending, or live voice transcript).
    useLayoutEffect(resize, [value, resize]);
    useEffect(() => {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, [resize]);

    return (
      <Textarea
        ref={setRefs}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // isComposing: Enter confirms an IME candidate and must not send.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        aria-label="Message"
        className={cn("min-h-0 resize-none overflow-y-auto leading-normal", className)}
      />
    );
  }
);
ChatComposerInput.displayName = "ChatComposerInput";

export default ChatComposerInput;
