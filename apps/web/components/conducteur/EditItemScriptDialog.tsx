'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

interface EditItemScriptDialogProps {
  itemId: string;
  itemTitle: string;
  currentScript: string | null;
  storyContent?: string | null;
  googleDocId?: string | null;
  googleDocUrl?: string | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function EditItemScriptDialog({
  itemId,
  itemTitle,
  currentScript,
  storyContent,
  googleDocId,
  googleDocUrl,
  onSuccess,
  trigger,
}: EditItemScriptDialogProps) {
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState(currentScript || '');
  const [showTextMode, setShowTextMode] = useState(false); // Force text mode even if doc exists

  const utils = trpc.useUtils();

  const updateItem = trpc.rundown.updateItem.useMutation({
    onSuccess: () => {
      toast.success('Script enregistre');
      utils.rundown.get.invalidate();
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error('Erreur lors de l\'enregistrement');
    },
  });

  const createItemDoc = trpc.rundown.createItemDoc.useMutation({
    onSuccess: (data) => {
      toast.success('Google Doc cree');
      utils.rundown.get.invalidate();
      onSuccess?.();
    },
    onError: () => {
      toast.error('Erreur lors de la creation du document');
    },
  });

  const syncItemDoc = trpc.rundown.syncItemDoc.useMutation({
    onSuccess: () => {
      toast.success('Script synchronise depuis Google Doc');
      utils.rundown.get.invalidate();
      onSuccess?.();
    },
    onError: () => {
      toast.error('Erreur lors de la synchronisation');
    },
  });

  // Reset script when dialog opens
  useEffect(() => {
    if (open) {
      setScript(currentScript || '');
      setShowTextMode(false);
    }
  }, [open, currentScript]);

  const handleSave = () => {
    updateItem.mutate({
      id: itemId,
      script: script.trim() || null,
    });
  };

  const handleUseStoryContent = () => {
    if (storyContent) {
      setScript(storyContent);
    }
  };

  const handleClear = () => {
    setScript('');
  };

  const handleCreateDoc = () => {
    createItemDoc.mutate({
      itemId,
      initialContent: currentScript || storyContent || '',
    });
  };

  const handleSyncDoc = () => {
    syncItemDoc.mutate({ itemId });
  };

  // Determine if we should show Google Docs mode
  const hasGoogleDoc = googleDocId && googleDocUrl;
  const showGoogleDocMode = hasGoogleDoc && !showTextMode;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            Script
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={showGoogleDocMode ? "sm:max-w-4xl h-[85vh] flex flex-col" : "sm:max-w-[600px] max-h-[80vh] flex flex-col"}>
        <DialogHeader>
          <DialogTitle>Script - {itemTitle}</DialogTitle>
          <DialogDescription>
            {showGoogleDocMode ? (
              <span>
                Edition collaborative via Google Docs.{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setShowTextMode(true)}
                >
                  Passer en mode texte simple
                </button>
              </span>
            ) : (
              <>
                Texte a lire a l'antenne pour cet element du conducteur.
                {storyContent && (
                  <span className="block mt-1 text-blue-600">
                    Un sujet est lie - vous pouvez utiliser son contenu comme base.
                  </span>
                )}
                {hasGoogleDoc && (
                  <span className="block mt-1">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => setShowTextMode(false)}
                    >
                      Retour au Google Doc
                    </button>
                  </span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {showGoogleDocMode ? (
          // Mode Google Docs - iframe d'edition
          <div className="flex-1 min-h-0 py-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <a
                  href={googleDocUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Ouvrir dans un nouvel onglet
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncDoc}
                disabled={syncItemDoc.isPending}
              >
                {syncItemDoc.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Synchroniser vers prompteur
              </Button>
            </div>
            <iframe
              src={`${googleDocUrl}?embedded=true`}
              className="flex-1 w-full border rounded-lg"
              title={`Script - ${itemTitle}`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Les modifications sont sauvegardees automatiquement dans Google Docs.
              Cliquez sur "Synchroniser" pour mettre a jour le prompteur.
            </p>
          </div>
        ) : (
          // Mode texte simple
          <div className="flex-1 min-h-0 py-4">
            <div className="space-y-2 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <Label htmlFor="script">Texte du script</Label>
                <div className="flex gap-2">
                  {!hasGoogleDoc && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateDoc}
                      disabled={createItemDoc.isPending}
                    >
                      {createItemDoc.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Creer Google Doc
                    </Button>
                  )}
                  {storyContent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUseStoryContent}
                    >
                      Utiliser le sujet
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={!script}
                  >
                    Effacer
                  </Button>
                </div>
              </div>
              <Textarea
                id="script"
                placeholder="Entrez le texte que le presentateur doit lire a l'antenne..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="flex-1 min-h-[300px] font-mono text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {script.length} caracteres
                {script && ` - ~${Math.ceil(script.split(/\s+/).length / 150)} min de lecture`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {showGoogleDocMode ? 'Fermer' : 'Annuler'}
          </Button>
          {!showGoogleDocMode && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={updateItem.isPending}
            >
              {updateItem.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enregistrer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
