'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Clock, Tag, User, FileText, Trash2, RefreshCw, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GoogleDocEmbed } from './GoogleDocEmbed';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  'Actualite',
  'Politique',
  'Economie',
  'Societe',
  'Culture',
  'Sport',
  'Meteo',
  'International',
  'Local',
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'IN_REVIEW', label: 'En revision' },
  { value: 'APPROVED', label: 'Valide' },
  { value: 'PUBLISHED', label: 'Publie' },
  { value: 'ARCHIVED', label: 'Archive' },
];

interface StoryEditorProps {
  storyId: string;
  onClose?: () => void;
  onDelete?: () => void;
}

export function StoryEditor({ storyId, onClose, onDelete }: StoryEditorProps) {
  const { data: story, isLoading } = trpc.story.get.useQuery({ id: storyId });
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [category, setCategory] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const updateStory = trpc.story.update.useMutation({
    onSuccess: () => {
      utils.story.list.invalidate();
      utils.story.get.invalidate({ id: storyId });
      setHasChanges(false);
    },
  });

  const deleteStory = trpc.story.delete.useMutation({
    onSuccess: () => {
      utils.story.list.invalidate();
      onDelete?.();
    },
  });

  const syncGoogleDoc = trpc.story.syncGoogleDoc.useMutation({
    onSuccess: () => {
      utils.story.get.invalidate({ id: storyId });
    },
  });

  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setContent(story.content || '');
      setStatus(story.status);
      setCategory(story.category || '');
      setEstimatedDuration(story.estimatedDuration);
      setHasChanges(false);
    }
  }, [story]);

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSave = () => {
    updateStory.mutate({
      id: storyId,
      title,
      content,
      status: status as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED',
      category: category || undefined,
      estimatedDuration: estimatedDuration || undefined,
    });
  };

  const handleDelete = () => {
    if (confirm('Etes-vous sur de vouloir supprimer ce sujet ?')) {
      deleteStory.mutate({ id: storyId });
    }
  };

  // Estimation de la duree basee sur le contenu (150 mots/min en lecture radio)
  const estimateDuration = (text: string): number => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.round((words / 150) * 60);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    const estimated = estimateDuration(value);
    if (estimated !== estimatedDuration) {
      setEstimatedDuration(estimated);
    }
    handleChange();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <Skeleton className="h-8 w-3/4" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Sujet non trouve
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" />
          <span className="font-medium">Edition du sujet</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteStory.isPending}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateStory.isPending}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateStory.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-6">
          {/* Metadata section */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
              Metadonnees
            </h3>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    handleChange();
                  }}
                  placeholder="Titre du sujet"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value);
                      handleChange();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Categorie</Label>
                  <Select
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value);
                      handleChange();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    Duree estimee:{' '}
                    {estimatedDuration
                      ? formatDuration(estimatedDuration)
                      : '--:--'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>
                    {story.author.firstName} {story.author.lastName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Content editor - Google Docs or Local */}
          {story.googleDocId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Contenu</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncGoogleDoc.mutate({ id: storyId })}
                    disabled={syncGoogleDoc.isPending}
                  >
                    <RefreshCw
                      className={cn(
                        'h-4 w-4 mr-2',
                        syncGoogleDoc.isPending && 'animate-spin'
                      )}
                    />
                    {syncGoogleDoc.isPending ? 'Synchronisation...' : 'Synchroniser'}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor">Editeur Google Docs</TabsTrigger>
                  <TabsTrigger value="backup">Texte local (backup)</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="mt-2">
                  <GoogleDocEmbed
                    docId={story.googleDocId}
                    docUrl={story.googleDocUrl || undefined}
                    className="min-h-[500px]"
                    onContentChange={() => {
                      // Auto-sync after a delay
                      setTimeout(() => {
                        syncGoogleDoc.mutate({ id: storyId });
                      }, 5000);
                    }}
                  />
                </TabsContent>

                <TabsContent value="backup" className="mt-2">
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Ce texte est une copie de sauvegarde du Google Doc.
Pour editer le contenu principal, utilisez l'onglet Google Docs."
                    className="min-h-[400px] font-mono text-base leading-relaxed"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {content.trim().split(/\s+/).filter(Boolean).length} mots
                    {estimatedDuration
                      ? ` - environ ${formatDuration(estimatedDuration)} de lecture`
                      : ''}
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Contenu</Label>
                <Badge variant="outline" className="text-xs">
                  <Link2 className="h-3 w-3 mr-1" />
                  Pas de Google Doc lie
                </Badge>
              </div>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Redigez votre sujet ici...

Utilisez des paragraphes courts pour faciliter la lecture a l'antenne.
Chaque phrase devrait etre comprehensible independamment."
                className="min-h-[400px] font-mono text-base leading-relaxed"
              />
              <p className="text-xs text-gray-500">
                {content.trim().split(/\s+/).filter(Boolean).length} mots
                {estimatedDuration
                  ? ` - environ ${formatDuration(estimatedDuration)} de lecture`
                  : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
