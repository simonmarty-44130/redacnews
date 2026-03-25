'use client';

import { cn } from '@/lib/utils';
import { User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AssistantMessage } from '@/types/assistant';
import { CreateStoryButton } from './CreateStoryButton';
import { useMemo } from 'react';

interface ChatMessageProps {
  message: AssistantMessage;
}

interface StoryData {
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  estimatedDuration?: number;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Extract story creation data if present in assistant message
  const { cleanContent, storyData } = useMemo(() => {
    if (isUser || !message.content) {
      return { cleanContent: message.content, storyData: null };
    }

    // Look for the marker: :::CREATE_STORY_DATA:::...:::
    const markerRegex = /:::CREATE_STORY_DATA:::([\s\S]+?):::/;
    const match = message.content.match(markerRegex);

    if (match) {
      try {
        const data = JSON.parse(match[1]) as StoryData;
        const cleanedContent = message.content.replace(markerRegex, '').trim();
        return { cleanContent: cleanedContent, storyData: data };
      } catch (e) {
        console.error('Failed to parse story data:', e);
        return { cleanContent: message.content, storyData: null };
      }
    }

    return { cleanContent: message.content, storyData: null };
  }, [message.content, isUser]);

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-lg px-4 py-2 max-w-[85%]',
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {cleanContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Show create story button if data is present */}
        {!isUser && storyData && (
          <div className="max-w-[85%]">
            <CreateStoryButton storyData={storyData} />
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1 rounded-md border bg-slate-50 px-2 py-1"
              >
                <span>📎</span>
                <span>{att.filename}</span>
              </div>
            ))}
          </div>
        )}

        <span className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
