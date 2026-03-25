// Client API Anthropic côté serveur avec support des outils (Tool Use)

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicCredentials } from '@/lib/aws/secrets';
import { searchWeb, formatSearchResults } from '@/lib/search/brave-search';

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
- Rechercher des informations en ligne (actualité, faits, données)

Règles :
- Sois concis et direct, comme un bon papier radio.
- Quand tu rédiges pour l'antenne, utilise le style oral (phrases courtes, pas de subordonnées complexes).
- Indique toujours la durée estimée de lecture quand tu produis un texte destiné à l'antenne.
- Utilise le système métrique et les conventions françaises (dates, nombres).
- Réponds en français sauf demande contraire.
- Tu as accès à Internet via l'outil de recherche web. Utilise-le pour vérifier des faits récents ou trouver des informations à jour.`;

// Définition des outils disponibles pour Claude
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description:
      'Recherche des informations sur Internet. Utilise cet outil pour trouver des informations récentes, vérifier des faits, ou obtenir des données à jour. Retourne une liste de résultats avec titres, URLs et descriptions.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'La requête de recherche. Formule-la de manière claire et précise en français. Exemples: "grève SNCF janvier 2026", "résultats élections municipales Nantes"',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Exécute un outil demandé par Claude
 */
async function executeTool(toolName: string, toolInput: any): Promise<string> {
  console.log(`🔧 Executing tool: ${toolName}`, toolInput);

  switch (toolName) {
    case 'web_search':
      const results = await searchWeb(toolInput.query, 5);
      return formatSearchResults(results);
    default:
      return `Erreur: Outil inconnu "${toolName}"`;
  }
}

interface CreateMessageParams {
  messages: { role: 'user' | 'assistant'; content: any }[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Crée un stream de réponse depuis l'API Anthropic avec support des outils
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

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Créer une copie modifiable des messages pour gérer les tool use
        let currentMessages = [...messages];
        let hasToolUse = false;

        // Boucle pour gérer les appels d'outils multiples (max 5 itérations)
        for (let iteration = 0; iteration < 5; iteration++) {
          const stream = await client.messages.stream({
            model: selectedModel,
            max_tokens: maxTokens,
            system: fullSystemPrompt,
            messages: currentMessages,
            tools: TOOLS,
          });

          let assistantMessage: any = { role: 'assistant', content: [] };

          // Stream les événements
          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const block = (event as any).content_block;
              assistantMessage.content.push(block);
            } else if (event.type === 'content_block_delta') {
              const delta = event.delta as any;

              if (delta.type === 'text_delta') {
                // Streamer le texte au client
                const chunk = JSON.stringify({
                  type: 'content_block_delta',
                  text: delta.text,
                });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));

                // Ajouter au message assistant
                const lastBlock = assistantMessage.content[assistantMessage.content.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                  lastBlock.text = (lastBlock.text || '') + delta.text;
                }
              } else if (delta.type === 'input_json_delta') {
                // Accumuler l'input JSON de l'outil
                const lastBlock = assistantMessage.content[assistantMessage.content.length - 1];
                if (lastBlock && lastBlock.type === 'tool_use') {
                  lastBlock.input = (lastBlock.input || '') + delta.partial_json;
                }
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
            }
          }

          const finalMessage = await stream.finalMessage();

          // Vérifier s'il y a des appels d'outils
          const toolUseBlocks = finalMessage.content.filter((block: any) => block.type === 'tool_use');

          if (toolUseBlocks.length === 0) {
            // Pas d'outil, on a terminé
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
            return;
          }

          // Il y a des appels d'outils à exécuter
          hasToolUse = true;
          currentMessages.push({ role: 'assistant', content: finalMessage.content });

          // Exécuter tous les outils
          const toolResults = await Promise.all(
            toolUseBlocks.map(async (toolBlock: any) => {
              const result = await executeTool(toolBlock.name, JSON.parse(toolBlock.input));
              return {
                type: 'tool_result',
                tool_use_id: toolBlock.id,
                content: result,
              };
            })
          );

          currentMessages.push({ role: 'user', content: toolResults });

          // Informer l'utilisateur qu'on utilise un outil
          const toolNotification = JSON.stringify({
            type: 'content_block_delta',
            text: `\n\n🔍 *Recherche en cours...*\n\n`,
          });
          controller.enqueue(encoder.encode(`data: ${toolNotification}\n\n`));
        }

        // Si on arrive ici, on a atteint la limite d'itérations
        throw new Error('Limite d\'appels d\'outils atteinte');

      } catch (error: any) {
        console.error('Anthropic stream error:', error);
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
