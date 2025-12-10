'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
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
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function EditItemScriptDialog({
  itemId,
  itemTitle,
  currentScript,
  storyContent,
  onSuccess,
  trigger,
}: EditItemScriptDialogProps) {
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState(currentScript || '');

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

  // Reset script when dialog opens
  useEffect(() => {
    if (open) {
      setScript(currentScript || '');
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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Script - {itemTitle}</DialogTitle>
          <DialogDescription>
            Texte a lire a l'antenne pour cet element du conducteur.
            {storyContent && (
              <span className="block mt-1 text-blue-600">
                Un sujet est lie - vous pouvez utiliser son contenu comme base.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">
          <div className="space-y-2 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <Label htmlFor="script">Texte du script</Label>
              <div className="flex gap-2">
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Annuler
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
