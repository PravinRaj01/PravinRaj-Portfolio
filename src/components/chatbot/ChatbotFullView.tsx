import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardHeader, CardContent } from "@/components/ui/card";
import { Loader2, Send, Sparkles, Minimize2, X, Maximize2, Plus, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatbotFullViewProps {
  messages: Message[];
  streamingMessage: string;
  streaming: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMinimize?: () => void;
  onExpandToFull?: () => void;
  onClose: () => void;
  onQuickAction: (message: string) => void;
  isLoading?: boolean;
  isSidebarMode?: boolean;
  conversations: Conversation[];
  currentConversationId: string | null;
  onConversationChange: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClearChat: () => void;
  onConversationTitleChange: (id: string, title: string) => void;
}

const ChatbotFullView = ({
  messages,
  streamingMessage,
  streaming,
  input,
  onInputChange,
  onSend,
  onMinimize,
  onExpandToFull,
  onClose,
  onQuickAction,
  isLoading = false,
  isSidebarMode = false,
  conversations,
  currentConversationId,
  onConversationChange,
  onNewConversation,
  onDeleteConversation,
  onClearChat,
  onConversationTitleChange,
}: ChatbotFullViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const { mode } = usePortfolio();
  
  // Mode-aware accent colors
  const sendButtonClass = mode === 'creative'
    ? 'bg-orange-500/80 hover:bg-orange-500'
    : 'bg-primary/80 hover:bg-primary';
  const avatarGradient = mode === 'creative'
    ? 'bg-gradient-to-br from-orange-500/80 to-orange-600/80'
    : 'bg-gradient-to-br from-primary/80 to-accent/80';
  const sparkleClass = mode === 'creative' ? 'text-orange-400' : 'text-primary';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMessage]);

  const TypingIndicator = () => (
    <div className="flex items-center gap-2 p-4">
      <Avatar className="h-8 w-8 border border-white/20">
        <AvatarFallback className="bg-white/10 backdrop-blur-sm">
          <Bot className="h-4 w-4 text-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 animate-pulse" style={{ animationDelay: "200ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 animate-pulse" style={{ animationDelay: "400ms" }} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Management */}
      {conversations.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-white/10 flex items-center gap-2 bg-white/5">
          <div className="flex-1 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 w-full max-w-[calc(100%-70px)] bg-white/10 border-white/20 hover:bg-white/20">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1 text-left">
                    {conversations.find(c => c.id === currentConversationId)?.title || "New Conversation"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-[300px] max-h-[400px] overflow-y-auto 
                  bg-white/10 dark:bg-black/30 
                  backdrop-blur-xl backdrop-saturate-150
                  border-white/20 z-[110]"
              >
                <DropdownMenuLabel>Conversations</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {conversations.map((conv) => (
                  <div key={conv.id} className="flex items-center group pr-2">
                    <DropdownMenuItem
                      className="flex-1 cursor-pointer hover:bg-white/10"
                      onSelect={(e) => {
                        if ((e.target as HTMLElement).closest('input')) {
                          e.preventDefault();
                          return;
                        }
                        onConversationChange(conv.id);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={conv.title}
                        onChange={(e) => {
                          onConversationTitleChange(conv.id, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none outline-none flex-1 text-sm w-full"
                      />
                    </DropdownMenuItem>
                    {conversations.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conv.id);
                          setShowDeleteDialog(true);
                        }}
                        className="h-8 w-8 mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive rounded-full"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            className="h-9 shrink-0 bg-white/10 border-white/20 hover:bg-white/20 px-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">New</span>
          </Button>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white/10 dark:bg-black/30 backdrop-blur-xl border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 hover:bg-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conversationToDelete) {
                  onDeleteConversation(conversationToDelete);
                  setShowDeleteDialog(false);
                  setConversationToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CardHeader className="pb-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-white/20 bg-white/10 backdrop-blur-sm">
              <AvatarFallback className={cn(avatarGradient, "text-white")}>
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">GG Bot</p>
                <Sparkles className={cn("h-4 w-4 animate-pulse", sparkleClass)} />
              </div>
              <p className="text-xs text-muted-foreground">Ask me about skills, projects, experience</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearChat}
              className="h-8 w-8 hover:bg-white/10 hover:text-destructive rounded-full"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {isSidebarMode && onExpandToFull && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onExpandToFull}
                className="h-8 w-8 hover:bg-white/10 rounded-full"
                title="Expand to fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            {onMinimize && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMinimize}
                className="h-8 w-8 hover:bg-white/10 rounded-full"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-white/10 hover:text-destructive rounded-full"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-4 pb-2 overflow-hidden bg-transparent">
        {/* Messages Area */}
        <ScrollArea className="h-full pr-2">
          <div className="space-y-5 px-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="relative">
                  <Loader2 className={cn("h-12 w-12 animate-spin", sparkleClass)} />
                  <Sparkles className={cn("h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse", sparkleClass)} />
                </div>
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : messages?.length === 0 ? (
              <div className="text-center py-8 space-y-6">
                <div className="space-y-3">
                  <Avatar className="h-20 w-20 mx-auto border-2 border-white/20 bg-white/10 backdrop-blur-sm shadow-lg">
                    <AvatarFallback className={cn(avatarGradient, "text-white")}>
                      <Bot className="h-10 w-10" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Welcome! 👋</h3>
                    <p className="text-muted-foreground text-sm">
                      I can help you learn about my skills, projects, and experience.
                    </p>
                  </div>
                </div>
                <QuickActions onAction={onQuickAction} />
              </div>
            ) : (
              <>
                {messages?.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {streaming && (
                  <ChatMessage
                    role="assistant"
                    content={streamingMessage || "Thinking..."}
                    isStreaming
                  />
                )}
                <div ref={scrollRef} className="h-2" />
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {streaming && !streamingMessage && <TypingIndicator />}

      <div className="p-4 border-t border-white/10 mt-auto bg-white/5 pb-[env(safe-area-inset-bottom,16px)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <div className="relative">
            <Input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask me anything..."
              disabled={streaming}
              className="pr-12 h-11 text-base
                bg-white/10 dark:bg-black/20 
                backdrop-blur-sm
                border-white/20 
                focus:border-white/40 focus:ring-white/20
                rounded-xl"
            />
            <Button
              type="submit"
              disabled={!input.trim() || streaming}
              size="icon"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 backdrop-blur-sm h-8 w-8 rounded-lg",
                sendButtonClass
              )}
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground/70 text-center mt-2">Powered by AI</p>
      </div>
    </div>
  );
};

export default ChatbotFullView;
