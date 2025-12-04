# 🎯 INSTRUCTIONS REFONTE MODULE SUJETS

> **Objectif** : Refondre l'UX du module Sujets pour maximiser l'espace d'édition et afficher un timer de lecture en temps réel.

---

## 📋 CONTEXTE

### Problème actuel
L'interface actuelle affiche une vue "split" (liste à gauche 384px + éditeur à droite) qui consomme trop d'espace. Le journaliste doit cliquer sur "agrandir" pour avoir une vue confortable du Google Doc.

### Solution
Après création d'un sujet (modal inchangé), basculer directement vers une vue **plein écran dédiée** avec :
- Timer de lecture visible en permanence (refresh auto toutes les 5-10 secondes)
- Google Docs occupant ~85% de l'écran
- Barre minimaliste en haut et en bas

---

## 🏗️ ARCHITECTURE DES CHANGEMENTS

### Fichiers à créer

```
apps/web/app/(dashboard)/sujets/[id]/
  └── page.tsx                    # Nouvelle page d'édition plein écran

apps/web/components/sujets/
  ├── StoryEditorFullscreen.tsx   # Nouveau composant éditeur plein écran
  ├── ReadingTimer.tsx            # Composant timer de lecture
  └── StoryBottomBar.tsx          # Barre inférieure contextuelle
```

### Fichiers à modifier

```
apps/web/app/(dashboard)/sujets/page.tsx         # Liste uniquement
apps/web/components/sujets/CreateStoryDialog.tsx # Redirect après création
apps/web/components/sujets/StoryEditor.tsx       # Garder pour édition inline (optionnel)
packages/api/src/routers/story.ts                # Endpoint lecture rapide
```

---

## 📐 SPECS UI/UX

### 1. Page Liste (`/sujets`) - Simplifiée

Après création, rediriger vers `/sujets/[id]` au lieu d'afficher l'éditeur inline.

```tsx
// apps/web/app/(dashboard)/sujets/page.tsx
// Supprimer le StoryEditor du layout
// La page ne montre QUE la liste des sujets
// Cliquer sur un sujet = navigation vers /sujets/[id]
```

### 2. Page Édition Plein Écran (`/sujets/[id]`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Sujets    Grève SNCF - Perturbations attendues    ⏱️ 2:34    💾 Sauv │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│                    ┌────────────────────────────────┐                   │
│                    │                                │                   │
│                    │       GOOGLE DOCS EMBED        │                   │
│                    │         (PLEIN ÉCRAN)          │                   │
│                    │                                │                   │
│                    │   ~85% de la hauteur écran     │                   │
│                    │                                │                   │
│                    │                                │                   │
│                    └────────────────────────────────┘                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 📊 387 mots │ Brouillon ▼ │ 🏷️ Politique │ 🎵 2 médias │ [+ Média]    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Composant ReadingTimer

**Comportement :**
- Appel API `syncGoogleDoc` toutes les **7 secondes** (compromis 5-10s)
- Affiche le temps de lecture calculé (150 mots/min pour radio)
- Indicateur visuel de sync (icône pulse pendant la requête)
- Affiche aussi le nombre de mots

**UI :**
```tsx
// Format affiché : "⏱️ 2:34 (387 mots)"
// Pendant sync : icône qui pulse
// Erreur sync : icône orange avec tooltip
```

---

## 💻 CODE À IMPLÉMENTER

### 1. Route dynamique `/sujets/[id]/page.tsx`

```tsx
// apps/web/app/(dashboard)/sujets/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { StoryEditorFullscreen } from '@/components/sujets/StoryEditorFullscreen';

export default function StoryEditPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const handleBack = () => {
    router.push('/sujets');
  };

  return <StoryEditorFullscreen storyId={storyId} onBack={handleBack} />;
}
```

### 2. Composant StoryEditorFullscreen

```tsx
// apps/web/components/sujets/StoryEditorFullscreen.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GoogleDocEmbed } from './GoogleDocEmbed';
import { ReadingTimer } from './ReadingTimer';
import { StoryBottomBar } from './StoryBottomBar';
import { MediaPicker } from './MediaPicker';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_REVIEW', label: 'En révision', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'APPROVED', label: 'Validé', color: 'bg-green-100 text-green-700' },
  { value: 'PUBLISHED', label: 'Publié', color: 'bg-blue-100 text-blue-700' },
  { value: 'ARCHIVED', label: 'Archivé', color: 'bg-gray-100 text-gray-500' },
];

const CATEGORIES = [
  'Actualite', 'Politique', 'Economie', 'Societe', 
  'Culture', 'Sport', 'Meteo', 'International', 'Local',
];

interface StoryEditorFullscreenProps {
  storyId: string;
  onBack: () => void;
}

export function StoryEditorFullscreen({ storyId, onBack }: StoryEditorFullscreenProps) {
  const router = useRouter();
  const { data: story, isLoading } = trpc.story.get.useQuery({ id: storyId });
  const utils = trpc.useUtils();

  // Local state
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [category, setCategory] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Mutations
  const updateStory = trpc.story.update.useMutation({
    onSuccess: () => {
      utils.story.get.invalidate({ id: storyId });
      utils.story.list.invalidate();
      setHasChanges(false);
    },
  });

  const deleteStory = trpc.story.delete.useMutation({
    onSuccess: () => {
      router.push('/sujets');
    },
  });

  // Initialize from story data
  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setStatus(story.status);
      setCategory(story.category || '');
    }
  }, [story]);

  const handleSave = useCallback(() => {
    updateStory.mutate({
      id: storyId,
      title,
      status: status as any,
      category: category || undefined,
    });
  }, [storyId, title, status, category, updateStory]);

  const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce sujet ?')) {
      deleteStory.mutate({ id: storyId });
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasChanges(true);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    updateStory.mutate({
      id: storyId,
      status: newStatus as any,
    });
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    updateStory.mutate({
      id: storyId,
      category: newCategory,
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, handleSave]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="h-14 bg-white border-b flex items-center px-4">
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Sujet non trouvé</p>
          <Button variant="link" onClick={onBack}>
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* TOP BAR - Minimaliste */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Sujets
          </Button>
          
          <div className="h-6 w-px bg-gray-200" />
          
          {isEditingTitle ? (
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                if (hasChanges) handleSave();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                  if (hasChanges) handleSave();
                }
                if (e.key === 'Escape') {
                  setTitle(story.title);
                  setIsEditingTitle(false);
                  setHasChanges(false);
                }
              }}
              className="h-8 text-lg font-medium max-w-md"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-lg font-medium truncate cursor-pointer hover:text-blue-600 transition-colors"
              title="Cliquer pour modifier le titre"
            >
              {title}
            </h1>
          )}
        </div>

        {/* Center: Reading Timer */}
        <div className="flex items-center">
          <ReadingTimer storyId={storyId} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteStory.isPending}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateStory.isPending}
            size="sm"
            className="min-w-[100px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateStory.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT - Google Docs Full Screen */}
      <main className="flex-1 p-4 min-h-0">
        {story.googleDocId ? (
          <GoogleDocEmbed
            docId={story.googleDocId}
            docUrl={story.googleDocUrl || undefined}
            className="h-full rounded-lg shadow-sm"
          />
        ) : (
          <div className="h-full bg-white rounded-lg border flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-gray-500">Aucun Google Doc lié à ce sujet</p>
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Lier un Google Doc
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM BAR - Contextuelle */}
      <StoryBottomBar
        storyId={storyId}
        status={status}
        category={category}
        mediaCount={story.media?.length || 0}
        onStatusChange={handleStatusChange}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
}
```

### 3. Composant ReadingTimer (CRUCIAL)

```tsx
// apps/web/components/sujets/ReadingTimer.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ReadingTimerProps {
  storyId: string;
  refreshInterval?: number; // en ms, défaut 7000 (7 secondes)
}

export function ReadingTimer({ 
  storyId, 
  refreshInterval = 7000 
}: ReadingTimerProps) {
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: story } = trpc.story.get.useQuery({ id: storyId });
  
  const syncGoogleDoc = trpc.story.syncGoogleDoc.useMutation({
    onSuccess: (data) => {
      if (data.content) {
        const words = data.content.trim().split(/\s+/).filter(Boolean).length;
        setWordCount(words);
        setDuration(data.estimatedDuration || Math.round((words / 150) * 60));
      }
      setLastSync(new Date());
      setSyncError(false);
    },
    onError: () => {
      setSyncError(true);
    },
  });

  // Initial values from story
  useEffect(() => {
    if (story) {
      if (story.content) {
        const words = story.content.trim().split(/\s+/).filter(Boolean).length;
        setWordCount(words);
      }
      if (story.estimatedDuration) {
        setDuration(story.estimatedDuration);
      }
    }
  }, [story]);

  // Auto-sync every refreshInterval
  useEffect(() => {
    if (!story?.googleDocId) return;

    // Sync immédiatement au montage
    syncGoogleDoc.mutate({ id: storyId });

    // Puis toutes les X secondes
    intervalRef.current = setInterval(() => {
      if (!syncGoogleDoc.isPending) {
        syncGoogleDoc.mutate({ id: storyId });
      }
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [storyId, story?.googleDocId, refreshInterval]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Si pas de Google Doc, afficher rien ou un placeholder
  if (!story?.googleDocId) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              syncError 
                ? "bg-orange-100 text-orange-700" 
                : "bg-blue-50 text-blue-700"
            )}
          >
            {syncGoogleDoc.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : syncError ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span className="tabular-nums">
              {formatDuration(duration)}
            </span>
            <span className="text-xs opacity-70">
              ({wordCount} mots)
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p>Temps de lecture radio (~150 mots/min)</p>
            {lastSync && (
              <p className="text-gray-400">
                Dernière sync: {lastSync.toLocaleTimeString()}
              </p>
            )}
            {syncError && (
              <p className="text-orange-500">
                Erreur de synchronisation
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### 4. Composant StoryBottomBar

```tsx
// apps/web/components/sujets/StoryBottomBar.tsx
'use client';

import { Music, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MediaPicker } from './MediaPicker';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon', color: 'bg-gray-500' },
  { value: 'IN_REVIEW', label: 'En révision', color: 'bg-yellow-500' },
  { value: 'APPROVED', label: 'Validé', color: 'bg-green-500' },
  { value: 'PUBLISHED', label: 'Publié', color: 'bg-blue-500' },
  { value: 'ARCHIVED', label: 'Archivé', color: 'bg-gray-400' },
];

const CATEGORIES = [
  'Actualite', 'Politique', 'Economie', 'Societe',
  'Culture', 'Sport', 'Meteo', 'International', 'Local',
];

interface StoryBottomBarProps {
  storyId: string;
  status: string;
  category: string;
  mediaCount: number;
  onStatusChange: (status: string) => void;
  onCategoryChange: (category: string) => void;
}

export function StoryBottomBar({
  storyId,
  status,
  category,
  mediaCount,
  onStatusChange,
  onCategoryChange,
}: StoryBottomBarProps) {
  const currentStatus = STATUS_OPTIONS.find(s => s.value === status);

  return (
    <footer className="h-12 bg-white border-t flex items-center justify-between px-4 shrink-0">
      {/* Left: Status & Category */}
      <div className="flex items-center gap-4">
        {/* Status selector */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${currentStatus?.color}`} />
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Category selector */}
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gray-400" />
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: Media */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Music className="h-4 w-4" />
          <span>{mediaCount} média{mediaCount !== 1 ? 's' : ''}</span>
        </div>
        <MediaPicker storyId={storyId} excludeIds={[]} />
      </div>
    </footer>
  );
}
```

### 5. Modifier CreateStoryDialog pour redirect

```tsx
// Dans apps/web/components/sujets/CreateStoryDialog.tsx
// Modifier le onSuccess pour rediriger vers la page d'édition

import { useRouter } from 'next/navigation';

// Dans le composant :
const router = useRouter();

// Après création réussie :
const handleCreate = async () => {
  // ... création du story ...
  const result = await createStory.mutateAsync({ ... });
  
  // Fermer le modal
  setOpen(false);
  
  // Rediriger vers la page d'édition plein écran
  router.push(`/sujets/${result.id}`);
};
```

### 6. Modifier la page /sujets pour navigation

```tsx
// apps/web/app/(dashboard)/sujets/page.tsx
// Simplifier pour ne garder que la liste

'use client';

import { useRouter } from 'next/navigation';
import { FileText, Inbox } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { StoryCard, StoryFilters, CreateStoryDialog } from '@/components/sujets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// ... (garder les filtres)

export default function SujetsPage() {
  const router = useRouter();
  // ... (garder la logique des filtres)

  const handleStoryClick = (storyId: string) => {
    router.push(`/sujets/${storyId}`);
  };

  const handleStoryCreated = (storyId: string) => {
    router.push(`/sujets/${storyId}`);
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        {/* ... garder le header ... */}
      </div>

      {/* Liste UNIQUEMENT - plus de split view */}
      <ScrollArea className="flex-1">
        <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {/* ... stories.map avec onClick={handleStoryClick} ... */}
        </div>
      </ScrollArea>
    </div>
  );
}
```

---

## 🔄 MODIFICATION API (syncGoogleDoc amélioré)

Le endpoint `syncGoogleDoc` doit retourner le contenu ET la durée estimée :

```typescript
// packages/api/src/routers/story.ts
// Modifier le retour de syncGoogleDoc

syncGoogleDoc: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const story = await ctx.db.story.findUniqueOrThrow({
      where: { id: input.id },
    });

    if (!story.googleDocId) {
      throw new Error('Story does not have a linked Google Doc');
    }

    try {
      const { getDocContent, estimateReadingDuration } =
        await import('../lib/google/docs');

      const content = await getDocContent(story.googleDocId);
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const estimatedDuration = estimateReadingDuration(wordCount);

      const updated = await ctx.db.story.update({
        where: { id: input.id },
        data: {
          content,
          estimatedDuration,
        },
      });

      // IMPORTANT: Retourner les données pour le timer
      return {
        id: updated.id,
        content: updated.content,
        estimatedDuration: updated.estimatedDuration,
        wordCount,
      };
    } catch (error) {
      console.error('Failed to sync Google Doc:', error);
      throw new Error('Failed to sync content from Google Doc');
    }
  }),
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Nouvelle page d'édition
- [ ] Créer `apps/web/app/(dashboard)/sujets/[id]/page.tsx`
- [ ] Créer `StoryEditorFullscreen.tsx`
- [ ] Créer `ReadingTimer.tsx` avec auto-refresh 7s
- [ ] Créer `StoryBottomBar.tsx`
- [ ] Exporter les nouveaux composants dans `index.ts`

### Phase 2 : Modifications existantes
- [ ] Modifier `CreateStoryDialog.tsx` pour redirect
- [ ] Modifier `page.tsx` (liste) pour navigation vers /sujets/[id]
- [ ] Modifier `StoryCard.tsx` pour être un lien/bouton clickable
- [ ] Modifier `syncGoogleDoc` dans l'API pour retourner content + duration

### Phase 3 : Tests & polish
- [ ] Tester le timer avec différentes longueurs de texte
- [ ] Vérifier le raccourci Ctrl+S
- [ ] Tester la navigation retour
- [ ] Vérifier le responsive (mobile)

---

## 🎯 POINTS CRITIQUES

1. **Timer toutes les 7 secondes** : Utiliser `setInterval` avec cleanup dans `useEffect`
2. **Ne pas spammer l'API** : Vérifier `!syncGoogleDoc.isPending` avant chaque appel
3. **UX du titre** : Clic pour éditer inline, Enter pour valider, Escape pour annuler
4. **Performance** : Le Google Doc iframe reste monté, seul le timer fait des requêtes
5. **Gestion d'erreur** : Afficher visuellement si la sync échoue

---

*Créé le 3 décembre 2025 pour Claude Code*
