import { Button } from "@/components/ui/button";
import { Code, Briefcase, GraduationCap, Mail, Rocket } from "lucide-react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onAction: (message: string) => void;
  compact?: boolean;
}

const QuickActions = ({ onAction, compact }: QuickActionsProps) => {
  const { mode } = usePortfolio();
  
  const actions = [
    {
      icon: Code,
      label: "Skills & Tech",
      message: "What technologies and skills do you have?",
    },
    {
      icon: Rocket,
      label: "Projects",
      message: "Tell me about your most notable projects",
    },
    {
      icon: Briefcase,
      label: "Experience",
      message: "What's your work experience?",
    },
    {
      icon: GraduationCap,
      label: "Education",
      message: "What's your educational background?",
    },
    {
      icon: Mail,
      label: "Contact",
      message: "How can I get in touch with you?",
    },
  ];

  // Mode-aware accent colors
  const accentClass = mode === 'creative'
    ? 'hover:bg-orange-500/20 hover:border-orange-400/50 focus:ring-orange-400/30'
    : 'hover:bg-primary/20 hover:border-primary/50 focus:ring-primary/30';

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {actions.slice(0, 3).map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            onClick={() => onAction(action.message)}
            className={cn("shrink-0 bg-white/10 border-white/20", accentClass)}
          >
            <action.icon className="h-3 w-3 mr-1" />
            {action.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          onClick={() => onAction(action.message)}
          className={cn("justify-start h-auto py-3 bg-white/10 border-white/20", accentClass)}
        >
          <action.icon className="h-4 w-4 mr-2 shrink-0" />
          <span className="text-left">{action.label}</span>
        </Button>
      ))}
    </div>
  );
};

export default QuickActions;
