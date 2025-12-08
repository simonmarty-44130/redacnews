'use client';

import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Music, Upload, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DragItem } from '@/lib/audio-montage/types';

interface MediaItem {
  id: string;
  title: string;
  duration: number | null;
  s3Url: string;
  type: string;
}

interface ClipLibraryProps {
  mediaItems: MediaItem[];
  isLoading: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onImport: () => void;
}

function LibraryItem({ item }: { item: MediaItem }) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'LIBRARY_ITEM',
      item: (): DragItem => ({
        type: 'LIBRARY_ITEM',
        id: `new-${Date.now()}`,
        name: item.title,
        sourceUrl: item.s3Url,
        duration: item.duration || 0,
        mediaItemId: item.id,
      }),
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [item]
  );

  const formatDuration = (sec: number | null): string => {
    if (!sec) return '--:--';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={drag as unknown as React.LegacyRef<HTMLDivElement>}
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg cursor-grab',
        'hover:bg-muted transition-colors',
        isDragging && 'opacity-50 cursor-grabbing'
      )}
    >
      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
        <Music className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.title}</div>
        <div className="text-xs text-muted-foreground">
          {formatDuration(item.duration)}
        </div>
      </div>
    </div>
  );
}

export function ClipLibrary({
  mediaItems,
  isLoading,
  isCollapsed,
  onToggleCollapse,
  onImport,
}: ClipLibraryProps) {
  const [search, setSearch] = useState('');

  const filteredItems = mediaItems.filter(
    (item) =>
      item.type === 'AUDIO' &&
      item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="border-t bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <button
          className="flex items-center gap-2 text-sm font-medium"
          onClick={onToggleCollapse}
        >
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Bibliotheque de sons
          <span className="text-muted-foreground">({filteredItems.length})</span>
        </button>

        <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
          <Upload className="h-4 w-4" />
          Importer
        </Button>
      </div>

      {/* Contenu */}
      {!isCollapsed && (
        <div className="p-4">
          {/* Recherche */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un son..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Liste des sons */}
          <ScrollArea className="h-40">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Chargement...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Music className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucun son disponible</p>
                <p className="text-xs">Importez des sons depuis la mediatheque</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                {filteredItems.map((item) => (
                  <LibraryItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
