'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateStoryButtonProps {
  storyData: {
    title: string;
    content?: string;
    category?: string;
    tags?: string[];
    estimatedDuration?: number;
  };
}

export function CreateStoryButton({ storyData }: CreateStoryButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [storyUrl, setStoryUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStory = async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/assistant/create-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storyData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du sujet');
      }

      setStatus('success');
      setStoryUrl(data.story.url);
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
    }
  };

  if (status === 'success' && storyUrl) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
        <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
        <div className="flex-1">
          <p className="font-medium text-green-900">Sujet créé avec succès</p>
          <a
            href={storyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 underline hover:text-green-800"
          >
            Ouvrir le sujet
          </a>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
        <div className="flex-1">
          <p className="font-medium text-red-900">Erreur lors de la création</p>
          <p className="text-red-700">{error}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreateStory}
          className="text-red-700 hover:text-red-800"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <FileText className="h-5 w-5 flex-shrink-0 text-blue-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          Créer ce sujet dans RédacNews ?
        </p>
        <p className="text-xs text-blue-700">
          Le sujet sera créé en brouillon et vous pourrez le modifier ensuite.
        </p>
      </div>
      <Button
        onClick={handleCreateStory}
        disabled={status === 'loading'}
        className={cn(
          'bg-blue-600 hover:bg-blue-700 text-white',
          status === 'loading' && 'opacity-70 cursor-not-allowed'
        )}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Création...
          </>
        ) : (
          'Créer le sujet'
        )}
      </Button>
    </div>
  );
}
