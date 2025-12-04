'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface GoogleDocEmbedProps {
  docId: string;
  docUrl?: string;
  className?: string;
}

export function GoogleDocEmbed({
  docId,
  docUrl,
  className,
}: GoogleDocEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0); // For forcing iframe refresh

  // URL d'édition (sans embedded=true qui bloque parfois la saisie)
  const embedUrl = `https://docs.google.com/document/d/${docId}/edit?rm=minimal`;

  // External edit URL
  const editUrl = docUrl || `https://docs.google.com/document/d/${docId}/edit`;

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setKey((k) => k + 1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((f) => !f);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col bg-white rounded-lg border overflow-hidden h-full',
        isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Document Google</span>
          {isLoading && (
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            title="Rafraichir"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Reduire' : 'Agrandir'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="sm" asChild title="Ouvrir dans Google Docs">
            <a href={editUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Document iframe */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center space-y-3">
              <Skeleton className="h-4 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
              <Skeleton className="h-4 w-40 mx-auto" />
              <p className="text-sm text-gray-500 mt-4">
                Chargement du document...
              </p>
            </div>
          </div>
        )}
        <iframe
          key={key}
          src={embedUrl}
          className="w-full h-full border-0"
          onLoad={handleLoad}
          allow="clipboard-write; clipboard-read"
          title="Google Doc Editor"
        />
      </div>

      {/* Fullscreen overlay backdrop */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={toggleFullscreen}
        />
      )}
    </div>
  );
}
