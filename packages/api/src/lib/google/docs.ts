import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

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
    // Domain-wide delegation mode: impersonate a user
    return new JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
      ],
      subject: impersonateEmail, // Impersonate this user
    });
  }

  // Fallback: standard service account auth (for personal Google accounts)
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

/**
 * Creates a new Google Doc for a story
 */
export async function createStoryDoc(
  title: string,
  organizationFolderId?: string
): Promise<{ id: string; url: string; embedUrl: string }> {
  const docs = getDocs();
  const drive = getDrive();

  // 1. Create the document
  const doc = await docs.documents.create({
    requestBody: {
      title: `[RedacNews] ${title}`,
    },
  });

  const docId = doc.data.documentId!;

  // 2. Move to organization folder if provided
  if (organizationFolderId) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: organizationFolderId,
        fields: 'id, parents',
      });
    } catch (error) {
      console.error('Failed to move doc to folder:', error);
      // Continue even if folder move fails
    }
  }

  // 3. Share with anyone with the link (can edit)
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
    embedUrl: `https://docs.google.com/document/d/${docId}/edit?embedded=true&rm=minimal`,
  };
}

/**
 * Gets the plain text content of a Google Doc
 * Useful for backup/search indexing
 */
export async function getDocContent(docId: string): Promise<string> {
  const docs = getDocs();

  const doc = await docs.documents.get({ documentId: docId });

  let text = '';
  doc.data.body?.content?.forEach((element) => {
    if (element.paragraph?.elements) {
      element.paragraph.elements.forEach((e) => {
        if (e.textRun?.content) {
          text += e.textRun.content;
        }
      });
    }
  });

  return text;
}

/**
 * Gets content from a Google Doc, separating bold text (lancement/pied) from regular text (voix off)
 * Returns both full content and bold-only content for duration calculation
 */
export async function getDocContentWithFormatting(docId: string): Promise<{
  fullText: string;
  boldText: string;
  hasBoldText: boolean;
}> {
  const docs = getDocs();

  const doc = await docs.documents.get({ documentId: docId });

  let fullText = '';
  let boldText = '';

  doc.data.body?.content?.forEach((element) => {
    if (element.paragraph?.elements) {
      element.paragraph.elements.forEach((e) => {
        if (e.textRun?.content) {
          const content = e.textRun.content;
          fullText += content;

          // Vérifier si le texte est en gras
          if (e.textRun.textStyle?.bold) {
            boldText += content;
          }
        }
      });
    }
  });

  return {
    fullText,
    boldText,
    hasBoldText: boldText.trim().length > 0,
  };
}

/**
 * Estimates reading duration based on Google Doc content
 * If bold text exists (lancement/pied), only count that for the presenter
 * Otherwise count all text
 */
export async function estimateDocReadingDuration(docId: string): Promise<{
  duration: number;
  wordCount: number;
  usedBoldOnly: boolean;
}> {
  const { fullText, boldText, hasBoldText } = await getDocContentWithFormatting(docId);

  // Utiliser le texte en gras s'il existe, sinon tout le texte
  const textToCount = hasBoldText ? boldText : fullText;
  const wordCount = textToCount.trim().split(/\s+/).filter(Boolean).length;
  const duration = estimateReadingDuration(wordCount);

  return {
    duration,
    wordCount,
    usedBoldOnly: hasBoldText,
  };
}

/**
 * Updates the content of a Google Doc
 */
export async function updateDocContent(
  docId: string,
  content: string
): Promise<void> {
  const docs = getDocs();

  // First, get the document to find the content length
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;

  // Delete existing content (except the first newline)
  if (endIndex > 1) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: endIndex - 1,
              },
            },
          },
        ],
      },
    });
  }

  // Insert new content
  if (content) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      },
    });
  }
}

/**
 * Deletes a Google Doc
 */
export async function deleteDoc(docId: string): Promise<void> {
  const drive = getDrive();

  await drive.files.delete({
    fileId: docId,
  });
}

/**
 * Counts words in a Google Doc (for duration estimation)
 */
export async function getDocWordCount(docId: string): Promise<number> {
  const content = await getDocContent(docId);
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Estimates reading duration based on word count
 * Standard radio reading speed: ~150 words per minute
 */
export function estimateReadingDuration(wordCount: number): number {
  const wordsPerMinute = 150;
  return Math.round((wordCount / wordsPerMinute) * 60); // Returns seconds
}

/**
 * Removes technical markers from text for duration calculation
 * Technical markers are text between brackets like [JINGLE], [FLASH], [RUBRIQUE X], etc.
 * These are used by animators to mark cues but shouldn't be counted in reading time
 */
export function removeMarkers(text: string): string {
  // Remove text between brackets: [JINGLE], [FLASH INFO], [>>> RUBRIQUE], etc.
  return text.replace(/\[.*?\]/g, '');
}

/**
 * Gets content from a Google Doc for animation shows (like Tour des Clochers)
 * For animation shows, ALL text is read (not just bold), except technical markers in brackets
 * Returns content with markers removed for accurate duration calculation
 */
export async function getDocContentForAnimation(docId: string): Promise<{
  fullText: string;
  textForDuration: string;
  wordCount: number;
}> {
  const docs = getDocs();

  const doc = await docs.documents.get({ documentId: docId });

  let fullText = '';

  doc.data.body?.content?.forEach((element) => {
    if (element.paragraph?.elements) {
      element.paragraph.elements.forEach((e) => {
        if (e.textRun?.content) {
          fullText += e.textRun.content;
        }
      });
    }
  });

  // For animation shows, count all text EXCEPT technical markers
  const textForDuration = removeMarkers(fullText);
  const wordCount = textForDuration.trim().split(/\s+/).filter(Boolean).length;

  return {
    fullText,
    textForDuration,
    wordCount,
  };
}

/**
 * Estimates reading duration from Google Doc based on show type
 * - For news shows (FLASH, JOURNAL): only bold text counts (lancement/pied read by presenter)
 * - For animation shows (MAGAZINE, CHRONIQUE): all text counts except technical markers in brackets
 */
export async function estimateDocReadingDurationByMode(
  docId: string,
  mode: 'news' | 'animation'
): Promise<{
  duration: number;
  wordCount: number;
  mode: 'news' | 'animation';
  usedBoldOnly: boolean;
}> {
  if (mode === 'animation') {
    // Animation mode: count all text except markers
    const { wordCount } = await getDocContentForAnimation(docId);
    const duration = estimateReadingDuration(wordCount);

    return {
      duration,
      wordCount,
      mode: 'animation',
      usedBoldOnly: false,
    };
  } else {
    // News mode: only count bold text (existing behavior)
    const { fullText, boldText, hasBoldText } = await getDocContentWithFormatting(docId);

    const textToCount = hasBoldText ? boldText : fullText;
    const wordCount = textToCount.trim().split(/\s+/).filter(Boolean).length;
    const duration = estimateReadingDuration(wordCount);

    return {
      duration,
      wordCount,
      mode: 'news',
      usedBoldOnly: hasBoldText,
    };
  }
}

/**
 * Determines the duration calculation mode based on show category
 * FLASH and JOURNAL are news shows (bold text only)
 * MAGAZINE, CHRONIQUE, and AUTRE are animation shows (all text minus markers)
 */
export function getDurationModeFromCategory(
  category: 'FLASH' | 'JOURNAL' | 'MAGAZINE' | 'CHRONIQUE' | 'AUTRE'
): 'news' | 'animation' {
  switch (category) {
    case 'FLASH':
    case 'JOURNAL':
      return 'news';
    case 'MAGAZINE':
    case 'CHRONIQUE':
    case 'AUTRE':
    default:
      return 'animation';
  }
}

/**
 * Inserts text content into an existing Google Doc
 * Useful for populating docs from template content
 */
export async function insertTextInDoc(docId: string, content: string): Promise<void> {
  const docs = getDocs();

  if (!content) return;

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    },
  });
}
