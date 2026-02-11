// Zustand store pour l'assistant IA

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssistantMessage, AssistantAttachment } from '@/types/assistant';

interface AssistantState {
  // UI
  isOpen: boolean;
  isStreaming: boolean;
  showSystemPrompt: boolean;
  showHistory: boolean;

  // Conversation courante
  conversationId: string | null;
  messages: AssistantMessage[];
  systemPrompt: string;
  attachments: AssistantAttachment[];
  model: string;

  // Usage
  totalTokensIn: number;
  totalTokensOut: number;

  // Actions UI
  toggle: () => void;
  open: () => void;
  close: () => void;
  setShowSystemPrompt: (show: boolean) => void;
  setShowHistory: (show: boolean) => void;

  // Actions conversation
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  addAttachment: (attachment: AssistantAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  // Gestion conversations
  newConversation: () => void;
  loadConversation: (conv: {
    id: string;
    messages: AssistantMessage[];
    systemPrompt?: string;
  }) => void;

  // Usage
  addUsage: (tokensIn: number, tokensOut: number) => void;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      // État initial
      isOpen: false,
      isStreaming: false,
      showSystemPrompt: false,
      showHistory: false,
      conversationId: null,
      messages: [],
      systemPrompt: '',
      attachments: [],
      model: 'claude-sonnet-4-5-20250929',
      totalTokensIn: 0,
      totalTokensOut: 0,

      // Actions UI
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setShowSystemPrompt: (show) => set({ showSystemPrompt: show }),
      setShowHistory: (show) => set({ showHistory: show }),

      // Actions conversation
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      setModel: (model) => set({ model }),

      addUserMessage: (content) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'user' as const,
              content,
              timestamp: new Date(),
              attachments: s.attachments.length > 0 ? [...s.attachments] : undefined,
            },
          ],
        })),

      addAssistantMessage: (content) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content,
              timestamp: new Date(),
            },
          ],
        })),

      updateLastAssistantMessage: (content) =>
        set((s) => {
          const msgs = [...s.messages];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
            msgs[lastIdx] = { ...msgs[lastIdx], content };
          }
          return { messages: msgs };
        }),

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      addAttachment: (attachment) =>
        set((s) => ({ attachments: [...s.attachments, attachment] })),

      removeAttachment: (id) =>
        set((s) => ({
          attachments: s.attachments.filter((a) => a.id !== id),
        })),

      clearAttachments: () => set({ attachments: [] }),

      newConversation: () =>
        set({
          conversationId: null,
          messages: [],
          attachments: [],
        }),

      loadConversation: (conv) =>
        set({
          conversationId: conv.id,
          messages: conv.messages,
          systemPrompt: conv.systemPrompt || '',
          attachments: [],
        }),

      addUsage: (tokensIn, tokensOut) =>
        set((s) => ({
          totalTokensIn: s.totalTokensIn + tokensIn,
          totalTokensOut: s.totalTokensOut + tokensOut,
        })),
    }),
    {
      name: 'redacnews-assistant',
      // Ne persister que le system prompt et le modèle (pas les messages)
      partialize: (state) => ({
        systemPrompt: state.systemPrompt,
        model: state.model,
      }),
    }
  )
);
