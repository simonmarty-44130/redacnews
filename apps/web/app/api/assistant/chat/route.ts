// Route API pour le chat streaming avec Claude

import { NextRequest, NextResponse } from 'next/server';
import { createStreamingMessage } from '@/lib/assistant/anthropic';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifier l'utilisateur
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = user.id;
    const organizationId = user.organizationId;

    // 2. TODO: Vérifier le quota
    // const usage = await checkMonthlyQuota(organizationId);
    // if (usage.exceeded) {
    //   return NextResponse.json({ error: 'Quota mensuel dépassé' }, { status: 429 });
    // }

    // 3. Parser le body
    const body = await req.json();
    const { messages, systemPrompt, attachments, model, conversationId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 });
    }

    // 4. Construire les messages pour l'API Anthropic
    const anthropicMessages = messages.map((msg: any) => {
      // Si le message contient des pièces jointes (premier message uniquement en général)
      if (msg.attachments && msg.attachments.length > 0) {
        const content: any[] = [];

        // Ajouter les documents en pièce jointe
        for (const attachment of msg.attachments) {
          if (attachment.mimeType === 'application/pdf') {
            content.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: attachment.base64,
              },
            });
          } else if (attachment.mimeType.startsWith('image/')) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: attachment.mimeType,
                data: attachment.base64,
              },
            });
          }
          // Pour les fichiers texte, injecter comme texte
          else if (
            attachment.mimeType.startsWith('text/') ||
            attachment.mimeType === 'application/json'
          ) {
            const textContent = Buffer.from(attachment.base64, 'base64').toString('utf-8');
            content.push({
              type: 'text',
              text: `[Fichier joint : ${attachment.filename}]\n\n${textContent}`,
            });
          }
        }

        // Ajouter le message texte de l'utilisateur
        content.push({ type: 'text', text: msg.content });

        return { role: msg.role, content };
      }

      // Message simple (texte uniquement)
      return { role: msg.role, content: msg.content };
    });

    // 5. Créer le stream
    const stream = await createStreamingMessage({
      messages: anthropicMessages,
      systemPrompt,
      model,
    });

    // 6. Retourner la réponse en streaming SSE
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Conversation-Id': conversationId || 'new',
      },
    });
  } catch (error: any) {
    console.error('Assistant chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
