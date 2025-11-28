'use client';

import { useState, useMemo, useCallback } from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { format, addSeconds, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { RundownItem } from './RundownItem';
import { AddItemDialog } from './AddItemDialog';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface RundownEditorProps {
  rundownId: string;
}

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-700',
  READY: 'bg-green-100 text-green-700',
  ON_AIR: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-blue-100 text-blue-700',
};

export function RundownEditor({ rundownId }: RundownEditorProps) {
  const { data: rundown, isLoading } = trpc.rundown.get.useQuery({
    id: rundownId,
  });

  const utils = trpc.useUtils();

  const reorderItems = trpc.rundown.reorderItems.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate({ id: rundownId });
    },
  });

  const updateItem = trpc.rundown.updateItem.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate({ id: rundownId });
    },
  });

  const deleteItem = trpc.rundown.deleteItem.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate({ id: rundownId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate timing
  const timing = useMemo(() => {
    if (!rundown) return { startTimes: {}, totalDuration: 0 };

    const baseTime = parse('12:00', 'HH:mm', new Date());
    let currentTime = baseTime;
    const startTimes: Record<string, string> = {};
    let totalDuration = 0;

    rundown.items.forEach((item) => {
      startTimes[item.id] = format(currentTime, 'HH:mm:ss');
      currentTime = addSeconds(currentTime, item.duration);
      totalDuration += item.duration;
    });

    return { startTimes, totalDuration };
  }, [rundown]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id && rundown) {
        const oldIndex = rundown.items.findIndex((i) => i.id === active.id);
        const newIndex = rundown.items.findIndex((i) => i.id === over.id);

        const newOrder = arrayMove(rundown.items, oldIndex, newIndex);
        const itemIds = newOrder.map((i) => i.id);

        reorderItems.mutate({ rundownId, itemIds });
      }
    },
    [rundown, rundownId, reorderItems]
  );

  const handleStatusChange = useCallback(
    (itemId: string, status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE') => {
      updateItem.mutate({ id: itemId, status });
    },
    [updateItem]
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      if (confirm('Supprimer cet element ?')) {
        deleteItem.mutate({ id: itemId });
      }
    },
    [deleteItem]
  );

  const formatTotalDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!rundown) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Conducteur non trouve
      </div>
    );
  }

  const targetDuration = rundown.show.defaultDuration * 60;
  const durationDiff = timing.totalDuration - targetDuration;
  const isOvertime = durationDiff > 0;
  const isUndertime = durationDiff < -60; // More than 1 min under

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold">{rundown.show.name}</h2>
            <p className="text-sm text-gray-500">
              {format(new Date(rundown.date), 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          </div>
          <Badge className={statusColors[rundown.status]}>
            {rundown.status === 'DRAFT' && 'Brouillon'}
            {rundown.status === 'READY' && 'Pret'}
            {rundown.status === 'ON_AIR' && 'A l\'antenne'}
            {rundown.status === 'ARCHIVED' && 'Archive'}
          </Badge>
        </div>

        {/* Timing bar */}
        <div
          className={cn(
            'flex items-center gap-4 p-3 rounded-lg',
            isOvertime && 'bg-red-50',
            isUndertime && 'bg-orange-50',
            !isOvertime && !isUndertime && 'bg-gray-50'
          )}
        >
          <Clock className="h-5 w-5 text-gray-600" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg">
                {formatTotalDuration(timing.totalDuration)}
              </span>
              <span className="text-gray-500">/</span>
              <span className="font-mono text-gray-500">
                {rundown.show.defaultDuration}:00
              </span>
            </div>
          </div>
          {(isOvertime || isUndertime) && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                isOvertime ? 'text-red-600' : 'text-orange-600'
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              {isOvertime ? '+' : ''}
              {formatTotalDuration(Math.abs(durationDiff))}
            </div>
          )}
        </div>
      </div>

      {/* Items list */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rundown.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {rundown.items.map((item) => (
                  <RundownItem
                    key={item.id}
                    item={item}
                    startTime={timing.startTimes[item.id] || '--:--:--'}
                    onDelete={() => handleDeleteItem(item.id)}
                    onStatusChange={(status) =>
                      handleStatusChange(item.id, status)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add item */}
          <div className="mt-4 flex justify-center">
            <AddItemDialog rundownId={rundownId} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
