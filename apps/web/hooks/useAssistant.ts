// Hook principal pour l'assistant IA

'use client';

import { useCallback, useRef } from 'react';
import { useAssistantStore } from '@/stores/assistant-store';

export function useAssistant() {
  const store = useAssistantStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || store.isStreaming) return;

      // 1. Ajouter le message utilisateur
      store.addUserMessage(userMessage);

      // 2. Préparer les messages pour l'API
      const allMessages = [...store.messages, { role: 'user' as const, content: userMessage }];
      const apiMessages = allMessages.map((msg) => {
        const hasAttachments = 'attachments' in msg && msg.attachments && msg.attachments.length > 0;

        return {
          role: msg.role,
          content: msg.content,
          // Joindre les pièces jointes au premier message user qui en a
          ...(hasAttachments
            ? {
                attachments: msg.attachments!.map((a) => ({
                  base64: a.base64Data || '',
                  mimeType: a.mimeType,
                  filename: a.filename,
                })),
              }
            : {}),
        };
      });

      // 3. Ajouter un message assistant vide pour le streaming
      store.addAssistantMessage('');
      store.setStreaming(true);

      // 4. Créer un AbortController pour pouvoir annuler
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            systemPrompt: store.systemPrompt || undefined,
            model: store.model,
            conversationId: store.conversationId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${await response.text()}`);
        }

        // 5. Lire le stream SSE
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Pas de stream');

        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parser les événements SSE
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Garder le dernier fragment incomplet

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);

            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content_block_delta' && parsed.text) {
                fullText += parsed.text;
                store.updateLastAssistantMessage(fullText);
              } else if (parsed.type === 'usage' && parsed.usage) {
                store.addUsage(parsed.usage.inputTokens, parsed.usage.outputTokens);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Ignorer les erreurs de parsing des chunks incomplets
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }

        // 6. Nettoyer les pièces jointes après envoi
        store.clearAttachments();
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Annulation volontaire, ne rien faire
          return;
        }
        console.error('Assistant error:', error);
        store.updateLastAssistantMessage(
          `❌ Erreur : ${error.message || 'Une erreur est survenue. Réessayez.'}`
        );
      } finally {
        store.setStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [store]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    store.setStreaming(false);
  }, [store]);

  const uploadAttachment = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/assistant/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error);
        }

        const data = await response.json();

        store.addAttachment({
          id: crypto.randomUUID(),
          filename: data.filename,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          s3Url: data.s3Url,
          base64Data: data.base64,
        });
      } catch (error: any) {
        console.error('Upload error:', error);
        throw error;
      }
    },
    [store]
  );

  return {
    ...store,
    sendMessage,
    stopStreaming,
    uploadAttachment,
  };
}
