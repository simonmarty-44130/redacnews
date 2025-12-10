'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Inbox, Layers, Plus, X, CheckSquare } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  MediaCard,
  MediaPlayer,
  MediaFilters,
  MediaDetails,
  UploadZone,
  CollectionsSidebar,
} from '@/components/mediatheque';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Filters {
  search: string;
  type: string;
  collectionId: string | null;
}

interface PlayingMedia {
  id: string;
  title: string;
  url: string;
  type: 'AUDIO' | 'VIDEO';
  duration?: number | null;
}

export default function MediathequePage() {
  const router = useRouter();
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [playingMedia, setPlayingMedia] = useState<PlayingMedia | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: 'all',
    collectionId: null,
  });

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { data: mediaItems, isLoading } = trpc.media.list.useQuery({
    type:
      filters.type !== 'all'
        ? (filters.type as 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT')
        : undefined,
    search: filters.search || undefined,
    collectionId: filters.collectionId || undefined,
  });

  // Mutation pour mettre a jour la duree des fichiers existants
  const updateMedia = trpc.media.update.useMutation({
    onSuccess: () => {
      // Rafraichir la liste pour afficher la nouvelle duree
      utils.media.list.invalidate();
    },
  });

  const handlePlay = (media: {
    id: string;
    title: string;
    s3Url: string;
    type: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
    duration?: number | null;
  }) => {
    if (media.type === 'AUDIO' || media.type === 'VIDEO') {
      setPlayingMedia({
        id: media.id,
        title: media.title,
        url: media.s3Url,
        type: media.type,
        duration: media.duration,
      });
    }
  };

  // Callback pour sauvegarder la duree detectee par le lecteur
  const handleDurationDetected = useCallback((mediaId: string, duration: number) => {
    console.log(`[MediathequePage] Saving duration for ${mediaId}: ${duration}s`);
    updateMedia.mutate({ id: mediaId, duration });
  }, [updateMedia]);

  const handleMediaDeleted = () => {
    setSelectedMediaId(null);
    if (playingMedia && playingMedia.id === selectedMediaId) {
      setPlayingMedia(null);
    }
  };

  // Selection handlers
  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const selectAllAudio = () => {
    if (!mediaItems) return;
    const audioIds = mediaItems.filter(m => m.type === 'AUDIO').map(m => m.id);
    setSelectedIds(new Set(audioIds));
  };

  // Count selected audio files
  const selectedAudioCount = useMemo(() => {
    if (!mediaItems) return 0;
    return Array.from(selectedIds).filter(id => {
      const media = mediaItems.find(m => m.id === id);
      return media?.type === 'AUDIO';
    }).length;
  }, [selectedIds, mediaItems]);

  // Navigate to audio editor with selected files
  const handleMontage = () => {
    if (!mediaItems) return;
    const audioIds = Array.from(selectedIds).filter(id => {
      const media = mediaItems.find(m => m.id === id);
      return media?.type === 'AUDIO';
    });
    if (audioIds.length > 0) {
      router.push(`/audio-editor?media=${audioIds.join(',')}`);
    }
  };

  // Navigate to audio editor for new montage
  const handleNewMontage = () => {
    router.push('/audio-editor');
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Mediatheque</h1>
            {mediaItems && (
              <span className="text-sm text-gray-500">
                ({mediaItems.length} fichier{mediaItems.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Selection mode toggle */}
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) {
                  setSelectedIds(new Set());
                }
              }}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {selectionMode ? 'Annuler' : 'Selectionner'}
            </Button>

            {/* New montage button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewMontage}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau montage
            </Button>

            <UploadZone />
          </div>
        </div>

        {/* Selection toolbar */}
        {selectionMode && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-700">
              {selectedIds.size} element{selectedIds.size !== 1 ? 's' : ''} selectionne{selectedIds.size !== 1 ? 's' : ''}
              {selectedAudioCount > 0 && selectedAudioCount !== selectedIds.size && (
                <span className="text-blue-500"> (dont {selectedAudioCount} audio)</span>
              )}
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllAudio}
              className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
            >
              Selectionner tous les audios
            </Button>
            {selectedAudioCount > 0 && (
              <Button
                size="sm"
                onClick={handleMontage}
              >
                <Layers className="h-4 w-4 mr-2" />
                Monter ({selectedAudioCount} fichier{selectedAudioCount > 1 ? 's' : ''})
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelection}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <MediaFilters
          filters={{ search: filters.search, type: filters.type }}
          onFiltersChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collections sidebar */}
        <CollectionsSidebar
          selectedCollectionId={filters.collectionId}
          onSelectCollection={(collectionId) =>
            setFilters({ ...filters, collectionId })
          }
          selectedType={filters.type}
          onSelectType={(type) => setFilters({ ...filters, type })}
        />

        {/* Media grid/list */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoading ? (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                      : 'space-y-3'
                  )}
                >
                  {[...Array(10)].map((_, i) => (
                    <Skeleton
                      key={i}
                      className={viewMode === 'grid' ? 'aspect-square' : 'h-16'}
                    />
                  ))}
                </div>
              ) : mediaItems && mediaItems.length > 0 ? (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                      : 'space-y-3'
                  )}
                >
                  {mediaItems.map((media) => (
                    <MediaCard
                      key={media.id}
                      media={media}
                      isSelected={media.id === selectedMediaId}
                      onClick={() => {
                        if (selectionMode) {
                          toggleSelection(media.id, !selectedIds.has(media.id));
                        } else {
                          setSelectedMediaId(media.id);
                        }
                      }}
                      onPlay={() => handlePlay(media)}
                      viewMode={viewMode}
                      isSelectable={selectionMode}
                      isChecked={selectedIds.has(media.id)}
                      onCheckChange={(checked) => toggleSelection(media.id, checked)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Inbox className="h-16 w-16 mb-4 text-gray-300" />
                  <p className="font-medium">Aucun fichier</p>
                  <p className="text-sm mt-1">
                    {filters.search || filters.type !== 'all' || filters.collectionId
                      ? 'Aucun fichier ne correspond aux filtres'
                      : 'Uploadez votre premier fichier pour commencer'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Details panel */}
        {selectedMediaId && (
          <MediaDetails
            mediaId={selectedMediaId}
            onClose={() => setSelectedMediaId(null)}
            onDelete={handleMediaDeleted}
          />
        )}
      </div>

      {/* Audio player */}
      {playingMedia && (
        <MediaPlayer
          title={playingMedia.title}
          url={playingMedia.url}
          type={playingMedia.type}
          mediaId={playingMedia.id}
          currentDuration={playingMedia.duration}
          onClose={() => setPlayingMedia(null)}
          onDurationDetected={handleDurationDetected}
        />
      )}
    </div>
  );
}
