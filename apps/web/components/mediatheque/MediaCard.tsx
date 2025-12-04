'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Music, Image, Video, File, Clock, Play, Scissors, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: string;
  title: string;
  type: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  mimeType: string;
  fileSize: number;
  duration?: number | null;
  s3Url: string;
  thumbnailUrl?: string | null;
  createdAt: Date;
  uploadedBy: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
}

interface MediaCardProps {
  media: MediaItem;
  isSelected?: boolean;
  onClick?: () => void;
  onPlay?: () => void;
  viewMode?: 'grid' | 'list';
  isSelectable?: boolean;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
}

const typeIcons = {
  AUDIO: Music,
  VIDEO: Video,
  IMAGE: Image,
  DOCUMENT: File,
};

const typeColors = {
  AUDIO: 'bg-purple-100 text-purple-600',
  VIDEO: 'bg-blue-100 text-blue-600',
  IMAGE: 'bg-green-100 text-green-600',
  DOCUMENT: 'bg-orange-100 text-orange-600',
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaCard({
  media,
  isSelected,
  onClick,
  onPlay,
  viewMode = 'grid',
  isSelectable = false,
  isChecked = false,
  onCheckChange,
}: MediaCardProps) {
  const router = useRouter();
  const Icon = typeIcons[media.type];
  const uploaderName =
    media.uploadedBy.firstName && media.uploadedBy.lastName
      ? `${media.uploadedBy.firstName} ${media.uploadedBy.lastName}`
      : media.uploadedBy.email.split('@')[0];

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/audio-editor?media=${media.id}`);
  };

  const handleCheckChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckChange?.(!isChecked);
  };

  if (viewMode === 'list') {
    return (
      <Card
        className={cn(
          'p-3 cursor-pointer transition-all hover:shadow-md flex items-center gap-4',
          isSelected && 'ring-2 ring-blue-500 bg-blue-50/50',
          isChecked && 'bg-blue-50 border-blue-200'
        )}
        onClick={onClick}
      >
        {/* Checkbox for selection mode */}
        {isSelectable && (
          <div onClick={handleCheckChange}>
            <Checkbox checked={isChecked} className="pointer-events-none" />
          </div>
        )}
        <div className={cn('p-2 rounded-lg', typeColors[media.type])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{media.title}</h3>
          <p className="text-sm text-gray-500">{uploaderName}</p>
        </div>
        {media.duration && (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            {formatDuration(media.duration)}
          </div>
        )}
        <span className="text-sm text-gray-400">
          {formatFileSize(media.fileSize)}
        </span>
        {/* Edit button for audio files */}
        {media.type === 'AUDIO' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            title="Editer dans l'editeur audio"
            className="h-8 w-8"
          >
            <Scissors className="h-4 w-4" />
          </Button>
        )}
        {(media.type === 'AUDIO' || media.type === 'VIDEO') && onPlay && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'overflow-hidden cursor-pointer transition-all hover:shadow-md group',
        isSelected && 'ring-2 ring-blue-500',
        isChecked && 'ring-2 ring-blue-500 bg-blue-50'
      )}
      onClick={onClick}
    >
      {/* Thumbnail / Icon */}
      <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn('p-4 rounded-full', typeColors[media.type])}>
            <Icon className="h-8 w-8" />
          </div>
        )}

        {/* Checkbox for selection mode */}
        {isSelectable && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={handleCheckChange}
          >
            <div className={cn(
              'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
              isChecked
                ? 'bg-blue-500 border-blue-500'
                : 'bg-white/90 border-gray-300 hover:border-blue-400'
            )}>
              {isChecked && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>
        )}

        {/* Edit button for audio (top right) */}
        {media.type === 'AUDIO' && (
          <button
            onClick={handleEdit}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-white/90 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-blue-600"
            title="Editer dans l'editeur audio"
          >
            <Scissors className="h-4 w-4" />
          </button>
        )}

        {/* Play button overlay */}
        {(media.type === 'AUDIO' || media.type === 'VIDEO') && onPlay && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="p-3 rounded-full bg-white/90">
              <Play className="h-6 w-6 text-gray-900" />
            </div>
          </button>
        )}

        {/* Duration badge */}
        {media.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
            {formatDuration(media.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 truncate text-sm">
          {media.title}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">{uploaderName}</span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(media.createdAt), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
        </div>
      </div>
    </Card>
  );
}
