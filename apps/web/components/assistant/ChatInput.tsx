'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square, Paperclip } from 'lucide-react';
import { useAssistant } from '@/hooks/useAssistant';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { uploadAttachment, attachments, removeAttachment } = useAssistant();

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadAttachment(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erreur lors de l\'upload du fichier');
    }

    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-1 text-sm"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[200px] truncate">{att.filename}</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tapez votre message... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
            className="min-h-[60px] max-h-[200px] resize-none pr-10"
            disabled={disabled}
          />
          <label
            htmlFor="file-upload"
            className="absolute bottom-2 right-2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
            <input
              id="file-upload"
              type="file"
              className="sr-only"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.csv,.json,.jpg,.jpeg,.png,.webp"
            />
          </label>
        </div>

        {isStreaming ? (
          <Button onClick={onStop} variant="destructive" size="icon">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!input.trim() || disabled} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
