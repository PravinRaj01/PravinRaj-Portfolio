import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/contexts/PortfolioContext";

export type ChatbotState = 'closed' | 'open';

interface ChatbotButtonProps {
  onClick: () => void;
  state: ChatbotState;
}

const ChatbotButton = ({ onClick, state }: ChatbotButtonProps) => {
  const isClosed = state === 'closed';
  const { mode } = usePortfolio();

  // Mode-aware colors (no purple in creative mode)
  const hoverStyle = mode === 'creative' 
    ? 'hover:bg-orange-500/20 hover:border-orange-400/50' 
    : 'hover:bg-blue-500/20 hover:border-blue-400/50';
  
  const activeStyle = mode === 'creative'
    ? 'bg-orange-500/30 border-orange-400/50'
    : 'bg-blue-500/30 border-blue-400/50';

  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-5 right-4 md:right-6 lg:right-8 z-50 w-12 h-12 lg:w-14 lg:h-14 rounded-full transition-all duration-300 p-0",
        "bg-white/10",
        "backdrop-blur-xl backdrop-saturate-150",
        "border border-white/20",
        "shadow-2xl",
        hoverStyle,
        "hover:scale-[1.15] active:scale-105",
        !isClosed && `${activeStyle} scale-95`
      )}
      aria-label={isClosed ? "Open GG Bot" : "Close GG Bot"}
    >
      {isClosed ? (
        <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6 text-foreground" />
      ) : (
        <X className="h-5 w-5 lg:h-6 lg:w-6 text-foreground" />
      )}
    </Button>
  );
};

export default ChatbotButton;