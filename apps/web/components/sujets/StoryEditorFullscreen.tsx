'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GoogleDocEmbed } from './GoogleDocEmbed';
import { ReadingTimer } from './ReadingTimer';
import { StoryBottomBar } from './StoryBottomBar';
import { trpc } from '@/lib/trpc/client';

interface StoryEditorFullscreenProps {
  storyId: string;
  onBack: () => void;
}

export function StoryEditorFullscreen({ storyId, onBack }: StoryEditorFullscreenProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: story, isLoading } = trpc.story.get.useQuery(
    { id: storyId },
    { enabled: !isDeleting } // Désactiver la query pendant/après suppression
  );
  const utils = trpc.useUtils();

  // Local state
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [category, setCategory] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Mutations
  const updateStory = trpc.story.update.useMutation({
    onSuccess: () => {
      utils.story.get.invalidate({ id: storyId });
      utils.story.list.invalidate();
      setHasChanges(false);
    },
  });

  const deleteStory = trpc.story.delete.useMutation({
    onSuccess: () => {
      utils.story.list.invalidate();
      router.push('/sujets');
    },
    onError: () => {
      setIsDeleting(false);
    },
  });

  const addGoogleDoc = trpc.story.addGoogleDoc.useMutation({
    onSuccess: () => {
      utils.story.get.invalidate({ id: storyId });
    },
  });

  // Initialize from story data
  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setStatus(story.status);
      setCategory(story.category || '');
    }
  }, [story]);

  const handleSave = useCallback(() => {
    updateStory.mutate({
      id: storyId,
      title,
      status: status as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED',
      category: category || undefined,
    });
  }, [storyId, title, status, category, updateStory]);

  const handleDelete = () => {
    if (confirm('Etes-vous sur de vouloir supprimer ce sujet ?')) {
      setIsDeleting(true); // Désactiver la query AVANT la mutation
      deleteStory.mutate({ id: storyId });
    }
  };

  const handleAddGoogleDoc = () => {
    addGoogleDoc.mutate({ storyId });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasChanges(true);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    updateStory.mutate({
      id: storyId,
      status: newStatus as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED',
    });
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    updateStory.mutate({
      id: storyId,
      category: newCategory,
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
      if (e.key === 'Escape' && isEditingTitle) {
        setTitle(story?.title || '');
        setIsEditingTitle(false);
        setHasChanges(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, handleSave, isEditingTitle, story?.title]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="h-14 bg-white border-b flex items-center px-4">
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Sujet non trouve</p>
          <Button variant="link" onClick={onBack}>
            Retour a la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* TOP BAR - Minimaliste */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Sujets
          </Button>

          <div className="h-6 w-px bg-gray-200" />

          {isEditingTitle ? (
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                if (hasChanges) handleSave();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                  if (hasChanges) handleSave();
                }
                if (e.key === 'Escape') {
                  setTitle(story.title);
                  setIsEditingTitle(false);
                  setHasChanges(false);
                }
              }}
              className="h-8 text-lg font-medium max-w-md"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-lg font-medium truncate cursor-pointer hover:text-blue-600 transition-colors"
              title="Cliquer pour modifier le titre"
            >
              {title}
            </h1>
          )}
        </div>

        {/* Center: Reading Timer */}
        <div className="flex items-center">
          <ReadingTimer storyId={storyId} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="min-w-[100px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateStory.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </header>

      {/* TOOLBAR - Au-dessus du Google Doc */}
      <StoryBottomBar
        storyId={storyId}
        status={status}
        category={category}
        mediaCount={story.media?.length || 0}
        estimatedDuration={story.estimatedDuration}
        onStatusChange={handleStatusChange}
        onCategoryChange={handleCategoryChange}
      />

      {/* MAIN CONTENT - Google Docs Full Screen */}
      <main className="flex-1 p-4 pt-0 min-h-0">
        {story.googleDocId ? (
          <GoogleDocEmbed
            docId={story.googleDocId}
            docUrl={story.googleDocUrl || undefined}
            className="h-full rounded-lg shadow-sm"
          />
        ) : (
          <div className="h-full bg-white rounded-lg border flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-gray-500">Aucun Google Doc lie a ce sujet</p>
              <Button
                variant="outline"
                onClick={handleAddGoogleDoc}
                disabled={addGoogleDoc.isPending}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {addGoogleDoc.isPending ? 'Creation en cours...' : 'Creer un Google Doc'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
