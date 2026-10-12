import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePortfolio } from '@/contexts/PortfolioContext';
import {
  ASSISTANT_NAV_STATE,
  resolveNavigation,
  type NavigationTarget,
} from '@/lib/assistantNavigation';
import type { NavigateAction } from '@/types/chat';

/**
 * Lets the chat assistant move the visitor around the site. The decisions
 * (which mode, which URL) live in lib/assistantNavigation.ts; this wires them
 * to the router and to the portfolio's mode/visibility settings.
 */
export function useAssistantNavigation() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    mode,
    defaultMode,
    professionalModeEnabled,
    creativeModeEnabled,
    professionalVisiblePages,
    creativeVisiblePages,
  } = usePortfolio();

  /** Where the action would go, or null if that page isn't available to this visitor. */
  const resolve = useCallback(
    (action: NavigateAction): NavigationTarget | null =>
      resolveNavigation(action, {
        mode,
        defaultMode,
        professionalModeEnabled,
        creativeModeEnabled,
        professionalVisiblePages,
        creativeVisiblePages,
      }),
    [mode, defaultMode, professionalModeEnabled, creativeModeEnabled, professionalVisiblePages, creativeVisiblePages]
  );

  /** Navigates. The router state tells the Projects page to apply the requested filters. */
  const goTo = useCallback(
    (target: NavigationTarget) => navigate(target.path, { state: ASSISTANT_NAV_STATE }),
    [navigate]
  );

  /** Resolve + navigate, telling the visitor if the page isn't available. */
  const open = useCallback(
    (action: NavigateAction): boolean => {
      const target = resolve(action);
      if (!target) {
        toast({
          title: "That page isn't available",
          description: "I can't open it on this site right now.",
          variant: 'destructive',
        });
        return false;
      }
      goTo(target);
      return true;
    },
    [resolve, goTo, toast]
  );

  return { resolve, goTo, open };
}
