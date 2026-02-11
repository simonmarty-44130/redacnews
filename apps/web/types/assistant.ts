// Types pour l'assistant IA

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AssistantAttachment[];
  timestamp: Date;
  tokenCount?: number;
}

export interface AssistantAttachment {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  s3Url: string;
  // Base64 chargé à la demande pour envoi API
  base64Data?: string;
}

export interface AssistantConversation {
  id: string;
  title: string | null;
  systemPrompt: string | null;
  model: string;
  messages: AssistantMessage[];
  attachments: AssistantAttachment[];
  tokenUsageIn: number;
  tokenUsageOut: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  conversationId?: string;
  messages: { role: 'user' | 'assistant'; content: string; attachments?: { base64: string; mimeType: string; filename: string }[] }[];
  systemPrompt?: string;
  model?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamChunk {
  type: 'content_block_delta' | 'message_start' | 'message_delta' | 'message_stop' | 'usage' | 'error';
  text?: string;
  usage?: TokenUsage;
  error?: string;
  model?: string;
}
