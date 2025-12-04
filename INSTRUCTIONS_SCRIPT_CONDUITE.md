# 🎬 INSTRUCTIONS : Génération Script de Conduite

> **Objectif** : Générer automatiquement un Google Doc "Script d'émission" à partir d'un conducteur validé, contenant tous les textes des sujets et des encadrés pour les éléments sonores.

---

## 📋 CONTEXTE

### Besoin utilisateur
Quand un conducteur (rundown) est prêt pour l'antenne, le présentateur a besoin d'un **document unique** contenant :
- Tous les textes des sujets à lire
- Les indications des éléments sonores (jingles, interviews, pubs) avec leurs durées
- Les timings de passage de chaque élément
- Un format visuel clair et lisible sur tablette/prompteur

### Déclencheur
- Bouton "Générer le script" dans l'interface du conducteur
- Optionnellement : génération auto quand le statut passe à "READY"

---

## 🏗️ ARCHITECTURE

### Fichiers à créer

```
packages/api/src/lib/google/
  └── rundown-script.ts           # Générateur de script Google Docs

apps/web/components/conducteur/
  └── GenerateScriptButton.tsx    # Bouton + modal de génération
```

### Fichiers à modifier

```
packages/db/prisma/schema.prisma  # Ajouter champs script au Rundown
packages/api/src/routers/rundown.ts # Ajouter mutation generateScript
apps/web/app/(dashboard)/conducteur/page.tsx # Intégrer le bouton
```

---

## 📐 SPECS DÉTAILLÉES

### 1. Migration Prisma

Ajouter ces champs au modèle `Rundown` dans `packages/db/prisma/schema.prisma` :

```prisma
model Rundown {
  id          String        @id @default(cuid())
  showId      String
  date        DateTime
  status      RundownStatus @default(DRAFT)
  notes       String?
  
  // NOUVEAU : Script généré
  scriptDocId       String?   // ID du Google Doc script
  scriptDocUrl      String?   // URL du script
  scriptGeneratedAt DateTime? // Date de dernière génération
  
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  show  Show          @relation(fields: [showId], references: [id])
  items RundownItem[]
}
```

Après modification, exécuter :
```bash
cd packages/db
npx prisma db push
npx prisma generate
```

---

### 2. Générateur de Script Google Docs

Créer `packages/api/src/lib/google/rundown-script.ts` :

```typescript
import { google } from 'googleapis';
import { docs_v1 } from 'googleapis';

// Types
interface RundownWithItems {
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

interface ScriptDocResult {
  id: string;
  url: string;
}

// Configuration Google APIs
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
  ],
});

const docs = google.docs({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

// Emojis par type d'élément
const TYPE_EMOJI: Record<string, string> = {
  STORY: '📝',
  INTERVIEW: '🎤',
  JINGLE: '🎵',
  MUSIC: '🎶',
  LIVE: '🔴',
  BREAK: '⏸️',
  OTHER: '📌',
};

const TYPE_LABEL: Record<string, string> = {
  STORY: 'SUJET',
  INTERVIEW: 'INTERVIEW',
  JINGLE: 'JINGLE',
  MUSIC: 'MUSIQUE',
  LIVE: 'DIRECT',
  BREAK: 'PUBLICITÉ',
  OTHER: 'AUTRE',
};

// Couleurs de fond (RGB 0-1)
const TYPE_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  JINGLE: { red: 0.93, green: 0.87, blue: 0.98 },    // Violet clair
  MUSIC: { red: 0.87, green: 0.94, blue: 0.98 },     // Bleu clair
  BREAK: { red: 0.98, green: 0.92, blue: 0.87 },     // Orange clair
  INTERVIEW: { red: 0.87, green: 0.98, blue: 0.91 }, // Vert clair
  LIVE: { red: 0.98, green: 0.87, blue: 0.87 },      // Rouge clair
  OTHER: { red: 0.95, green: 0.95, blue: 0.95 },     // Gris clair
};

/**
 * Génère un Google Doc script à partir d'un conducteur
 */
export async function createRundownScript(
  rundown: RundownWithItems,
  folderId?: string
): Promise<ScriptDocResult> {
  const dateStr = formatDateFr(rundown.date);
  const title = `Script - ${rundown.show.name} - ${dateStr}`;

  // 1. Créer le document
  const createResponse = await docs.documents.create({
    requestBody: { title },
  });
  const docId = createResponse.data.documentId!;

  // 2. Si un dossier est spécifié, déplacer le document
  if (folderId) {
    await drive.files.update({
      fileId: docId,
      addParents: folderId,
      fields: 'id, parents',
    });
  }

  // 3. Construire et appliquer le contenu
  const requests = buildScriptContent(rundown);
  
  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });
  }

  // 4. Partager le document (lecture pour tous avec le lien)
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
 * Construit les requêtes pour le contenu du document
 */
function buildScriptContent(rundown: RundownWithItems): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];
  
  // Calculer la durée totale
  const totalDuration = rundown.items.reduce((sum, item) => sum + item.duration, 0);
  
  // Texte complet à insérer (on construit tout le texte d'abord)
  let fullText = '';
  const formatRanges: Array<{
    start: number;
    end: number;
    type: 'title' | 'subtitle' | 'itemHeader' | 'mediaBox' | 'timing' | 'body';
    itemType?: string;
  }> = [];

  // === EN-TÊTE ===
  const headerTitle = `${rundown.show.name.toUpperCase()}\n`;
  const headerSubtitle = `${formatDateFr(rundown.date)} • Durée totale : ${formatDuration(totalDuration)}\n\n`;
  
  formatRanges.push({ start: 1, end: 1 + headerTitle.length, type: 'title' });
  formatRanges.push({ 
    start: 1 + headerTitle.length, 
    end: 1 + headerTitle.length + headerSubtitle.length, 
    type: 'subtitle' 
  });
  
  fullText += headerTitle + headerSubtitle;

  // === ITEMS ===
  // Calculer l'heure de début (12h00 par défaut, à adapter selon le show)
  let currentTime = new Date(rundown.date);
  currentTime.setHours(12, 0, 0, 0);

  for (const item of rundown.items) {
    const timeStr = formatTime(currentTime);
    const durationStr = formatDuration(item.duration);

    if (item.type === 'STORY' && item.story?.content) {
      // === SUJET AVEC TEXTE ===
      
      // Ligne d'en-tête du sujet
      const headerLine = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const itemHeaderText = `${timeStr} │ ${item.title.toUpperCase()}    [${durationStr}]\n`;
      const headerLine2 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      const headerStart = fullText.length + 1;
      fullText += headerLine + itemHeaderText + headerLine2;
      formatRanges.push({ 
        start: headerStart + headerLine.length, 
        end: headerStart + headerLine.length + itemHeaderText.length, 
        type: 'itemHeader' 
      });

      // Contenu du sujet
      const storyContent = cleanContent(item.story.content) + '\n\n';
      const contentStart = fullText.length + 1;
      fullText += storyContent;
      formatRanges.push({ start: contentStart, end: contentStart + storyContent.length, type: 'body' });

      // Sons attachés au sujet
      for (const media of item.media) {
        const mediaText = buildMediaBoxText(media.mediaItem);
        const mediaStart = fullText.length + 1;
        fullText += mediaText;
        formatRanges.push({ 
          start: mediaStart, 
          end: mediaStart + mediaText.length - 1, 
          type: 'mediaBox',
          itemType: 'INTERVIEW'
        });
      }

    } else {
      // === ÉLÉMENT SONORE / NON-TEXTE ===
      const emoji = TYPE_EMOJI[item.type] || '📌';
      const label = TYPE_LABEL[item.type] || item.type;
      
      const boxText = `┌${'─'.repeat(60)}┐\n│ ${emoji} ${label}: ${item.title.padEnd(40)} ${durationStr.padStart(6)} │\n└${'─'.repeat(60)}┘\n\n`;
      
      const boxStart = fullText.length + 1;
      fullText += boxText;
      formatRanges.push({ 
        start: boxStart, 
        end: boxStart + boxText.length - 1, 
        type: 'mediaBox',
        itemType: item.type
      });
    }

    // Avancer le timing
    currentTime = new Date(currentTime.getTime() + item.duration * 1000);
  }

  // === FIN DU SCRIPT ===
  const endTime = formatTime(currentTime);
  const footerText = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const footerEnd = `FIN DU JOURNAL • ${endTime}\n`;
  fullText += footerText + footerEnd;

  // 1. Insérer tout le texte
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
 * Construit le texte d'un encadré média
 */
function buildMediaBoxText(media: { 
  title: string; 
  type: string; 
  duration: number | null;
  transcription: string | null;
}): string {
  const emoji = media.type === 'AUDIO' ? '🎤' : '📎';
  const durationStr = media.duration ? formatDuration(media.duration) : '--:--';
  
  let text = `┌${'─'.repeat(60)}┐\n`;
  text += `│ ${emoji} SON: ${media.title.substring(0, 45).padEnd(45)} ${durationStr.padStart(6)} │\n`;
  
  // Ajouter un aperçu de la transcription si disponible
  if (media.transcription) {
    const preview = media.transcription.substring(0, 55).trim();
    text += `│    "${preview}..."${' '.repeat(Math.max(0, 55 - preview.length))} │\n`;
  }
  
  text += `└${'─'.repeat(60)}┘\n\n`;
  
  return text;
}

/**
 * Retourne le formatage pour un type de contenu
 */
function getFormattingForType(
  type: string, 
  itemType?: string
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
          fontSize: { magnitude: 11, unit: 'PT' },
          foregroundColor: { color: { rgbColor: { red: 0.3, green: 0.3, blue: 0.3 } } },
        },
      };
    case 'body':
      return {
        textStyle: {
          fontSize: { magnitude: 14, unit: 'PT' },
        },
        paragraphStyle: {
          lineSpacing: 150, // 1.5 interligne pour lisibilité
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
 * Formate une date en français
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
 * Formate une durée en secondes en MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export { RundownWithItems, ScriptDocResult };
```

---

### 3. Mutation tRPC

Ajouter dans `packages/api/src/routers/rundown.ts` :

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const rundownRouter = router({
  // ... autres endpoints existants ...

  // Générer le script Google Doc
  generateScript: protectedProcedure
    .input(z.object({ 
      rundownId: z.string(),
      regenerate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Récupérer le conducteur complet avec tous les détails
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              story: {
                select: {
                  id: true,
                  title: true,
                  content: true,
                  estimatedDuration: true,
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
                      transcription: true,
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      });

      // 2. Si un script existe déjà et qu'on ne force pas la regénération, retourner l'existant
      if (rundown.scriptDocId && !input.regenerate) {
        return {
          id: rundown.id,
          scriptDocId: rundown.scriptDocId,
          scriptDocUrl: rundown.scriptDocUrl,
          scriptGeneratedAt: rundown.scriptGeneratedAt,
          isNew: false,
        };
      }

      // 3. Générer le nouveau script
      try {
        const { createRundownScript } = await import('../lib/google/rundown-script');
        
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const doc = await createRundownScript(rundown, folderId);

        // 4. Sauvegarder la référence
        const updated = await ctx.db.rundown.update({
          where: { id: input.rundownId },
          data: {
            scriptDocId: doc.id,
            scriptDocUrl: doc.url,
            scriptGeneratedAt: new Date(),
          },
        });

        return {
          id: updated.id,
          scriptDocId: updated.scriptDocId,
          scriptDocUrl: updated.scriptDocUrl,
          scriptGeneratedAt: updated.scriptGeneratedAt,
          isNew: true,
        };
      } catch (error) {
        console.error('Failed to generate script:', error);
        throw new Error('Impossible de générer le script. Vérifiez la configuration Google.');
      }
    }),

  // Récupérer les infos du script d'un conducteur
  getScript: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        select: {
          scriptDocId: true,
          scriptDocUrl: true,
          scriptGeneratedAt: true,
        },
      });

      return rundown;
    }),
});
```

---

### 4. Composant UI : GenerateScriptButton

Créer `apps/web/components/conducteur/GenerateScriptButton.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { 
  FileText, 
  RefreshCw, 
  ExternalLink, 
  Loader2,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface GenerateScriptButtonProps {
  rundownId: string;
  rundownTitle: string;
  existingScriptUrl?: string | null;
  existingScriptGeneratedAt?: Date | null;
  className?: string;
}

export function GenerateScriptButton({
  rundownId,
  rundownTitle,
  existingScriptUrl,
  existingScriptGeneratedAt,
  className,
}: GenerateScriptButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    url?: string;
    error?: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const generateScript = trpc.rundown.generateScript.useMutation({
    onSuccess: (data) => {
      setResult({
        success: true,
        url: data.scriptDocUrl || undefined,
      });
      // Invalider les queries pour rafraîchir l'UI
      utils.rundown.get.invalidate({ id: rundownId });
      utils.rundown.getScript.invalidate({ rundownId });
    },
    onError: (error) => {
      setResult({
        success: false,
        error: error.message,
      });
    },
  });

  const handleGenerate = (regenerate: boolean = false) => {
    setResult(null);
    generateScript.mutate({ rundownId, regenerate });
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
    setResult(null);
  };

  const handleClose = () => {
    setShowDialog(false);
    setResult(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <TooltipProvider>
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={existingScriptUrl ? 'outline' : 'default'}
              size="sm"
              onClick={handleOpenDialog}
              className={cn(
                existingScriptUrl && 'border-green-200 text-green-700 hover:bg-green-50',
                className
              )}
            >
              <FileText className="h-4 w-4 mr-2" />
              {existingScriptUrl ? 'Script' : 'Générer script'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {existingScriptUrl 
              ? `Script généré le ${formatDate(existingScriptGeneratedAt!)}`
              : 'Générer le script de conduite'
            }
          </TooltipContent>
        </Tooltip>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Script de conduite
              </DialogTitle>
              <DialogDescription>
                {rundownTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* État existant */}
              {existingScriptUrl && !result && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      Script déjà généré
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Dernière génération : {formatDate(existingScriptGeneratedAt!)}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-green-700"
                      asChild
                    >
                      <a href={existingScriptUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir le script
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* État de chargement */}
              {generateScript.isPending && (
                <div className="flex items-center justify-center gap-3 p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">
                    Génération du script en cours...
                  </p>
                </div>
              )}

              {/* Résultat succès */}
              {result?.success && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      Script généré avec succès !
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-green-700"
                      asChild
                    >
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir le script
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Résultat erreur */}
              {result?.success === false && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Erreur lors de la génération
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {result.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              {!generateScript.isPending && !result && (
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Le script contiendra :</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>Tous les textes des sujets</li>
                    <li>Les encadrés pour les éléments sonores</li>
                    <li>Les timings de passage</li>
                    <li>Les aperçus des transcriptions</li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              {!generateScript.isPending && (
                <>
                  <Button variant="outline" onClick={handleClose}>
                    Fermer
                  </Button>
                  
                  {existingScriptUrl && !result && (
                    <Button
                      variant="outline"
                      onClick={() => handleGenerate(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regénérer
                    </Button>
                  )}
                  
                  {(!existingScriptUrl || result?.success === false) && (
                    <Button onClick={() => handleGenerate(false)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Générer le script
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
```

---

### 5. Intégration dans la page Conducteur

Modifier `apps/web/app/(dashboard)/conducteur/page.tsx` pour ajouter le bouton.

Dans le header du conducteur sélectionné ou dans la toolbar, ajouter :

```tsx
import { GenerateScriptButton } from '@/components/conducteur/GenerateScriptButton';

// Dans le rendu, là où se trouve le header du conducteur sélectionné :
<GenerateScriptButton
  rundownId={selectedRundown.id}
  rundownTitle={`${selectedRundown.show.name} - ${formatDate(selectedRundown.date)}`}
  existingScriptUrl={selectedRundown.scriptDocUrl}
  existingScriptGeneratedAt={selectedRundown.scriptGeneratedAt}
/>
```

---

### 6. Export du composant

Ajouter dans `apps/web/components/conducteur/index.ts` :

```typescript
export { GenerateScriptButton } from './GenerateScriptButton';
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Backend
- [ ] Modifier `schema.prisma` (ajouter champs script)
- [ ] Exécuter `npx prisma db push && npx prisma generate`
- [ ] Créer `packages/api/src/lib/google/rundown-script.ts`
- [ ] Ajouter mutations dans `packages/api/src/routers/rundown.ts`

### Phase 2 : Frontend
- [ ] Créer `GenerateScriptButton.tsx`
- [ ] Exporter dans `index.ts`
- [ ] Intégrer dans la page conducteur

### Phase 3 : Tests
- [ ] Tester la génération avec un conducteur simple
- [ ] Tester avec sujets + médias attachés
- [ ] Vérifier le formatage dans Google Docs
- [ ] Tester la regénération

---

## 🎨 FORMAT DU DOCUMENT GÉNÉRÉ

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    JT MIDI
       Vendredi 28 novembre 2025 • Durée totale : 58:30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────────────────────────────────────────────────┐
│ 🎵 JINGLE: Jingle ouverture JT                       0:15 │
└────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12:00:15 │ GRÈVE SNCF - FORTES PERTURBATIONS           [2:30]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

La grève à la SNCF se poursuit ce vendredi avec une forte
mobilisation des cheminots. Selon la direction, 60% des TGV
sont annulés et seulement un TER sur trois circule.

┌────────────────────────────────────────────────────────────┐
│ 🎤 SON: Interview usager Gare du Nord                1:20 │
│    "C'est vraiment compliqué aujourd'hui, j'ai dû..."     │
└────────────────────────────────────────────────────────────┘

Les négociations doivent reprendre lundi prochain.

┌────────────────────────────────────────────────────────────┐
│ 🎤 SON: Interview Dir. Communication SNCF            0:45 │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ ⏸️ PUBLICITÉ: Pause pub                              3:00 │
└────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12:07:15 │ MÉTÉO WEEKEND                               [1:00]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Un beau weekend en perspective sur notre région...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIN DU JOURNAL • 12:58:30
```

---

## 🔧 CONFIGURATION REQUISE

S'assurer que ces variables d'environnement sont configurées :

```bash
# Google Service Account avec accès Drive & Docs
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Dossier Google Drive où créer les scripts (optionnel)
GOOGLE_DRIVE_FOLDER_ID=1abc...xyz
```

---

## 💡 AMÉLIORATIONS FUTURES

1. **Génération auto** : Déclencher quand statut passe à READY
2. **Lien prompteur** : Le prompteur pourrait afficher ce script
3. **PDF export** : Bouton pour télécharger en PDF
4. **Personnalisation** : Choisir l'heure de début de l'émission
5. **Templates** : Différents formats selon le type d'émission

---

*Créé le 3 décembre 2025 pour Claude Code*
