'use client';

import { useState } from 'react';
import { FolderOpen, Inbox } from 'lucide-react';
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
}

export default function MediathequePage() {
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [playingMedia, setPlayingMedia] = useState<PlayingMedia | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: 'all',
    collectionId: null,
  });

  const { data: mediaItems, isLoading } = trpc.media.list.useQuery({
    type:
      filters.type !== 'all'
        ? (filters.type as 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT')
        : undefined,
    search: filters.search || undefined,
    collectionId: filters.collectionId || undefined,
  });

  const handlePlay = (media: {
    id: string;
    title: string;
    s3Url: string;
    type: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  }) => {
    if (media.type === 'AUDIO' || media.type === 'VIDEO') {
      setPlayingMedia({
        id: media.id,
        title: media.title,
        url: media.s3Url,
        type: media.type,
      });
    }
  };

  const handleMediaDeleted = () => {
    setSelectedMediaId(null);
    if (playingMedia && playingMedia.id === selectedMediaId) {
      setPlayingMedia(null);
    }
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
          <UploadZone />
        </div>
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
                      onClick={() => setSelectedMediaId(media.id)}
                      onPlay={() => handlePlay(media)}
                      viewMode={viewMode}
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
          onClose={() => setPlayingMedia(null)}
        />
      )}
    </div>
  );
}
