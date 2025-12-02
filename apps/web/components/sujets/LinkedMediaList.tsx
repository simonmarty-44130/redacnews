'use client';

import { useCallback, useState } from 'react';
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
import { GripVertical, Trash2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

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
  REFERENCE: { label: 'Ref', color: 'bg-gray-100 text-gray-700' },
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

  const typeInfo =
    insertionTypeLabels[item.insertionType as keyof typeof insertionTypeLabels];

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
          <Badge className={cn('text-xs px-1.5 py-0', typeInfo?.color)}>
            {typeInfo?.label}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
        onClick={() =>
          unlinkMedia.mutate({ storyId, mediaItemId: item.mediaItemId })
        }
        disabled={unlinkMedia.isPending}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function LinkedMediaList({ storyId }: LinkedMediaListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

  const { data: linkedMedia, isLoading } = trpc.storyMedia.listByStory.useQuery(
    { storyId }
  );
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

  const handlePlay = useCallback(
    (url: string, id: string) => {
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
    },
    [audioElement, playingId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && linkedMedia) {
      const oldIndex = linkedMedia.findIndex(
        (item) => item.mediaItemId === active.id
      );
      const newIndex = linkedMedia.findIndex(
        (item) => item.mediaItemId === over.id
      );

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
        Aucun media attache
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
