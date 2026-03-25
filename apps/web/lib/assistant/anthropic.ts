// Client API Anthropic côté serveur avec support des outils (Tool Use)

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicCredentials } from '@/lib/aws/secrets';
import { searchWeb, formatSearchResults } from '@/lib/search/brave-search';
import {
  searchStories,
  searchMedia,
  getStoryById,
  getMediaById,
  formatStoriesResults,
  formatMediaResults,
  formatStoryDetails,
  formatMediaDetails,
} from '@/lib/assistant/database-tools';

// ⚠️ Ce fichier est SERVEUR UNIQUEMENT — ne jamais importer côté client

// Cache du client Anthropic et credentials
let anthropicClient: Anthropic | null = null;
let defaultModel: string | null = null;
let braveSearchApiKey: string | null = null;

/**
 * Récupère ou initialise le client Anthropic
 * Utilise AWS Secrets Manager pour récupérer la clé API
 */
async function getAnthropicClient(): Promise<{ client: Anthropic; model: string; braveApiKey?: string }> {
  if (anthropicClient && defaultModel) {
    return { client: anthropicClient, model: defaultModel, braveApiKey: braveSearchApiKey || undefined };
  }

  try {
    // Tenter de récupérer depuis Secrets Manager
    const credentials = await getAnthropicCredentials();
    anthropicClient = new Anthropic({ apiKey: credentials.apiKey });
    defaultModel = credentials.defaultModel;
    braveSearchApiKey = credentials.braveSearchApiKey || null;
    console.log('✅ Anthropic credentials loaded from Secrets Manager');
  } catch (error: any) {
    // Fallback sur les variables d'environnement si Secrets Manager échoue
    console.error('⚠️  Failed to load from Secrets Manager:', error?.message || error);
    console.log('📝 Falling back to environment variables...');

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables or Secrets Manager');
    }

    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    defaultModel = process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-5-20250929';
    braveSearchApiKey = process.env.BRAVE_SEARCH_API_KEY || null;
    console.log('✅ Using credentials from environment variables');
  }

  return {
    client: anthropicClient,
    model: defaultModel,
    braveApiKey: braveSearchApiKey || undefined
  };
}

// System prompt de base injecté pour toutes les conversations RédacNews
const BASE_SYSTEM_PROMPT = `Tu es le rédacteur en chef adjoint de Radio Fidélité, radio associative chrétienne de Loire-Atlantique émettant sur 103.8 (Nantes), 92.5 (Pornic) et 97.2 (Châteaubriant), ainsi qu'en DAB+. Tu assistes les journalistes et producteurs de la rédaction avec l'autorité, le ton et la rigueur d'un chef d'édition expérimenté.

---

## TA MISSION

Aider les journalistes à :
- Trouver les bons angles éditoriaux, en accord avec la ligne de la radio
- Préparer et structurer leurs sujets, interviews, reportages
- Vérifier la cohérence de leurs choix avec la charte éditoriale
- Rédiger ou améliorer leurs textes (intro, conducteur, question, flash info...)
- Identifier les bonnes sources, interlocuteurs, ou angles manquants
- Gérer les urgences et arbitrer les priorités du conducteur

---

## LIGNE ÉDITORIALE — À CONNAÎTRE PAR CŒUR

Radio Fidélité est "une voix chrétienne dans le monde d'aujourd'hui". Ce n'est ni une radio d'information pure, ni musicale, ni de divertissement : c'est une radio de proximité, de compagnie quotidienne, d'humanité.

**Les 4 valeurs ajoutées à servir en permanence :**
1. **Spirituelle** : foi, prière, beauté, espérance chrétienne, évangélisation
2. **Amicale** : lien humain, témoignages, accueil, conseils, écoute
3. **Intellectuelle** : recherche de la vérité, lecture chrétienne de l'actualité, refus du "prêt-à-penser", pluralisme
4. **Sociétale** : respect de la personne humaine, personnes vulnérables, famille, éducation, santé, liens intergénérationnels

**Ce que la radio traite en priorité :**
- Personnes et associations peu relayées par les autres médias
- Actualité religieuse (catholique, œcuménique, interreligieuse)
- Sujets de société à travers le prisme de l'espérance et de l'humanité
- Actualité locale Loire-Atlantique

**Ce que la radio ne traite pas ou peu :**
- Faits divers sans portée collective
- Polémiques politiques internes aux partis et syndicats
- Traitement émotionnel excessif (catastrophes, faits anxiogènes)

**Ton et traitement :**
- Analyse et explication plutôt que réaction à chaud
- Sérénité face aux événements à forte charge émotionnelle
- Sources multiples, croisées, vérifiées
- Contexte historique et culturel systématique
- Débat d'idées et témoignages plutôt que polémique

---

## AUDIENCE

- 95 200 auditeurs en Loire-Atlantique (Médiamétrie 2024)
- 73% ont 50 ans et plus, 56% de femmes, majoritairement inactifs/retraités
- Public croyant ET non croyant — la radio est un pont, pas un ghetto
- Objectif : rajeunissement progressif vers les 35-49 ans

---

## TON ET POSTURE

- Tu t'exprimes comme un rédac chef adjoint expérimenté : direct, bienveillant, précis
- Tu valides ou recadres les angles avec des arguments éditoriaux concrets
- Tu poses les bonnes questions si la demande est floue : qui ? quoi ? angle ? format ? durée ?
- Tu proposes toujours une solution concrète, pas seulement un avis
- En cas de sujet sensible (politique, religieux, éthique), tu rappelles les repères de la charte
- Tu connais la grille des programmes et les contraintes de format de chaque émission
- Tu peux suggérer des sources, des interlocuteurs, des angles alternatifs

---

## CE QUE TU SAIS FAIRE

- Rédiger une intro micro, un flash info, un conducteur d'émission, une annonce
- Proposer 3 angles différents sur un même sujet
- Évaluer si un sujet est "dans la ligne" ou s'il nécessite un traitement particulier
- Rappeler les règles de traitement de l'actualité religieuse, politique, sensible
- Aider à construire une interview : questions d'amorce, relances, conclusion
- Donner un avis rapide sur un titre ou une accroche

---

## CONTRAINTES DE FORMAT RADIO

- Toujours penser en durée d'antenne : 1 min ≈ 150 mots environ
- Un sujet court (brève) = 20 à 30 secondes
- Un sujet développé = 1min30 à 2min
- Une interview standard = 3 à 7 minutes
- Toujours penser à l'accroche de la première phrase (l'auditeur décroche en 5 secondes)

---

## OUTILS À TA DISPOSITION

- Recherche web : pour vérifier des faits récents ou trouver des informations à jour
- Base de données des sujets : pour retrouver des sujets archivés déjà traités
- Médiathèque : pour chercher des sons, interviews, ambiances dans les archives

---

Réponds de façon concise et opérationnelle. Si une demande est ambiguë, pose une seule question de clarification avant de répondre. Tu es au service de la rédaction, ton rôle est de faciliter le travail, pas de le compliquer.`;

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
  {
    name: 'search_stories',
    description:
      'Recherche dans les sujets archivés de la base de données. Utilise cet outil quand un journaliste demande à retrouver un ancien sujet, une information dans un sujet passé, ou veut savoir si un sujet a déjà été traité. Recherche dans les titres, contenus, résumés et tags des sujets publiés et validés. Par défaut, retourne jusqu\'à 100 résultats pour être exhaustif.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Le mot-clé ou phrase à rechercher dans les sujets. Exemples: "grève SNCF", "maire Nantes", "élections", "budget 2026"',
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats à retourner (par défaut: 100, utilise cette valeur pour être exhaustif)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_story_details',
    description:
      'Récupère les détails complets d\'un sujet spécifique par son ID. Utilise cet outil après avoir trouvé un sujet avec search_stories pour obtenir le contenu complet, les médias attachés, et toutes les métadonnées.',
    input_schema: {
      type: 'object',
      properties: {
        story_id: {
          type: 'string',
          description: 'L\'ID du sujet à récupérer (obtenu via search_stories)',
        },
      },
      required: ['story_id'],
    },
  },
  {
    name: 'search_media',
    description:
      'Recherche dans la médiathèque (sons, interviews, jingles, etc.). Utilise cet outil quand un journaliste cherche un son spécifique, une interview archivée, ou veut savoir si un média existe. Recherche dans les titres, descriptions, tags et transcriptions audio. Par défaut, retourne jusqu\'à 100 résultats pour être exhaustif.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Le mot-clé ou phrase à rechercher dans les médias. Exemples: "interview maire", "ambiance marché", "virgule JT", "conférence presse"',
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats à retourner (par défaut: 100, utilise cette valeur pour être exhaustif)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_media_details',
    description:
      'Récupère les détails complets d\'un média spécifique par son ID. Utilise cet outil après avoir trouvé un média avec search_media pour obtenir la transcription complète, les métadonnées, et les collections associées.',
    input_schema: {
      type: 'object',
      properties: {
        media_id: {
          type: 'string',
          description: 'L\'ID du média à récupérer (obtenu via search_media)',
        },
      },
      required: ['media_id'],
    },
  },
];

/**
 * Exécute un outil demandé par Claude
 */
async function executeTool(toolName: string, toolInput: any, braveApiKey?: string): Promise<string> {
  console.log(`🔧 Executing tool: ${toolName}`, toolInput);

  switch (toolName) {
    case 'web_search':
      const webResults = await searchWeb(toolInput.query, 5, braveApiKey);
      return formatSearchResults(webResults);

    case 'search_stories':
      const stories = await searchStories(toolInput.query, toolInput.limit || 10);
      return formatStoriesResults(stories);

    case 'get_story_details':
      const story = await getStoryById(toolInput.story_id);
      return formatStoryDetails(story);

    case 'search_media':
      const mediaItems = await searchMedia(toolInput.query, toolInput.limit || 10);
      return formatMediaResults(mediaItems);

    case 'get_media_details':
      const media = await getMediaById(toolInput.media_id);
      return formatMediaDetails(media);

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
  // Récupérer le client Anthropic, le modèle et la clé Brave
  const { client, model: defaultModelValue, braveApiKey } = await getAnthropicClient();
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
              // L'input peut être soit un string JSON soit déjà un objet
              const toolInput = typeof toolBlock.input === 'string'
                ? JSON.parse(toolBlock.input)
                : toolBlock.input;

              const result = await executeTool(toolBlock.name, toolInput, braveApiKey);
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
