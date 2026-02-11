'use client';

import { useAssistant } from '@/hooks/useAssistant';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { SystemPromptEditor } from './SystemPromptEditor';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Settings, History, X } from 'lucide-react';

export function AssistantPanel() {
  const {
    isOpen,
    close,
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    showSystemPrompt,
    setShowSystemPrompt,
    totalTokensIn,
    totalTokensOut,
  } = useAssistant();

  const totalTokens = totalTokensIn + totalTokensOut;
  const tokenLimit = 2000000; // 2M tokens par défaut
  const tokenPercentage = (totalTokens / tokenLimit) * 100;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <SheetTitle>Assistant IA</SheetTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {showSystemPrompt && (
          <div className="border-b bg-slate-50 dark:bg-slate-900">
            <SystemPromptEditor />
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          <ChatMessageList messages={messages} isStreaming={isStreaming} />
        </div>

        <div className="border-t p-4 space-y-3">
          <ChatInput
            onSend={sendMessage}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            disabled={isStreaming}
          />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Progress value={tokenPercentage} className="h-1 flex-1" />
            <span className="whitespace-nowrap">
              {(totalTokens / 1000).toFixed(1)}k / {(tokenLimit / 1000000).toFixed(0)}M tokens
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
