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
import { useRouter } from 'next/navigation';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight, Presentation, MoreHorizontal, Trash2, ChevronDown, Check, Mail, FileEdit, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RundownItem } from './RundownItem';
import { AddItemDialog } from './AddItemDialog';
import { GenerateScriptButton } from './GenerateScriptButton';
import { SendToGuestsGmail } from './SendToGuestsGmail';
import { FullScriptEditor } from './FullScriptEditor';
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSendToGuestsDialog, setShowSendToGuestsDialog] = useState(false);
  const [showFullScriptEditor, setShowFullScriptEditor] = useState(false);
  const router = useRouter();

  const { data: rundown, isLoading } = trpc.rundown.get.useQuery(
    { id: rundownId },
    {
      // Rafraichir toutes les 15 secondes pour voir les mises a jour
      // des conducteurs imbriques (statut, contenu)
      refetchInterval: 15000,
    }
  );

  const utils = trpc.useUtils();

  const deleteRundown = trpc.rundown.delete.useMutation({
    onSuccess: () => {
      utils.rundown.list.invalidate();
      // Recharger la page pour revenir à la liste
      router.refresh();
      window.location.reload();
    },
  });

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

  const updateRundownStatus = trpc.rundown.update.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate({ id: rundownId });
      utils.rundown.list.invalidate();
    },
  });

  // Synchronisation des durées depuis les Google Docs
  const syncFromGoogleDocs = trpc.rundown.syncFromGoogleDocs.useMutation({
    onSuccess: (data) => {
      utils.rundown.get.invalidate({ id: rundownId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate timing - use rundown.startTime, show.startTime, or default to 12:00
  const timing = useMemo(() => {
    if (!rundown) return { startTimes: {}, totalDuration: 0 };

    // Priorité : startTime du rundown > startTime du show > 12:00
    const showStartTime = rundown.startTime || rundown.show.startTime || '12:00';
    const baseTime = parse(showStartTime, 'HH:mm', new Date());
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
          <div className="flex items-center gap-2">
            {/* Bouton de synchronisation des durées depuis Google Docs */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncFromGoogleDocs.mutate({ rundownId })}
              disabled={syncFromGoogleDocs.isPending}
              title="Synchroniser les durées depuis les Google Docs des sujets (basé sur le texte en gras)"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", syncFromGoogleDocs.isPending && "animate-spin")} />
              {syncFromGoogleDocs.isPending ? 'Sync...' : 'Sync GDocs'}
            </Button>
            <GenerateScriptButton
              rundownId={rundownId}
              rundownTitle={`${rundown.show.name} - ${format(new Date(rundown.date), 'd MMMM yyyy', { locale: fr })}`}
              existingScriptUrl={rundown.scriptDocUrl}
              existingScriptGeneratedAt={rundown.scriptGeneratedAt}
            />
            {/* Bouton pour éditer le script complet */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullScriptEditor(true)}
              title="Éditer le script complet de l'émission"
            >
              <FileEdit className="h-4 w-4 mr-2" />
              Script complet
            </Button>
            {/* Bouton pour envoyer le conducteur aux invités (visible uniquement si des variables template existent) */}
            {rundown.templateVariables && Object.keys(rundown.templateVariables as Record<string, string>).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendToGuestsDialog(true)}
                title="Envoyer le conducteur aux invités via Gmail"
              >
                <Mail className="h-4 w-4 mr-2" />
                Invités
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/prompteur/${rundownId}`, '_blank')}
              title="Ouvrir le prompteur dans une nouvelle fenetre"
            >
              <Presentation className="h-4 w-4 mr-2" />
              Prompteur
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity',
                  statusColors[rundown.status]
                )}>
                  {rundown.status === 'DRAFT' && 'Brouillon'}
                  {rundown.status === 'READY' && 'Pret'}
                  {rundown.status === 'ON_AIR' && 'A l\'antenne'}
                  {rundown.status === 'ARCHIVED' && 'Archive'}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => updateRundownStatus.mutate({ id: rundownId, status: 'DRAFT' })}
                  className="flex items-center justify-between"
                >
                  <span>Brouillon</span>
                  {rundown.status === 'DRAFT' && <Check className="h-4 w-4 text-green-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateRundownStatus.mutate({ id: rundownId, status: 'READY' })}
                  className="flex items-center justify-between"
                >
                  <span>Pret</span>
                  {rundown.status === 'READY' && <Check className="h-4 w-4 text-green-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateRundownStatus.mutate({ id: rundownId, status: 'ON_AIR' })}
                  className="flex items-center justify-between"
                >
                  <span>A l'antenne</span>
                  {rundown.status === 'ON_AIR' && <Check className="h-4 w-4 text-green-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateRundownStatus.mutate({ id: rundownId, status: 'ARCHIVED' })}
                  className="flex items-center justify-between"
                >
                  <span>Archive</span>
                  {rundown.status === 'ARCHIVED' && <Check className="h-4 w-4 text-green-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer ce conducteur
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                    rundownId={rundownId}
                    rundownDate={new Date(rundown.date)}
                    onDelete={() => handleDeleteItem(item.id)}
                    onStatusChange={(status) =>
                      handleStatusChange(item.id, status)
                    }
                    onDurationChange={(newDuration) =>
                      updateItem.mutate({ id: item.id, duration: newDuration })
                    }
                    onLinkChange={() => utils.rundown.get.invalidate({ id: rundownId })}
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

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce conducteur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Tous les elements du conducteur seront supprimes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteRundown.mutate({ id: rundownId })}
            >
              {deleteRundown.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog pour envoyer aux invités via Gmail */}
      {rundown && (
        <SendToGuestsGmail
          open={showSendToGuestsDialog}
          onOpenChange={setShowSendToGuestsDialog}
          rundownId={rundownId}
          showName={rundown.show.name}
          rundownDate={new Date(rundown.date)}
          startTime={rundown.startTime || rundown.show.startTime || '07:00'}
          items={rundown.items.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            duration: item.duration,
            position: item.position,
          }))}
          templateVariables={(rundown.templateVariables as Record<string, string>) || {}}
        />
      )}

      {/* Éditeur de script complet */}
      {showFullScriptEditor && rundown && (
        <FullScriptEditor
          rundownId={rundownId}
          showName={rundown.show.name}
          rundownDate={new Date(rundown.date)}
          startTime={rundown.startTime || rundown.show.startTime || '12:00'}
          items={rundown.items.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            duration: item.duration,
            position: item.position,
            script: item.script,
            googleDocId: item.googleDocId,
            notes: item.notes,
          }))}
          onClose={() => setShowFullScriptEditor(false)}
          onScriptsSaved={() => utils.rundown.get.invalidate({ id: rundownId })}
        />
      )}
    </div>
  );
}
