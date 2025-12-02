# PROMPT - Corrections et Debug Complet RédacNews

> **Objectif** : Corriger les manques identifiés et effectuer un debug complet du projet RédacNews
> **Date** : 2 décembre 2025
> **Chemin projet** : `/Users/directionradiofidelite/projects/redacnews`

---

## 📋 CONTEXTE

RédacNews est un NRCS (Newsroom Computer System) SaaS pour petites radios. Le projet est en développement local avec la stack suivante :

- **Frontend** : Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend** : tRPC, Prisma ORM
- **Base de données** : PostgreSQL (AWS RDS)
- **Stockage** : AWS S3 + CloudFront
- **Auth** : AWS Cognito
- **Temps réel** : Yjs + WebSocket
- **Audio** : WaveSurfer.js (actuel), Tone.js (à intégrer)

---

## 🔴 CORRECTIONS PRIORITAIRES

### CORRECTION 1 : Liaison bidirectionnelle Son ↔ Sujet

**Problème** : Les sons peuvent être attachés aux sujets mais :
- Pas de composant UI pour sélectionner/lier les sons depuis l'éditeur de sujet
- Pas de vue "Utilisations" montrant où un son est utilisé
- Le modèle `StoryMedia` est basique (manque type d'insertion, timecode, etc.)

**Actions à effectuer** :

#### 1.1 Enrichir le schéma Prisma

Modifier `packages/db/prisma/schema.prisma` - Remplacer le modèle `StoryMedia` par :

```prisma
model StoryMedia {
  id          String   @id @default(cuid())
  storyId     String
  mediaItemId String
  position    Int
  notes       String?
  
  // NOUVEAUX CHAMPS
  insertionType   MediaInsertionType @default(REFERENCE)
  timecodeStart   Int?               // Position en secondes dans le sujet
  timecodeEnd     Int?
  textMarker      String?            // Texte de repère dans le script
  cuePoint        String?            // Point de lancement ("après intro", etc.)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  story     Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)
  mediaItem MediaItem @relation(fields: [mediaItemId], references: [id])

  @@unique([storyId, mediaItemId])
  @@index([storyId])
  @@index([mediaItemId])
}

enum MediaInsertionType {
  INLINE      // Son intégré dans le flux (ITW, ambiance)
  BACKGROUND  // Son en fond pendant la lecture
  REFERENCE   // Simple référence / pièce jointe
}
```

Ajouter aussi un champ dénormalisé sur `MediaItem` pour le comptage :

```prisma
model MediaItem {
  // ... champs existants ...
  
  // NOUVEAU : compteur d'utilisations (dénormalisé pour performance)
  usageCount      Int           @default(0)
  
  // ... relations existantes ...
}
```

#### 1.2 Créer le router tRPC `storyMedia`

Créer le fichier `packages/api/src/routers/storyMedia.ts` :

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const storyMediaRouter = router({
  // Lier un média à un sujet
  link: protectedProcedure
    .input(z.object({
      storyId: z.string(),
      mediaItemId: z.string(),
      insertionType: z.enum(['INLINE', 'BACKGROUND', 'REFERENCE']).default('REFERENCE'),
      notes: z.string().optional(),
      timecodeStart: z.number().optional(),
      timecodeEnd: z.number().optional(),
      textMarker: z.string().optional(),
      cuePoint: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storyId, mediaItemId, ...data } = input;
      
      // Récupérer la dernière position
      const lastItem = await ctx.db.storyMedia.findFirst({
        where: { storyId },
        orderBy: { position: 'desc' },
      });
      
      // Créer la liaison
      const storyMedia = await ctx.db.storyMedia.create({
        data: {
          storyId,
          mediaItemId,
          position: (lastItem?.position ?? 0) + 1,
          ...data,
        },
        include: { mediaItem: true },
      });
      
      // Incrémenter le compteur d'utilisation
      await ctx.db.mediaItem.update({
        where: { id: mediaItemId },
        data: { usageCount: { increment: 1 } },
      });
      
      return storyMedia;
    }),

  // Délier un média d'un sujet
  unlink: protectedProcedure
    .input(z.object({
      storyId: z.string(),
      mediaItemId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.storyMedia.delete({
        where: {
          storyId_mediaItemId: {
            storyId: input.storyId,
            mediaItemId: input.mediaItemId,
          },
        },
      });
      
      // Décrémenter le compteur d'utilisation
      await ctx.db.mediaItem.update({
        where: { id: input.mediaItemId },
        data: { usageCount: { decrement: 1 } },
      });
      
      return { success: true };
    }),

  // Mettre à jour les métadonnées d'une liaison
  update: protectedProcedure
    .input(z.object({
      storyId: z.string(),
      mediaItemId: z.string(),
      insertionType: z.enum(['INLINE', 'BACKGROUND', 'REFERENCE']).optional(),
      notes: z.string().nullable().optional(),
      timecodeStart: z.number().nullable().optional(),
      timecodeEnd: z.number().nullable().optional(),
      textMarker: z.string().nullable().optional(),
      cuePoint: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storyId, mediaItemId, ...data } = input;
      
      return ctx.db.storyMedia.update({
        where: {
          storyId_mediaItemId: { storyId, mediaItemId },
        },
        data,
        include: { mediaItem: true },
      });
    }),

  // Réordonner les médias d'un sujet
  reorder: protectedProcedure
    .input(z.object({
      storyId: z.string(),
      mediaItemIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = input.mediaItemIds.map((mediaItemId, index) =>
        ctx.db.storyMedia.update({
          where: {
            storyId_mediaItemId: {
              storyId: input.storyId,
              mediaItemId,
            },
          },
          data: { position: index },
        })
      );
      
      await ctx.db.$transaction(updates);
      return { success: true };
    }),

  // Lister les médias d'un sujet
  listByStory: protectedProcedure
    .input(z.object({ storyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyMedia.findMany({
        where: { storyId: input.storyId },
        include: {
          mediaItem: {
            include: { uploadedBy: true },
          },
        },
        orderBy: { position: 'asc' },
      });
    }),

  // Lister les utilisations d'un média (NOUVEAU - vue "Utilisations")
  listByMedia: protectedProcedure
    .input(z.object({ mediaItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [storyUsages, rundownUsages] = await Promise.all([
        // Utilisations dans les sujets
        ctx.db.storyMedia.findMany({
          where: { mediaItemId: input.mediaItemId },
          include: {
            story: {
              include: { author: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Utilisations dans les conducteurs
        ctx.db.rundownItemMedia.findMany({
          where: { mediaItemId: input.mediaItemId },
          include: {
            rundownItem: {
              include: {
                rundown: {
                  include: { show: true },
                },
              },
            },
          },
          orderBy: { rundownItem: { createdAt: 'desc' } },
        }),
      ]);
      
      return { storyUsages, rundownUsages };
    }),
});
```

#### 1.3 Enregistrer le router dans root.ts

Modifier `packages/api/src/root.ts` :

```typescript
import { router } from './trpc';
import { rundownRouter } from './routers/rundown';
import { storyRouter } from './routers/story';
import { mediaRouter } from './routers/media';
import { storyMediaRouter } from './routers/storyMedia'; // NOUVEAU

export const appRouter = router({
  rundown: rundownRouter,
  story: storyRouter,
  media: mediaRouter,
  storyMedia: storyMediaRouter, // NOUVEAU
});

export type AppRouter = typeof appRouter;
```

#### 1.4 Créer le composant MediaPicker

Créer `apps/web/components/sujets/MediaPicker.tsx` :

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Search, Music, Plus, X, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface MediaPickerProps {
  storyId: string;
  excludeIds?: string[];
  onSelect?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MediaPicker({ storyId, excludeIds = [], onSelect }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('AUDIO');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const { data: mediaItems, isLoading } = trpc.media.list.useQuery({
    type: typeFilter as 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT',
    search: search || undefined,
  });

  const utils = trpc.useUtils();

  const linkMedia = trpc.storyMedia.link.useMutation({
    onSuccess: () => {
      utils.storyMedia.listByStory.invalidate({ storyId });
      utils.story.get.invalidate({ id: storyId });
      onSelect?.();
    },
  });

  const filteredItems = mediaItems?.filter(
    (item) => !excludeIds.includes(item.id)
  );

  const handlePlay = useCallback((url: string, id: string) => {
    if (audioElement) {
      audioElement.pause();
    }
    
    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setPlayingId(null);
    setAudioElement(audio);
    setPlayingId(id);
  }, [audioElement, playingId]);

  const handleSelect = (mediaItemId: string, insertionType: 'INLINE' | 'BACKGROUND' | 'REFERENCE') => {
    linkMedia.mutate({
      storyId,
      mediaItemId,
      insertionType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un son
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sélectionner un média</DialogTitle>
        </DialogHeader>

        {/* Filtres */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUDIO">Audio</SelectItem>
              <SelectItem value="VIDEO">Vidéo</SelectItem>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="DOCUMENT">Document</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Liste des médias */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-500">Chargement...</span>
            </div>
          ) : filteredItems?.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-500">Aucun média trouvé</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  {/* Play button pour audio */}
                  {item.type === 'AUDIO' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handlePlay(item.s3Url, item.id)}
                    >
                      {playingId === item.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Icône type */}
                  {item.type !== 'AUDIO' && (
                    <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                      <Music className="h-4 w-4 text-gray-500" />
                    </div>
                  )}

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {item.duration && <span>{formatDuration(item.duration)}</span>}
                      {item.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions d'insertion */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelect(item.id, 'INLINE')}
                      disabled={linkMedia.isPending}
                      title="Insérer dans le flux"
                    >
                      Inline
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelect(item.id, 'REFERENCE')}
                      disabled={linkMedia.isPending}
                      title="Ajouter en référence"
                    >
                      Réf
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

#### 1.5 Créer le composant LinkedMediaList

Créer `apps/web/components/sujets/LinkedMediaList.tsx` :

```typescript
'use client';

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Music, Play, Pause, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface LinkedMediaListProps {
  storyId: string;
}

interface SortableItemProps {
  item: any;
  storyId: string;
  onPlay: (url: string, id: string) => void;
  playingId: string | null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const insertionTypeLabels = {
  INLINE: { label: 'Inline', color: 'bg-blue-100 text-blue-700' },
  BACKGROUND: { label: 'Fond', color: 'bg-purple-100 text-purple-700' },
  REFERENCE: { label: 'Réf', color: 'bg-gray-100 text-gray-700' },
};

function SortableItem({ item, storyId, onPlay, playingId }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.mediaItemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const utils = trpc.useUtils();

  const unlinkMedia = trpc.storyMedia.unlink.useMutation({
    onSuccess: () => {
      utils.storyMedia.listByStory.invalidate({ storyId });
    },
  });

  const typeInfo = insertionTypeLabels[item.insertionType as keyof typeof insertionTypeLabels];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border bg-white',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </button>

      {/* Play button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onPlay(item.mediaItem.s3Url, item.mediaItemId)}
      >
        {playingId === item.mediaItemId ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
      </Button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.mediaItem.title}</p>
        <div className="flex items-center gap-1.5">
          {item.mediaItem.duration && (
            <span className="text-xs text-gray-500">
              {formatDuration(item.mediaItem.duration)}
            </span>
          )}
          <Badge className={cn('text-xs px-1.5 py-0', typeInfo.color)}>
            {typeInfo.label}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
        onClick={() => unlinkMedia.mutate({ storyId, mediaItemId: item.mediaItemId })}
        disabled={unlinkMedia.isPending}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function LinkedMediaList({ storyId }: LinkedMediaListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const { data: linkedMedia, isLoading } = trpc.storyMedia.listByStory.useQuery({ storyId });
  const utils = trpc.useUtils();

  const reorderMedia = trpc.storyMedia.reorder.useMutation({
    onSuccess: () => {
      utils.storyMedia.listByStory.invalidate({ storyId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handlePlay = useCallback((url: string, id: string) => {
    if (audioElement) {
      audioElement.pause();
    }
    
    if (playingId === id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setPlayingId(null);
    setAudioElement(audio);
    setPlayingId(id);
  }, [audioElement, playingId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && linkedMedia) {
      const oldIndex = linkedMedia.findIndex((item) => item.mediaItemId === active.id);
      const newIndex = linkedMedia.findIndex((item) => item.mediaItemId === over.id);
      
      const newOrder = arrayMove(linkedMedia, oldIndex, newIndex);
      const mediaItemIds = newOrder.map((item) => item.mediaItemId);
      
      reorderMedia.mutate({ storyId, mediaItemIds });
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Chargement...</div>;
  }

  if (!linkedMedia || linkedMedia.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Aucun média attaché
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={linkedMedia.map((item) => item.mediaItemId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {linkedMedia.map((item) => (
            <SortableItem
              key={item.mediaItemId}
              item={item}
              storyId={storyId}
              onPlay={handlePlay}
              playingId={playingId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

#### 1.6 Créer le composant MediaUsages

Créer `apps/web/components/mediatheque/MediaUsages.tsx` :

```typescript
'use client';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Radio, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc/client';
import Link from 'next/link';

interface MediaUsagesProps {
  mediaItemId: string;
}

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export function MediaUsages({ mediaItemId }: MediaUsagesProps) {
  const { data, isLoading } = trpc.storyMedia.listByMedia.useQuery({ mediaItemId });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Chargement...</div>;
  }

  const storyCount = data?.storyUsages?.length || 0;
  const rundownCount = data?.rundownUsages?.length || 0;
  const totalCount = storyCount + rundownCount;

  if (totalCount === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Ce média n'est utilisé nulle part
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">{totalCount} utilisation{totalCount > 1 ? 's' : ''}</span>
      </div>

      <Tabs defaultValue="stories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stories" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Sujets ({storyCount})
          </TabsTrigger>
          <TabsTrigger value="rundowns" className="text-xs">
            <Radio className="h-3 w-3 mr-1" />
            Conducteurs ({rundownCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories">
          <ScrollArea className="h-[200px]">
            {data?.storyUsages?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun sujet
              </p>
            ) : (
              <div className="space-y-2">
                {data?.storyUsages?.map((usage) => (
                  <Link
                    key={usage.id}
                    href={`/sujets?id=${usage.story.id}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors group"
                  >
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-600">
                        {usage.story.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{usage.story.author.firstName} {usage.story.author.lastName}</span>
                        <Badge className={statusColors[usage.story.status as keyof typeof statusColors]}>
                          {usage.story.status}
                        </Badge>
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rundowns">
          <ScrollArea className="h-[200px]">
            {data?.rundownUsages?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun conducteur
              </p>
            ) : (
              <div className="space-y-2">
                {data?.rundownUsages?.map((usage) => (
                  <Link
                    key={usage.id}
                    href={`/conducteur?id=${usage.rundownItem.rundown.id}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors group"
                  >
                    <Radio className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-600">
                        {usage.rundownItem.rundown.show.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(usage.rundownItem.rundown.date), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 1.7 Intégrer dans StoryEditor.tsx

Modifier `apps/web/components/sujets/StoryEditor.tsx` pour ajouter la section médias :

Ajouter les imports :
```typescript
import { MediaPicker } from './MediaPicker';
import { LinkedMediaList } from './LinkedMediaList';
```

Ajouter après la section "Edit form" (avant la fermeture de la ScrollArea) :
```typescript
<Separator />

{/* Section Médias attachés */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label>Médias attachés</Label>
    <MediaPicker
      storyId={storyId}
      excludeIds={story.media?.map((m) => m.mediaItemId) || []}
    />
  </div>
  <LinkedMediaList storyId={storyId} />
</div>
```

#### 1.8 Intégrer MediaUsages dans MediaDetails.tsx

Modifier `apps/web/components/mediatheque/MediaDetails.tsx` :

Ajouter l'import :
```typescript
import { MediaUsages } from './MediaUsages';
```

Ajouter après la section "Collections" :
```typescript
<Separator />

{/* Utilisations */}
<div className="space-y-3">
  <Label>Utilisations</Label>
  <MediaUsages mediaItemId={mediaId} />
</div>
```

---

### CORRECTION 2 : Package Éditeur Multipiste (Structure initiale)

**Note** : L'éditeur multipiste complet est un développement important. Ici on crée la structure de base.

#### 2.1 Initialiser le package

```bash
cd packages/audio-editor
npm init -y
```

Créer `packages/audio-editor/package.json` :
```json
{
  "name": "@redacnews/multitrack-editor",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "tone": "^14.8.49",
    "wavesurfer.js": "^7.8.0",
    "zustand": "^4.5.0",
    "immer": "^10.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

#### 2.2 Créer la structure de fichiers

```
packages/audio-editor/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── store/
│   │   └── editorStore.ts
│   ├── core/
│   │   └── AudioEngine.ts
│   └── components/
│       └── MultitrackEditor.tsx
├── package.json
└── tsconfig.json
```

Créer `packages/audio-editor/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Créer `packages/audio-editor/src/types.ts` :
```typescript
export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  clips: Clip[];
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  sourceUrl: string;
  startTime: number;  // Position sur la timeline (secondes)
  duration: number;   // Durée du clip
  offset: number;     // Offset dans le fichier source
  fadeIn: number;
  fadeOut: number;
}

export interface Project {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  tracks: Track[];
}

export interface EditorState {
  project: Project | null;
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  selectedClipIds: string[];
  selectedTrackId: string | null;
}
```

Créer `packages/audio-editor/src/store/editorStore.ts` :
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Project, Track, Clip, EditorState } from '../types';

interface EditorActions {
  // Project
  createProject: (name: string) => void;
  loadProject: (project: Project) => void;
  
  // Tracks
  addTrack: (name?: string) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  
  // Clips
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  
  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  
  // Selection
  selectClip: (clipId: string, addToSelection?: boolean) => void;
  selectTrack: (trackId: string) => void;
  clearSelection: () => void;
  
  // View
  setZoom: (zoom: number) => void;
}

const TRACK_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    // Initial state
    project: null,
    currentTime: 0,
    isPlaying: false,
    zoom: 50,
    selectedClipIds: [],
    selectedTrackId: null,

    // Project actions
    createProject: (name) => {
      set((state) => {
        state.project = {
          id: nanoid(),
          name,
          duration: 300, // 5 minutes par défaut
          sampleRate: 44100,
          tracks: [],
        };
      });
    },

    loadProject: (project) => {
      set((state) => {
        state.project = project;
        state.currentTime = 0;
        state.isPlaying = false;
        state.selectedClipIds = [];
        state.selectedTrackId = null;
      });
    },

    // Track actions
    addTrack: (name) => {
      set((state) => {
        if (!state.project) return;
        
        const trackIndex = state.project.tracks.length;
        state.project.tracks.push({
          id: nanoid(),
          name: name || `Piste ${trackIndex + 1}`,
          color: TRACK_COLORS[trackIndex % TRACK_COLORS.length],
          volume: 1,
          pan: 0,
          mute: false,
          solo: false,
          clips: [],
        });
      });
    },

    removeTrack: (trackId) => {
      set((state) => {
        if (!state.project) return;
        state.project.tracks = state.project.tracks.filter((t) => t.id !== trackId);
      });
    },

    updateTrack: (trackId, updates) => {
      set((state) => {
        if (!state.project) return;
        const track = state.project.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      });
    },

    // Clip actions
    addClip: (trackId, clipData) => {
      set((state) => {
        if (!state.project) return;
        const track = state.project.tracks.find((t) => t.id === trackId);
        if (track) {
          track.clips.push({
            ...clipData,
            id: nanoid(),
            trackId,
          });
        }
      });
    },

    removeClip: (clipId) => {
      set((state) => {
        if (!state.project) return;
        for (const track of state.project.tracks) {
          track.clips = track.clips.filter((c) => c.id !== clipId);
        }
        state.selectedClipIds = state.selectedClipIds.filter((id) => id !== clipId);
      });
    },

    moveClip: (clipId, newTrackId, newStartTime) => {
      set((state) => {
        if (!state.project) return;
        
        let clip: Clip | undefined;
        
        // Remove from current track
        for (const track of state.project.tracks) {
          const index = track.clips.findIndex((c) => c.id === clipId);
          if (index !== -1) {
            clip = track.clips.splice(index, 1)[0];
            break;
          }
        }
        
        // Add to new track
        if (clip) {
          const newTrack = state.project.tracks.find((t) => t.id === newTrackId);
          if (newTrack) {
            clip.trackId = newTrackId;
            clip.startTime = Math.max(0, newStartTime);
            newTrack.clips.push(clip);
          }
        }
      });
    },

    // Playback actions
    play: () => set((state) => { state.isPlaying = true; }),
    pause: () => set((state) => { state.isPlaying = false; }),
    stop: () => set((state) => {
      state.isPlaying = false;
      state.currentTime = 0;
    }),
    seek: (time) => set((state) => {
      state.currentTime = Math.max(0, time);
    }),

    // Selection actions
    selectClip: (clipId, addToSelection = false) => {
      set((state) => {
        if (addToSelection) {
          if (!state.selectedClipIds.includes(clipId)) {
            state.selectedClipIds.push(clipId);
          }
        } else {
          state.selectedClipIds = [clipId];
        }
      });
    },

    selectTrack: (trackId) => {
      set((state) => {
        state.selectedTrackId = trackId;
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedClipIds = [];
        state.selectedTrackId = null;
      });
    },

    // View actions
    setZoom: (zoom) => {
      set((state) => {
        state.zoom = Math.max(10, Math.min(200, zoom));
      });
    },
  }))
);
```

Créer `packages/audio-editor/src/index.ts` :
```typescript
// Types
export * from './types';

// Store
export { useEditorStore } from './store/editorStore';

// Components (à compléter)
// export { MultitrackEditor } from './components/MultitrackEditor';
```

---

## 🔧 DEBUG COMPLET

### Étape 1 : Vérification de l'environnement

Exécuter ces commandes dans le terminal :

```bash
cd /Users/directionradiofidelite/projects/redacnews

# 1. Vérifier Node.js et npm
node --version  # Doit être >= 18
npm --version   # Doit être >= 9

# 2. Vérifier les dépendances
npm install

# 3. Vérifier TypeScript
npx tsc --version

# 4. Vérifier la configuration
cat .env.example
```

### Étape 2 : Vérification de la base de données

```bash
cd packages/db

# 1. Générer le client Prisma
npx prisma generate

# 2. Vérifier la connexion DB (nécessite .env avec DATABASE_URL)
npx prisma db pull --print

# 3. Pousser le schéma si besoin
npx prisma db push

# 4. Ouvrir Prisma Studio pour inspecter les données
npx prisma studio
```

### Étape 3 : Vérification du build

```bash
cd /Users/directionradiofidelite/projects/redacnews

# Build complet
npm run build

# Si erreurs, lancer le lint
npm run lint
```

### Étape 4 : Test de l'application

```bash
# Lancer en mode développement
npm run dev

# Vérifier dans le navigateur
# http://localhost:3000
```

### Étape 5 : Script de diagnostic complet

Créer `apps/web/scripts/diagnose.ts` :

```typescript
#!/usr/bin/env npx ts-node

import { PrismaClient } from '@prisma/client';

async function diagnose() {
  console.log('🔍 Diagnostic RédacNews\n');
  console.log('='.repeat(50));
  
  // 1. Vérifier les variables d'environnement
  console.log('\n📋 Variables d\'environnement:');
  const envVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
    'NEXT_PUBLIC_COGNITO_CLIENT_ID',
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'AWS_CLOUDFRONT_DOMAIN',
  ];
  
  for (const envVar of envVars) {
    const value = process.env[envVar];
    const status = value ? '✅' : '❌';
    const display = value ? value.substring(0, 20) + '...' : 'NON DÉFINI';
    console.log(`  ${status} ${envVar}: ${display}`);
  }
  
  // 2. Tester la connexion DB
  console.log('\n🗄️  Base de données:');
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    console.log('  ✅ Connexion réussie');
    
    // Compter les enregistrements
    const counts = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      shows: await prisma.show.count(),
      rundowns: await prisma.rundown.count(),
      stories: await prisma.story.count(),
      mediaItems: await prisma.mediaItem.count(),
      collections: await prisma.collection.count(),
    };
    
    console.log('  📊 Statistiques:');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`     - ${table}: ${count}`);
    }
  } catch (error) {
    console.log('  ❌ Erreur de connexion:', (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }
  
  // 3. Vérifier les fichiers critiques
  console.log('\n📁 Fichiers critiques:');
  const fs = await import('fs');
  const path = await import('path');
  
  const criticalFiles = [
    'apps/web/app/layout.tsx',
    'apps/web/app/(dashboard)/layout.tsx',
    'packages/db/prisma/schema.prisma',
    'packages/api/src/root.ts',
    'packages/api/src/trpc.ts',
  ];
  
  for (const file of criticalFiles) {
    const fullPath = path.join(process.cwd(), file);
    const exists = fs.existsSync(fullPath);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ Diagnostic terminé\n');
}

diagnose().catch(console.error);
```

### Étape 6 : Checklist de vérification manuelle

```markdown
## Checklist Debug RédacNews

### Infrastructure
- [ ] Node.js >= 18 installé
- [ ] npm >= 9 installé
- [ ] PostgreSQL accessible (RDS ou local)
- [ ] Variables d'environnement configurées

### Base de données
- [ ] `DATABASE_URL` valide
- [ ] `prisma generate` sans erreur
- [ ] `prisma db push` sans erreur
- [ ] Tables créées dans la DB

### Authentification (Cognito)
- [ ] `NEXT_PUBLIC_COGNITO_USER_POOL_ID` défini
- [ ] `NEXT_PUBLIC_COGNITO_CLIENT_ID` défini
- [ ] User Pool existe dans AWS Console
- [ ] App Client configuré correctement

### Stockage (S3)
- [ ] `AWS_S3_BUCKET` défini
- [ ] Bucket existe dans AWS Console
- [ ] CORS configuré sur le bucket
- [ ] Permissions IAM correctes

### Application
- [ ] `npm install` sans erreur
- [ ] `npm run build` sans erreur
- [ ] `npm run dev` démarre correctement
- [ ] Page d'accueil accessible sur localhost:3000

### Modules
- [ ] Conducteur : liste les émissions
- [ ] Sujets : créer/éditer un sujet
- [ ] Médiathèque : upload un fichier
- [ ] Audio : lire un son

### API tRPC
- [ ] `/api/trpc/[trpc]` répond
- [ ] Endpoints authentifiés fonctionnent
- [ ] Mutations créent des données en DB
```

---

## 📝 ORDRE D'EXÉCUTION

1. **Appliquer les corrections Prisma** (schema.prisma)
2. **Régénérer le client Prisma** (`npx prisma generate && npx prisma db push`)
3. **Créer le router storyMedia**
4. **Mettre à jour root.ts**
5. **Créer les composants UI** (MediaPicker, LinkedMediaList, MediaUsages)
6. **Intégrer dans StoryEditor et MediaDetails**
7. **Initialiser le package multitrack-editor**
8. **Lancer le script de diagnostic**
9. **Tester manuellement chaque module**
10. **Corriger les erreurs identifiées**

---

## ⚠️ POINTS D'ATTENTION

- **Toujours faire un backup** avant de modifier le schema Prisma
- **Tester après chaque modification** pour isoler les erreurs
- **Vérifier les types TypeScript** avec `npm run build`
- **Ne pas commiter les fichiers .env**
- **Utiliser des branches Git** pour les corrections majeures

---

*Généré le 2 décembre 2025*
