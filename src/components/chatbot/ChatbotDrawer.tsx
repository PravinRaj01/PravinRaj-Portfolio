import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatbotMiniView from "./ChatbotMiniView";
import ChatbotFullView from "./ChatbotFullView";

export type ChatbotState = 'closed' | 'mini' | 'sidebar' | 'full';

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatbotDrawerProps {
  state: ChatbotState;
  onStateChange: (state: ChatbotState) => void;
}

const STORAGE_KEY = 'portfolio_chatbot_conversations';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portfolio-chat`;
const CONVERSATION_EXPIRY_DAYS = 30;

// Cleanup old conversations (older than 30 days)
const cleanupOldConversations = (conversations: Conversation[]): Conversation[] => {
  const expiryMs = CONVERSATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - expiryMs;
  return conversations.filter(c => new Date(c.updatedAt).getTime() > cutoffTime);
};

// LocalStorage helpers
const loadConversations = (): Conversation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Clean up old conversations on load
    const cleaned = cleanupOldConversations(parsed);
    // Save cleaned list if any were removed
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
};

const saveConversations = (conversations: Conversation[]) => {
  try {
    // Also cleanup before saving
    const cleaned = cleanupOldConversations(conversations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Failed to save conversations:', e);
  }
};

const clearAllConversations = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear conversations:', e);
  }
};

const ChatbotDrawer = ({ state, onStateChange }: ChatbotDrawerProps) => {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Load conversations from localStorage on mount
  useEffect(() => {
    const stored = loadConversations();
    if (stored.length > 0) {
      setConversations(stored);
      setCurrentConversationId(stored[0].id);
    } else {
      // Create first conversation
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        title: "New Conversation",
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      setConversations([newConv]);
      setCurrentConversationId(newConv.id);
      saveConversations([newConv]);
    }
  }, []);

  // Get current conversation messages
  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  const updateConversation = useCallback((convId: string, updates: Partial<Conversation>) => {
    setConversations(prev => {
      const updated = prev.map(c => 
        c.id === convId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      );
      saveConversations(updated);
      return updated;
    });
  }, []);

  const addMessageToConversation = useCallback((convId: string, message: Message) => {
    setConversations(prev => {
      const updated = prev.map(c => 
        c.id === convId 
          ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString() } 
          : c
      );
      saveConversations(updated);
      return updated;
    });
  }, []);

  const handleSend = async (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend || streaming || !currentConversationId) return;

    setInput("");
    setStreaming(true);
    setStreamingMessage("");

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageToSend,
    };

    // Immediately add user message
    addMessageToConversation(currentConversationId, userMessage);

    let accumulatedResponse = "";

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limits exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("AI service unavailable. Please try again later.");
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedResponse += content;
                setStreamingMessage((prev) => prev + content);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      if (accumulatedResponse) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: accumulatedResponse,
        };
        addMessageToConversation(currentConversationId, assistantMessage);

        // Auto-title conversation based on first exchange
        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (currentConv && currentConv.title === "New Conversation" && currentConv.messages.length === 0) {
          // Generate a title from the first user message
          const title = messageToSend.slice(0, 30) + (messageToSend.length > 30 ? "..." : "");
          updateConversation(currentConversationId, { title });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setStreaming(false);
      setStreamingMessage("");
    }
  };

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: "New Conversation",
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setConversations(prev => {
      const updated = [newConv, ...prev];
      saveConversations(updated);
      return updated;
    });
    setCurrentConversationId(newConv.id);
  };

  const handleDeleteConversation = (convId: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convId);
      saveConversations(updated);
      
      // If we deleted the current conversation, switch to another
      if (convId === currentConversationId && updated.length > 0) {
        setCurrentConversationId(updated[0].id);
      } else if (updated.length === 0) {
        // Create a new conversation if none left
        const newConv: Conversation = {
          id: `conv-${Date.now()}`,
          title: "New Conversation",
          messages: [],
          updatedAt: new Date().toISOString(),
        };
        saveConversations([newConv]);
        setCurrentConversationId(newConv.id);
        return [newConv];
      }
      
      return updated;
    });
  };

  const handleClearChat = () => {
    if (!currentConversationId) return;
    updateConversation(currentConversationId, { messages: [] });
    toast({
      title: "Chat cleared",
      description: "All messages have been removed from this conversation.",
    });
  };

  const handleClearAllConversations = () => {
    clearAllConversations();
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: "New Conversation",
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setConversations([newConv]);
    setCurrentConversationId(newConv.id);
    saveConversations([newConv]);
    toast({
      title: "All conversations cleared",
      description: "Your conversation history has been deleted from this device.",
    });
  };

  const handleConversationTitleChange = (convId: string, newTitle: string) => {
    updateConversation(convId, { title: newTitle });
  };

  const handleExpandToSidebar = () => onStateChange('sidebar');
  const handleExpandToFull = () => onStateChange('full');
  const handleMinimize = () => onStateChange('mini');
  const handleClose = () => onStateChange('closed');

  if (state === 'closed') return null;

  // On mobile, always use full screen view
  const effectiveState = isMobile ? 'full' : state;

  return (
    <div 
      className={cn(
        "fixed transition-all duration-300 z-50",
        isMobile ? "inset-0 z-[100]" : (
          effectiveState === 'full' ? "inset-4 z-[100]" :
          effectiveState === 'sidebar' ? "top-4 right-4 bottom-4 z-50" :
          "bottom-24 right-6 z-50"
        )
      )}
    >
      <Card 
        className={cn(
          "shadow-2xl transition-all duration-300 flex flex-col overflow-hidden",
          "bg-white/10 dark:bg-black/20",
          "backdrop-blur-xl backdrop-saturate-150",
          "border border-white/20 dark:border-white/10",
          "rounded-2xl",
          isMobile ? "w-full h-full rounded-none" : (
            effectiveState === 'full' ? "w-full h-full" :
            effectiveState === 'sidebar' ? "w-[500px] h-full" :
            "w-[400px] h-[500px]"
          )
        )}
      >
        {effectiveState === 'mini' ? (
          <ChatbotMiniView
            messages={messages}
            streamingMessage={streamingMessage}
            streaming={streaming}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onExpandToSidebar={handleExpandToSidebar}
            onQuickAction={handleSend}
            onClose={handleClose}
          />
        ) : (
          <ChatbotFullView
            messages={messages}
            streamingMessage={streamingMessage}
            streaming={streaming}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onMinimize={isMobile ? undefined : handleMinimize}
            onExpandToFull={!isMobile && state === 'sidebar' ? handleExpandToFull : undefined}
            onClose={handleClose}
            onQuickAction={handleSend}
            isLoading={false}
            isSidebarMode={!isMobile && state === 'sidebar'}
            conversations={conversations}
            currentConversationId={currentConversationId}
            onConversationChange={setCurrentConversationId}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            onClearChat={handleClearChat}
            onConversationTitleChange={handleConversationTitleChange}
          />
        )}
      </Card>
    </div>
  );
};

export default ChatbotDrawer;
