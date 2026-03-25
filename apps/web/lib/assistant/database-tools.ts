// Outils de recherche dans la base de données pour l'assistant IA

import { db } from '@/lib/db';

/**
 * Recherche dans les sujets (stories)
 * Recherche par titre, contenu, tags
 */
export async function searchStories(query: string, limit: number = 100) {
  try {
    const stories = await db.story.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ],
        status: { in: ['PUBLISHED', 'APPROVED', 'ARCHIVED'] }, // Seulement les sujets validés
      },
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        status: true,
        category: true,
        tags: true,
        estimatedDuration: true,
        publishedAt: true,
        createdAt: true,
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return stories;
  } catch (error: any) {
    console.error('Error searching stories:', error);
    return [];
  }
}

/**
 * Récupère un sujet par son ID
 */
export async function getStoryById(storyId: string) {
  try {
    const story = await db.story.findUnique({
      where: { id: storyId },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        media: {
          include: {
            mediaItem: {
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                s3Url: true,
                transcription: true,
              },
            },
          },
        },
      },
    });

    return story;
  } catch (error: any) {
    console.error('Error getting story:', error);
    return null;
  }
}

/**
 * Recherche dans la médiathèque
 * Recherche par titre, description, tags, transcription
 */
export async function searchMedia(query: string, limit: number = 100) {
  try {
    const mediaItems = await db.mediaItem.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
          { transcription: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        duration: true,
        tags: true,
        transcription: true,
        transcriptionStatus: true,
        s3Url: true,
        thumbnailUrl: true,
        createdAt: true,
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return mediaItems;
  } catch (error: any) {
    console.error('Error searching media:', error);
    return [];
  }
}

/**
 * Récupère un média par son ID avec transcription complète
 */
export async function getMediaById(mediaId: string) {
  try {
    const media = await db.mediaItem.findUnique({
      where: { id: mediaId },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        collections: {
          include: {
            collection: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    return media;
  } catch (error: any) {
    console.error('Error getting media:', error);
    return null;
  }
}

/**
 * Formate les résultats de recherche de sujets pour Claude
 */
export function formatStoriesResults(stories: any[]): string {
  if (stories.length === 0) {
    return 'Aucun sujet trouvé dans la base de données.';
  }

  return stories
    .map((story, index) => {
      const author = story.author
        ? `${story.author.firstName || ''} ${story.author.lastName || ''}`.trim()
        : 'Inconnu';
      const date = story.publishedAt || story.createdAt;
      const dateStr = new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const duration = story.estimatedDuration
        ? `${Math.floor(story.estimatedDuration / 60)}:${(story.estimatedDuration % 60)
            .toString()
            .padStart(2, '0')}`
        : 'N/A';

      let result = `${index + 1}. **${story.title}**\n`;
      result += `   🔗 [Ouvrir le sujet](https://redacnews.link/sujets/${story.id})\n`;
      result += `   📅 ${dateStr} | ⏱️ ${duration} | ✍️ ${author}\n`;
      result += `   📊 ${story.status} | 📁 ${story.category || 'N/A'}\n`;
      if (story.tags && story.tags.length > 0) {
        result += `   🏷️ ${story.tags.join(', ')}\n`;
      }
      if (story.summary) {
        result += `   📝 ${story.summary.substring(0, 200)}${story.summary.length > 200 ? '...' : ''}\n`;
      }

      return result;
    })
    .join('\n');
}

/**
 * Formate les résultats de recherche de médias pour Claude
 */
export function formatMediaResults(mediaItems: any[]): string {
  if (mediaItems.length === 0) {
    return 'Aucun média trouvé dans la médiathèque.';
  }

  return mediaItems
    .map((media, index) => {
      const uploader = media.uploadedBy
        ? `${media.uploadedBy.firstName || ''} ${media.uploadedBy.lastName || ''}`.trim()
        : 'Inconnu';
      const dateStr = new Date(media.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const duration = media.duration
        ? `${Math.floor(media.duration / 60)}:${(media.duration % 60).toString().padStart(2, '0')}`
        : 'N/A';

      let result = `${index + 1}. **${media.title}**\n`;
      result += `   🔗 [Ouvrir dans la médiathèque](https://redacnews.link/mediatheque?id=${media.id})\n`;
      result += `   🎵 ${media.type} | ⏱️ ${duration} | 📅 ${dateStr}\n`;
      result += `   👤 Uploadé par ${uploader}\n`;
      if (media.description) {
        result += `   📝 ${media.description}\n`;
      }
      if (media.tags && media.tags.length > 0) {
        result += `   🏷️ ${media.tags.join(', ')}\n`;
      }
      if (media.transcription && media.transcriptionStatus === 'COMPLETED') {
        result += `   📄 Transcription: ${media.transcription.substring(0, 200)}${media.transcription.length > 200 ? '...' : ''}\n`;
      } else if (media.transcriptionStatus === 'PENDING' || media.transcriptionStatus === 'IN_PROGRESS') {
        result += `   ⏳ Transcription en cours...\n`;
      }

      return result;
    })
    .join('\n');
}

/**
 * Formate les détails complets d'un sujet pour Claude
 */
export function formatStoryDetails(story: any): string {
  if (!story) {
    return 'Sujet non trouvé.';
  }

  const author = story.author
    ? `${story.author.firstName || ''} ${story.author.lastName || ''} (${story.author.email})`.trim()
    : 'Inconnu';
  const assignee = story.assignee
    ? `${story.assignee.firstName || ''} ${story.assignee.lastName || ''}`.trim()
    : 'Non assigné';
  const date = story.publishedAt || story.createdAt;
  const dateStr = new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const duration = story.estimatedDuration
    ? `${Math.floor(story.estimatedDuration / 60)}:${(story.estimatedDuration % 60)
        .toString()
        .padStart(2, '0')}`
    : 'N/A';

  let result = `=== ${story.title} ===\n\n`;
  result += `ID: ${story.id}\n`;
  result += `Auteur: ${author}\n`;
  result += `Assigné à: ${assignee}\n`;
  result += `Date: ${dateStr}\n`;
  result += `Statut: ${story.status}\n`;
  result += `Catégorie: ${story.category || 'N/A'}\n`;
  result += `Durée estimée: ${duration}\n`;
  if (story.tags && story.tags.length > 0) {
    result += `Tags: ${story.tags.join(', ')}\n`;
  }
  result += `\n`;

  if (story.summary) {
    result += `Résumé:\n${story.summary}\n\n`;
  }

  if (story.content) {
    result += `Contenu complet:\n${story.content}\n\n`;
  }

  if (story.media && story.media.length > 0) {
    result += `Médias attachés (${story.media.length}):\n`;
    story.media.forEach((sm: any, idx: number) => {
      const m = sm.mediaItem;
      const dur = m.duration
        ? `${Math.floor(m.duration / 60)}:${(m.duration % 60).toString().padStart(2, '0')}`
        : 'N/A';
      result += `  ${idx + 1}. ${m.title} (${m.type}, ${dur})\n`;
      if (m.transcription) {
        result += `     Transcription: ${m.transcription.substring(0, 150)}...\n`;
      }
    });
  }

  if (story.googleDocUrl) {
    result += `\nGoogle Doc: ${story.googleDocUrl}\n`;
  }

  return result;
}

/**
 * Formate les détails complets d'un média pour Claude
 */
export function formatMediaDetails(media: any): string {
  if (!media) {
    return 'Média non trouvé.';
  }

  const uploader = media.uploadedBy
    ? `${media.uploadedBy.firstName || ''} ${media.uploadedBy.lastName || ''} (${media.uploadedBy.email})`.trim()
    : 'Inconnu';
  const dateStr = new Date(media.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const duration = media.duration
    ? `${Math.floor(media.duration / 60)}:${(media.duration % 60).toString().padStart(2, '0')}`
    : 'N/A';
  const fileSize = media.fileSize
    ? `${(media.fileSize / 1024 / 1024).toFixed(2)} MB`
    : 'N/A';

  let result = `=== ${media.title} ===\n\n`;
  result += `ID: ${media.id}\n`;
  result += `Type: ${media.type}\n`;
  result += `Format: ${media.mimeType}\n`;
  result += `Durée: ${duration}\n`;
  result += `Taille: ${fileSize}\n`;
  result += `Uploadé par: ${uploader}\n`;
  result += `Date d'upload: ${dateStr}\n`;
  if (media.tags && media.tags.length > 0) {
    result += `Tags: ${media.tags.join(', ')}\n`;
  }
  result += `\n`;

  if (media.description) {
    result += `Description:\n${media.description}\n\n`;
  }

  if (media.transcription && media.transcriptionStatus === 'COMPLETED') {
    result += `Transcription complète:\n${media.transcription}\n\n`;
  } else if (media.transcriptionStatus === 'PENDING' || media.transcriptionStatus === 'IN_PROGRESS') {
    result += `Transcription: En cours de traitement...\n\n`;
  } else if (media.transcriptionStatus === 'FAILED') {
    result += `Transcription: Échec du traitement\n\n`;
  }

  if (media.collections && media.collections.length > 0) {
    result += `Collections:\n`;
    media.collections.forEach((c: any) => {
      result += `  - ${c.collection.name}\n`;
      if (c.collection.description) {
        result += `    ${c.collection.description}\n`;
      }
    });
  }

  result += `\nURL: ${media.s3Url}\n`;

  return result;
}
