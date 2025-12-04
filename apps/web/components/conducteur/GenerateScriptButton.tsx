'use client';

import { useState } from 'react';
import {
  FileText,
  RefreshCw,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface GenerateScriptButtonProps {
  rundownId: string;
  rundownTitle: string;
  existingScriptUrl?: string | null;
  existingScriptGeneratedAt?: Date | null;
  className?: string;
}

export function GenerateScriptButton({
  rundownId,
  rundownTitle,
  existingScriptUrl,
  existingScriptGeneratedAt,
  className,
}: GenerateScriptButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    url?: string;
    error?: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const generateScript = trpc.rundown.generateScript.useMutation({
    onSuccess: (data) => {
      setResult({
        success: true,
        url: data.scriptDocUrl || undefined,
      });
      // Invalider les queries pour rafraichir l'UI
      utils.rundown.get.invalidate({ id: rundownId });
      utils.rundown.getScript.invalidate({ rundownId });
    },
    onError: (error) => {
      setResult({
        success: false,
        error: error.message,
      });
    },
  });

  const handleGenerate = (regenerate: boolean = false) => {
    setResult(null);
    generateScript.mutate({ rundownId, regenerate });
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
    setResult(null);
  };

  const handleClose = () => {
    setShowDialog(false);
    setResult(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <TooltipProvider>
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={existingScriptUrl ? 'outline' : 'default'}
              size="sm"
              onClick={handleOpenDialog}
              className={cn(
                existingScriptUrl && 'border-green-200 text-green-700 hover:bg-green-50',
                className
              )}
            >
              <FileText className="h-4 w-4 mr-2" />
              {existingScriptUrl ? 'Script' : 'Generer script'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {existingScriptUrl
              ? `Script genere le ${formatDate(existingScriptGeneratedAt!)}`
              : 'Generer le script de conduite'}
          </TooltipContent>
        </Tooltip>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Script de conduite
              </DialogTitle>
              <DialogDescription>{rundownTitle}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Etat existant */}
              {existingScriptUrl && !result && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      Script deja genere
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Derniere generation : {formatDate(existingScriptGeneratedAt!)}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-green-700"
                      asChild
                    >
                      <a href={existingScriptUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir le script
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Etat de chargement */}
              {generateScript.isPending && (
                <div className="flex items-center justify-center gap-3 p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">
                    Generation du script en cours...
                  </p>
                </div>
              )}

              {/* Resultat succes */}
              {result?.success && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      Script genere avec succes !
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-green-700"
                      asChild
                    >
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir le script
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Resultat erreur */}
              {result?.success === false && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Erreur lors de la generation
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">{result.error}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {!generateScript.isPending && !result && (
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Le script contiendra :</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>Tous les textes des sujets</li>
                    <li>Les encadres pour les elements sonores</li>
                    <li>Les timings de passage</li>
                    <li>Les apercus des transcriptions</li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              {!generateScript.isPending && (
                <>
                  <Button variant="outline" onClick={handleClose}>
                    Fermer
                  </Button>

                  {existingScriptUrl && !result && (
                    <Button variant="outline" onClick={() => handleGenerate(true)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerer
                    </Button>
                  )}

                  {(!existingScriptUrl || result?.success === false) && (
                    <Button onClick={() => handleGenerate(false)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generer le script
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
