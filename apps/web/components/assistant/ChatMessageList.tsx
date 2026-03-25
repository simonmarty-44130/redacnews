'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import type { AssistantMessage } from '@/types/assistant';

interface ChatMessageListProps {
  messages: AssistantMessage[];
  isStreaming: boolean;
}

export function ChatMessageList({ messages, isStreaming }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll au dernier message quand les messages changent
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll pendant le streaming (plus fréquent)
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-medium">Bonjour ! 👋</p>
          <p className="text-sm text-muted-foreground">
            Je suis votre assistant IA pour RédacNews. Je peux vous aider à rédiger, reformuler,
            résumer et améliorer vos contenus radio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce delay-100">●</span>
              <span className="animate-bounce delay-200">●</span>
            </div>
            <span>Claude réfléchit...</span>
          </div>
        )}
        {/* Élément invisible pour forcer le scroll en bas */}
        <div ref={bottomRef} className="h-1" />
      </div>
    </ScrollArea>
  );
}
