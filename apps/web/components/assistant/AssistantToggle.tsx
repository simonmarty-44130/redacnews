'use client';

import { useAssistant } from '@/hooks/useAssistant';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function AssistantToggle() {
  const { toggle, isOpen } = useAssistant();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggle}
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            variant={isOpen ? 'secondary' : 'default'}
          >
            <Sparkles className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{isOpen ? 'Fermer' : 'Ouvrir'} l'assistant IA</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
