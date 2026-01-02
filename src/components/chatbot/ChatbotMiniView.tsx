import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Maximize2, X, Send, Loader2, Settings2 } from "lucide-react";
import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Sparkles } from "lucide-react";
import { CardHeader, CardContent } from "@/components/ui/card";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { cn } from "@/lib/utils";
import { ChatbotContentMode } from "./ChatbotDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatbotMiniViewProps {
  messages: any[];
  streamingMessage: string;
  streaming: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onExpandToSidebar: () => void;
  onQuickAction: (message: string) => void;
  onClose: () => void;
  contentMode: ChatbotContentMode;
  onContentModeChange: (mode: ChatbotContentMode) => void;
  showModeSelector: boolean;
}

const ChatbotMiniView = ({
  messages,
  streamingMessage,
  streaming,
  input,
  onInputChange,
  onSend,
  onExpandToSidebar,
  onQuickAction,
  onClose,
  contentMode,
  onContentModeChange,
  showModeSelector,
}: ChatbotMiniViewProps) => {
  const lastTwoMessages = messages?.slice(-2) || [];
  const { mode } = usePortfolio();
  
  // Mode-aware colors
  const sendButtonClass = mode === 'creative'
    ? 'bg-orange-500/80 hover:bg-orange-500'
    : 'bg-primary/80 hover:bg-primary';
  const avatarGradient = mode === 'creative'
    ? 'bg-gradient-to-br from-orange-500/80 to-orange-600/80'
    : 'bg-gradient-to-br from-primary/80 to-accent/80';
  const sparkleClass = mode === 'creative' ? 'text-orange-400' : 'text-primary';

  const TypingIndicator = () => (
    <div className="flex items-center gap-2 p-2">
      <Avatar className="h-6 w-6 border border-white/20">
        <AvatarFallback className="bg-white/10 backdrop-blur-sm">
          <Bot className="h-3 w-3 text-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1">
        <span className="h-1 w-1 rounded-full bg-foreground/50 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="h-1 w-1 rounded-full bg-foreground/50 animate-pulse" style={{ animationDelay: "200ms" }} />
        <span className="h-1 w-1 rounded-full bg-foreground/50 animate-pulse" style={{ animationDelay: "400ms" }} />
      </div>
    </div>
  );

  return (
    <>
      <CardHeader className="pb-3 bg-white/5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 border border-white/20 bg-white/10 backdrop-blur-sm">
              <AvatarFallback className={cn(avatarGradient, "text-white")}>
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold">GG Bot</p>
                <Sparkles className={cn("h-3 w-3 animate-pulse", sparkleClass)} />
              </div>
              <p className="text-xs text-muted-foreground">Ask me anything</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {showModeSelector && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/10 rounded-full"
                    title="Content mode"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-white/10 dark:bg-black/30 backdrop-blur-xl backdrop-saturate-150 border-white/20 z-[110]"
                >
                  <DropdownMenuItem 
                    onClick={() => onContentModeChange('professional')}
                    className={cn("cursor-pointer", contentMode === 'professional' && "bg-white/20")}
                  >
                    Professional Only
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onContentModeChange('creative')}
                    className={cn("cursor-pointer", contentMode === 'creative' && "bg-white/20")}
                  >
                    Creative Only
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onContentModeChange('both')}
                    className={cn("cursor-pointer", contentMode === 'both' && "bg-white/20")}
                  >
                    Both Modes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpandToSidebar}
              className="h-7 w-7 hover:bg-white/10 rounded-full"
              title="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 hover:bg-white/10 hover:text-destructive rounded-full"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col h-[calc(100%-5rem)] pt-3 bg-transparent">
        {/* Message Preview */}
        <div className="flex-1 space-y-2 overflow-y-auto mb-2 pr-2">
          {lastTwoMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Avatar className="h-12 w-12 border-2 border-white/20 bg-white/10 backdrop-blur-sm shadow-lg">
                <AvatarFallback className={cn(avatarGradient, "text-white")}>
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1">Hi there! 👋</p>
                <p className="text-xs text-muted-foreground">How can I help you?</p>
              </div>
            </div>
          ) : (
            <>
              {lastTwoMessages.map((msg) => (
                <ChatMessage key={msg.id} role={msg.role} content={msg.content} compact />
              ))}
              {streaming && streamingMessage && (
                <ChatMessage
                  role="assistant"
                  content={streamingMessage}
                  isStreaming
                  compact
                />
              )}
            </>
          )}
        </div>

        {streaming && !streamingMessage && <TypingIndicator />}

        {/* Quick Actions */}
        {messages && messages.length > 0 && (
          <div className="border-t border-white/10 pt-2 pb-2">
            <QuickActions onAction={onQuickAction} compact />
          </div>
        )}

        {/* Input Area */}
        <div className="pt-2 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask me anything..."
              disabled={streaming}
              className="flex-1 text-sm h-9
                bg-white/10 dark:bg-black/20 
                backdrop-blur-sm
                border-white/20 
                focus:border-white/40
                rounded-lg"
            />
            <Button
              type="submit"
              disabled={!input.trim() || streaming}
              size="icon"
              className={cn("backdrop-blur-sm h-9 w-9 rounded-lg", sendButtonClass)}
            >
              {streaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </>
  );
};

export default ChatbotMiniView;
