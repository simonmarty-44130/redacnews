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
