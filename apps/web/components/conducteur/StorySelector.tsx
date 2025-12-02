'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, FileText, Music, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';

interface StoryMedia {
  id: string;
  mediaItem: {
    id: string;
    title: string;
    type: string;
    duration: number | null;
    s3Url: string;
  };
}

interface Story {
  id: string;
  title: string;
  estimatedDuration: number | null;
  status: string;
  category: string | null;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  media: StoryMedia[];
}

interface StorySelectorProps {
  value?: string;
  onSelect: (story: Story | null) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatAuthorName(author: { firstName: string | null; lastName: string | null }): string {
  const parts = [author.firstName, author.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Auteur inconnu';
}

export function StorySelector({ value, onSelect, disabled }: StorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: stories, isLoading } = trpc.story.listForRundown.useQuery(
    { search: debouncedSearch || undefined },
    { enabled: open }
  );

  const selectedStory = stories?.find((s) => s.id === value);

  const handleSelect = useCallback(
    (storyId: string) => {
      const story = stories?.find((s) => s.id === storyId);
      if (story) {
        onSelect(story);
      }
      setOpen(false);
    },
    [stories, onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect(null);
    setSearchTerm('');
  }, [onSelect]);

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedStory ? (
              <span className="truncate">{selectedStory.title}</span>
            ) : (
              <span className="text-muted-foreground">Selectionner un sujet...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Rechercher un sujet..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {isLoading ? (
                <CommandEmpty>Chargement...</CommandEmpty>
              ) : !stories || stories.length === 0 ? (
                <CommandEmpty>Aucun sujet trouve.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {stories.map((story) => (
                    <CommandItem
                      key={story.id}
                      value={story.id}
                      onSelect={handleSelect}
                      className="flex flex-col items-start py-3"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === story.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="flex-1 truncate font-medium">
                          {story.title}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {story.status === 'APPROVED' ? 'Valide' : 'Publie'}
                        </Badge>
                      </div>
                      <div className="ml-10 flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {formatAuthorName(story.author)}
                        </span>
                        {story.category && (
                          <span className="text-blue-600">{story.category}</span>
                        )}
                        <span>{formatDuration(story.estimatedDuration)}</span>
                        {story.media.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Music className="h-3 w-3" />
                            {story.media.length} media
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected story details */}
      {selectedStory && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{selectedStory.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-xs"
            >
              Effacer
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatAuthorName(selectedStory.author)}</span>
            {selectedStory.category && <span>{selectedStory.category}</span>}
            <span>Duree estimee: {formatDuration(selectedStory.estimatedDuration)}</span>
          </div>

          {/* Attached media */}
          {selectedStory.media.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium mb-2">Medias attaches ({selectedStory.media.length})</p>
              <ul className="space-y-1">
                {selectedStory.media.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Music className="h-3 w-3" />
                    <span className="truncate flex-1">{m.mediaItem.title}</span>
                    {m.mediaItem.duration && (
                      <span>{formatDuration(m.mediaItem.duration)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
