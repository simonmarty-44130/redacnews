'use client';

import { useState, useCallback } from 'react';
import { Search, Music, Plus, Play, Pause } from 'lucide-react';
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

export function MediaPicker({
  storyId,
  excludeIds = [],
  onSelect,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('AUDIO');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

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

  const handleSelect = (
    mediaItemId: string,
    insertionType: 'INLINE' | 'BACKGROUND' | 'REFERENCE'
  ) => {
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
          <DialogTitle>Selectionner un media</DialogTitle>
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
              <SelectItem value="VIDEO">Video</SelectItem>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="DOCUMENT">Document</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Liste des medias */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-500">Chargement...</span>
            </div>
          ) : filteredItems?.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-500">Aucun media trouve</span>
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

                  {/* Icone type */}
                  {item.type !== 'AUDIO' && (
                    <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                      <Music className="h-4 w-4 text-gray-500" />
                    </div>
                  )}

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {item.duration && (
                        <span>{formatDuration(item.duration)}</span>
                      )}
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
                      title="Inserer dans le flux"
                    >
                      Inline
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelect(item.id, 'REFERENCE')}
                      disabled={linkMedia.isPending}
                      title="Ajouter en reference"
                    >
                      Ref
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
