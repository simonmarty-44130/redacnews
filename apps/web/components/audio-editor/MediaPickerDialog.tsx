'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Music,
  Play,
  Pause,
  Check,
  X,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mediaItems: Array<{
    id: string;
    title: string;
    s3Url: string;
    duration?: number | null;
  }>) => void;
  excludeIds?: string[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}: MediaPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Query audio media
  const { data: mediaItems, isLoading } = trpc.media.list.useQuery(
    { type: 'AUDIO', search: search || undefined },
    { enabled: open }
  );

  // Filter out excluded IDs
  const availableMedia = useMemo(() => {
    if (!mediaItems) return [];
    return mediaItems.filter(m => !excludeIds.includes(m.id));
  }, [mediaItems, excludeIds]);

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Play preview
  const handlePlay = (media: { id: string; s3Url: string }) => {
    // Stop current audio
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }

    if (playingId === media.id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(media.s3Url);
    audio.play();
    audio.onended = () => setPlayingId(null);
    setAudioElement(audio);
    setPlayingId(media.id);
  };

  // Handle select
  const handleSelect = () => {
    const selectedMedia = availableMedia.filter(m => selectedIds.has(m.id));
    onSelect(selectedMedia);
    setSelectedIds(new Set());
    setSearch('');
  };

  // Handle close
  const handleClose = () => {
    // Stop audio
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    setPlayingId(null);
    setSelectedIds(new Set());
    setSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-purple-500" />
            Ajouter des pistes
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Media list */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : availableMedia.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Music className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Aucun fichier audio disponible</p>
              <p className="text-sm mt-1">
                {search
                  ? 'Aucun resultat pour cette recherche'
                  : excludeIds.length > 0
                  ? 'Tous les fichiers audio sont deja dans le montage'
                  : 'Uploadez des fichiers audio dans la mediatheque'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {availableMedia.map(media => {
                const isSelected = selectedIds.has(media.id);
                const isPlaying = playingId === media.id;

                return (
                  <div
                    key={media.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    )}
                    onClick={() => toggleSelection(media.id)}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(media.id)}
                      className="pointer-events-none"
                    />

                    {/* Icon */}
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                      <Music className="h-4 w-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {media.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {media.uploadedBy.firstName && media.uploadedBy.lastName
                          ? `${media.uploadedBy.firstName} ${media.uploadedBy.lastName}`
                          : media.uploadedBy.email.split('@')[0]}
                      </p>
                    </div>

                    {/* Duration */}
                    {media.duration && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        {formatDuration(media.duration)}
                      </div>
                    )}

                    {/* Play button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(media);
                      }}
                      className="h-8 w-8"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <span className="text-sm text-gray-500">
                {selectedIds.size} fichier{selectedIds.size > 1 ? 's' : ''} selectionne{selectedIds.size > 1 ? 's' : ''}
              </span>
            )}
            <Button
              onClick={handleSelect}
              disabled={selectedIds.size === 0}
            >
              <Check className="h-4 w-4 mr-2" />
              Ajouter {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
