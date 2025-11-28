'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  X,
  Save,
  Trash2,
  Download,
  Clock,
  User,
  Calendar,
  Tag,
  Music,
  Image,
  Video,
  File,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc/client';

interface MediaDetailsProps {
  mediaId: string;
  onClose: () => void;
  onDelete?: () => void;
}

const typeIcons = {
  AUDIO: Music,
  VIDEO: Video,
  IMAGE: Image,
  DOCUMENT: File,
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

export function MediaDetails({ mediaId, onClose, onDelete }: MediaDetailsProps) {
  const { data: media, isLoading } = trpc.media.get.useQuery({ id: mediaId });
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const updateMedia = trpc.media.update.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      utils.media.get.invalidate({ id: mediaId });
      setHasChanges(false);
    },
  });

  const deleteMedia = trpc.media.delete.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      onDelete?.();
    },
  });

  useEffect(() => {
    if (media) {
      setTitle(media.title);
      setDescription(media.description || '');
      setTagsInput(media.tags?.join(', ') || '');
      setHasChanges(false);
    }
  }, [media]);

  const handleSave = () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    updateMedia.mutate({
      id: mediaId,
      title,
      description: description || undefined,
      tags,
    });
  };

  const handleDelete = () => {
    if (confirm('Etes-vous sur de vouloir supprimer ce fichier ?')) {
      deleteMedia.mutate({ id: mediaId });
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 border-l bg-white flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="w-80 border-l bg-white flex items-center justify-center">
        <p className="text-gray-500">Media non trouve</p>
      </div>
    );
  }

  const Icon = typeIcons[media.type];
  const uploaderName =
    media.uploadedBy.firstName && media.uploadedBy.lastName
      ? `${media.uploadedBy.firstName} ${media.uploadedBy.lastName}`
      : media.uploadedBy.email.split('@')[0];

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium">Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Preview */}
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
            {media.type === 'IMAGE' ? (
              <img
                src={media.s3Url}
                alt={media.title}
                className="w-full h-full object-contain"
              />
            ) : media.thumbnailUrl ? (
              <img
                src={media.thumbnailUrl}
                alt={media.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-4 rounded-full bg-gray-200">
                <Icon className="h-10 w-10 text-gray-500" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <User className="h-4 w-4" />
              <span>{uploaderName}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDistanceToNow(new Date(media.createdAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
            {media.duration && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(media.duration)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <File className="h-4 w-4" />
              <span>
                {formatFileSize(media.fileSize)} - {media.mimeType}
              </span>
            </div>
          </div>

          <Separator />

          {/* Edit form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setHasChanges(true);
                }}
                rows={3}
                placeholder="Ajouter une description..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separes par des virgules)</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => {
                  setTagsInput(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="interview, politique, local"
              />
            </div>

            {media.tags && media.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {media.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Transcription */}
          {media.transcription && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Transcription</Label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-40 overflow-auto">
                  {media.transcription}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMedia.isPending}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMedia.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
          <Button variant="outline" asChild>
            <a href={media.s3Url} download target="_blank" rel="noopener">
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={deleteMedia.isPending}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Supprimer
        </Button>
      </div>
    </div>
  );
}
