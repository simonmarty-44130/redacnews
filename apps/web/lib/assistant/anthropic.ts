// Client API Anthropic côté serveur uniquement

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicCredentials } from '@/lib/aws/secrets';

// ⚠️ Ce fichier est SERVEUR UNIQUEMENT — ne jamais importer côté client

// Cache du client Anthropic
let anthropicClient: Anthropic | null = null;
let defaultModel: string | null = null;

/**
 * Récupère ou initialise le client Anthropic
 * Utilise AWS Secrets Manager pour récupérer la clé API
 */
async function getAnthropicClient(): Promise<{ client: Anthropic; model: string }> {
  if (anthropicClient && defaultModel) {
    return { client: anthropicClient, model: defaultModel };
  }

  try {
    // Tenter de récupérer depuis Secrets Manager
    const credentials = await getAnthropicCredentials();
    anthropicClient = new Anthropic({ apiKey: credentials.apiKey });
    defaultModel = credentials.defaultModel;
    console.log('✅ Anthropic credentials loaded from Secrets Manager');
  } catch (error) {
    // Fallback sur les variables d'environnement si Secrets Manager échoue
    console.warn('⚠️  Failed to load from Secrets Manager, falling back to env vars:', error);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables or Secrets Manager');
    }

    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    defaultModel = process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-5-20250929';
  }

  return { client: anthropicClient, model: defaultModel };
}

// System prompt de base injecté pour toutes les conversations RédacNews
const BASE_SYSTEM_PROMPT = `Tu es l'assistant IA intégré à RédacNews, un outil de gestion de rédaction pour les radios.

Contexte :
- Tu aides des journalistes radio professionnels dans leur travail quotidien.
- Les sujets radio font généralement entre 1 et 3 minutes à l'antenne.
- Le style radio est direct, concis, avec des phrases courtes et un vocabulaire accessible.
- Les lancements (introductions lues par le présentateur) font 3-5 lignes maximum.
- Les papiers (sujets lus) visent ~180 mots par minute de lecture.

Tu peux aider à :
- Rédiger ou reformuler des sujets pour l'antenne
- Résumer des documents longs (interviews, communiqués, rapports)
- Proposer des angles journalistiques
- Générer des lancements, relances, titres
- Corriger et améliorer des scripts
- Analyser des transcriptions d'interviews
- Répondre à des questions de culture générale / actualité

Règles :
- Sois concis et direct, comme un bon papier radio.
- Quand tu rédiges pour l'antenne, utilise le style oral (phrases courtes, pas de subordonnées complexes).
- Indique toujours la durée estimée de lecture quand tu produis un texte destiné à l'antenne.
- Utilise le système métrique et les conventions françaises (dates, nombres).
- Réponds en français sauf demande contraire.`;

interface CreateMessageParams {
  messages: { role: 'user' | 'assistant'; content: any }[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Crée un stream de réponse depuis l'API Anthropic
 * Retourne un ReadableStream compatible avec la Response API
 */
export async function createStreamingMessage({
  messages,
  systemPrompt,
  model,
  maxTokens = 4096,
}: CreateMessageParams): Promise<ReadableStream> {
  // Récupérer le client Anthropic et le modèle par défaut
  const { client, model: defaultModelValue } = await getAnthropicClient();
  const selectedModel = model || defaultModelValue;

  // Combiner le system prompt de base avec celui de l'utilisateur
  const fullSystemPrompt = systemPrompt
    ? `${BASE_SYSTEM_PROMPT}\n\n--- Consignes supplémentaires de l'utilisateur ---\n${systemPrompt}`
    : BASE_SYSTEM_PROMPT;

  const stream = await client.messages.stream({
    model: selectedModel,
    max_tokens: maxTokens,
    system: fullSystemPrompt,
    messages,
  });

  // Convertir le stream Anthropic en ReadableStream SSE
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta as any;
            if (delta.type === 'text_delta') {
              const chunk = JSON.stringify({
                type: 'content_block_delta',
                text: delta.text,
              });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
            }
          } else if (event.type === 'message_start') {
            const chunk = JSON.stringify({
              type: 'message_start',
              model: (event.message as any)?.model,
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          } else if (event.type === 'message_delta') {
            const chunk = JSON.stringify({
              type: 'message_delta',
              usage: (event as any).usage,
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          } else if (event.type === 'message_stop') {
            const chunk = JSON.stringify({ type: 'message_stop' });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
        }

        // Envoyer les stats d'usage finales
        const finalMessage = await stream.finalMessage();
        const usageChunk = JSON.stringify({
          type: 'usage',
          usage: {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
        });
        controller.enqueue(encoder.encode(`data: ${usageChunk}\n\n`));

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error: any) {
        const errorChunk = JSON.stringify({
          type: 'error',
          error: error.message || 'Erreur inattendue',
        });
        controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
        controller.close();
      }
    },
  });
}
