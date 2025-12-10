import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type { docs_v1 } from 'googleapis';

// Types
export interface RundownWithItems {
  id: string;
  date: Date;
  notes: string | null;
  show: {
    name: string;
    defaultDuration: number;
  };
  items: Array<{
    id: string;
    type: string;
    title: string;
    duration: number;
    position: number;
    notes: string | null;
    script: string | null; // Texte a lire (prioritaire sur story.content)
    story: {
      title: string;
      content: string | null;
      estimatedDuration: number | null;
    } | null;
    media: Array<{
      mediaItem: {
        id: string;
        title: string;
        type: string;
        duration: number | null;
        transcription: string | null;
      };
    }>;
  }>;
}

export interface ScriptDocResult {
  id: string;
  url: string;
}

// Initialize Google Auth with Service Account + Domain-Wide Delegation
const getGoogleAuth = () => {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const parsed = JSON.parse(credentials);

  // Use JWT with subject (impersonation) for domain-wide delegation
  const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

  if (impersonateEmail) {
    return new JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
      ],
      subject: impersonateEmail,
    });
  }

  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });
};

const getDrive = () => {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
};

const getDocs = () => {
  const auth = getGoogleAuth();
  return google.docs({ version: 'v1', auth });
};

// Emojis par type d'element
const TYPE_EMOJI: Record<string, string> = {
  STORY: '',
  INTERVIEW: '',
  JINGLE: '[JINGLE]',
  MUSIC: '[MUSIQUE]',
  LIVE: '[DIRECT]',
  BREAK: '[PUB]',
  OTHER: '',
};

const TYPE_LABEL: Record<string, string> = {
  STORY: 'SUJET',
  INTERVIEW: 'INTERVIEW',
  JINGLE: 'JINGLE',
  MUSIC: 'MUSIQUE',
  LIVE: 'DIRECT',
  BREAK: 'PUBLICITE',
  OTHER: 'AUTRE',
};

/**
 * Genere un Google Doc script a partir d'un conducteur
 */
export async function createRundownScript(
  rundown: RundownWithItems,
  folderId?: string
): Promise<ScriptDocResult> {
  const docs = getDocs();
  const drive = getDrive();

  const dateStr = formatDateFr(rundown.date);
  const title = `Script - ${rundown.show.name} - ${dateStr}`;

  // 1. Creer le document
  const createResponse = await docs.documents.create({
    requestBody: { title },
  });
  const docId = createResponse.data.documentId!;

  // 2. Si un dossier est specifie, deplacer le document
  if (folderId) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        fields: 'id, parents',
      });
    } catch (error) {
      console.error('Failed to move script to folder:', error);
    }
  }

  // 3. Construire et appliquer le contenu
  const requests = buildScriptContent(rundown);

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });
  }

  // 4. Partager le document (ecriture pour tous avec le lien)
  await drive.permissions.create({
    fileId: docId,
    requestBody: {
      role: 'writer',
      type: 'anyone',
    },
  });

  return {
    id: docId,
    url: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

/**
 * Construit les requetes pour le contenu du document
 */
function buildScriptContent(rundown: RundownWithItems): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];

  // Calculer la duree totale
  const totalDuration = rundown.items.reduce((sum, item) => sum + item.duration, 0);

  // Texte complet a inserer (on construit tout le texte d'abord)
  let fullText = '';
  const formatRanges: Array<{
    start: number;
    end: number;
    type: 'title' | 'subtitle' | 'itemHeader' | 'mediaBox' | 'timing' | 'body';
    itemType?: string;
  }> = [];

  // === EN-TETE ===
  const headerTitle = `${rundown.show.name.toUpperCase()}\n`;
  const headerSubtitle = `${formatDateFr(rundown.date)} - Duree totale : ${formatDuration(totalDuration)}\n\n`;

  formatRanges.push({ start: 1, end: 1 + headerTitle.length, type: 'title' });
  formatRanges.push({
    start: 1 + headerTitle.length,
    end: 1 + headerTitle.length + headerSubtitle.length,
    type: 'subtitle',
  });

  fullText += headerTitle + headerSubtitle;

  // === ITEMS ===
  // Calculer l'heure de debut (12h00 par defaut)
  let currentTime = new Date(rundown.date);
  currentTime.setHours(12, 0, 0, 0);

  for (const item of rundown.items) {
    const timeStr = formatTime(currentTime);
    const durationStr = formatDuration(item.duration);

    // Priorite: script > story.content
    const textContent = item.script || item.story?.content;

    if (textContent) {
      // === ELEMENT AVEC TEXTE A LIRE ===

      // Ligne separatrice
      const separator = `${'_'.repeat(60)}\n`;
      fullText += separator;

      // Ligne d'en-tete du sujet
      const itemHeaderText = `${timeStr} | ${item.title.toUpperCase()}    [${durationStr}]\n\n`;

      const headerStart = fullText.length + 1;
      fullText += itemHeaderText;
      formatRanges.push({
        start: headerStart,
        end: headerStart + itemHeaderText.length,
        type: 'itemHeader',
      });

      // Contenu (script ou contenu du sujet)
      const content = cleanContent(textContent) + '\n\n';
      const contentStart = fullText.length + 1;
      fullText += content;
      formatRanges.push({ start: contentStart, end: contentStart + content.length, type: 'body' });

      // Sons attaches
      for (const media of item.media) {
        const mediaText = buildMediaBoxText(media.mediaItem);
        const mediaStart = fullText.length + 1;
        fullText += mediaText;
        formatRanges.push({
          start: mediaStart,
          end: mediaStart + mediaText.length - 1,
          type: 'mediaBox',
          itemType: 'INTERVIEW',
        });
      }
    } else {
      // === ELEMENT SONORE / NON-TEXTE ===
      const label = TYPE_LABEL[item.type] || item.type;
      const prefix = TYPE_EMOJI[item.type] || '';

      const boxText = `\n>>> ${prefix}${prefix ? ' ' : ''}${label}: ${item.title} [${durationStr}] <<<\n\n`;

      const boxStart = fullText.length + 1;
      fullText += boxText;
      formatRanges.push({
        start: boxStart,
        end: boxStart + boxText.length - 1,
        type: 'mediaBox',
        itemType: item.type,
      });
    }

    // Avancer le timing
    currentTime = new Date(currentTime.getTime() + item.duration * 1000);
  }

  // === FIN DU SCRIPT ===
  const endTime = formatTime(currentTime);
  const footerText = `\n${'_'.repeat(60)}\n`;
  const footerEnd = `FIN DU JOURNAL - ${endTime}\n`;
  fullText += footerText + footerEnd;

  // 1. Inserer tout le texte
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  // 2. Appliquer le formatage
  for (const range of formatRanges) {
    const formatting = getFormattingForType(range.type, range.itemType);
    if (formatting) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: range.start, endIndex: range.end },
          textStyle: formatting.textStyle,
          fields: Object.keys(formatting.textStyle).join(','),
        },
      });
      if (formatting.paragraphStyle) {
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: range.start, endIndex: range.end },
            paragraphStyle: formatting.paragraphStyle,
            fields: Object.keys(formatting.paragraphStyle).join(','),
          },
        });
      }
    }
  }

  return requests;
}

/**
 * Construit le texte d'un encadre media
 */
function buildMediaBoxText(media: {
  title: string;
  type: string;
  duration: number | null;
  transcription: string | null;
}): string {
  const durationStr = media.duration ? formatDuration(media.duration) : '--:--';

  let text = `\n>>> SON: ${media.title} [${durationStr}] <<<\n`;

  // Ajouter un apercu de la transcription si disponible
  if (media.transcription) {
    const preview = media.transcription.substring(0, 100).trim();
    text += `"${preview}..."\n`;
  }

  text += '\n';

  return text;
}

/**
 * Retourne le formatage pour un type de contenu
 */
function getFormattingForType(
  type: string,
  _itemType?: string
): { textStyle: docs_v1.Schema$TextStyle; paragraphStyle?: docs_v1.Schema$ParagraphStyle } | null {
  switch (type) {
    case 'title':
      return {
        textStyle: {
          bold: true,
          fontSize: { magnitude: 24, unit: 'PT' },
        },
        paragraphStyle: {
          alignment: 'CENTER',
        },
      };
    case 'subtitle':
      return {
        textStyle: {
          fontSize: { magnitude: 12, unit: 'PT' },
          foregroundColor: { color: { rgbColor: { red: 0.4, green: 0.4, blue: 0.4 } } },
        },
        paragraphStyle: {
          alignment: 'CENTER',
        },
      };
    case 'itemHeader':
      return {
        textStyle: {
          bold: true,
          fontSize: { magnitude: 14, unit: 'PT' },
        },
      };
    case 'mediaBox':
      return {
        textStyle: {
          bold: true,
          fontSize: { magnitude: 12, unit: 'PT' },
          foregroundColor: { color: { rgbColor: { red: 0.2, green: 0.2, blue: 0.6 } } },
        },
        paragraphStyle: {
          alignment: 'CENTER',
        },
      };
    case 'body':
      return {
        textStyle: {
          fontSize: { magnitude: 14, unit: 'PT' },
        },
        paragraphStyle: {
          lineSpacing: 150,
        },
      };
    default:
      return null;
  }
}

/**
 * Nettoie le contenu texte
 */
function cleanContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Formate une date en francais
 */
function formatDateFr(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formate une heure HH:MM:SS
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formate une duree en secondes en MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
