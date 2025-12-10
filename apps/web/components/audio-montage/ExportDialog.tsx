'use client';

import { useState } from 'react';
import { Download, Loader2, FolderUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { getMultiTrackEngine } from '@/lib/audio-montage';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import type { MontageProject } from '@/lib/audio-montage/types';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: MontageProject;
  duration: number;
}

export function ExportDialog({
  open,
  onOpenChange,
  project,
  duration,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
  const [exportTarget, setExportTarget] = useState<'download' | 'mediatheque'>('download');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mutations pour l'upload vers la médiathèque
  const getUploadUrl = trpc.media.getUploadUrl.useMutation();
  const createMedia = trpc.media.create.useMutation();
  const utils = trpc.useUtils();

  // Fonction utilitaire pour obtenir la durée audio
  const getAudioDuration = async (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(Math.round(audio.duration));
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        resolve(Math.round(duration)); // Fallback sur la durée du projet
      };
      audio.src = URL.createObjectURL(blob);
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      const engine = getMultiTrackEngine();

      // Simuler la progression (l'export reel n'a pas de callback de progression)
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, exportTarget === 'mediatheque' ? 70 : 90));
      }, 200);

      const blob = await engine.exportMix({ ...project, duration });

      clearInterval(progressInterval);

      if (exportTarget === 'download') {
        // Télécharger le fichier localement
        setProgress(100);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Fichier téléchargé');
      } else {
        // Exporter vers la médiathèque
        setProgress(75);

        const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.${format}`;
        const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';

        // 1. Obtenir l'URL présignée
        const { uploadUrl, key, publicUrl } = await getUploadUrl.mutateAsync({
          filename: fileName,
          contentType: mimeType,
        });

        setProgress(80);

        // 2. Uploader vers S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Erreur lors de l\'upload vers S3');
        }

        setProgress(90);

        // 3. Obtenir la durée audio
        const audioDuration = await getAudioDuration(blob);

        // 4. Créer l'entrée MediaItem en base
        await createMedia.mutateAsync({
          title: project.name || 'Montage audio',
          description: `Exporté depuis l'éditeur multipiste le ${new Date().toLocaleDateString('fr-FR')}`,
          type: 'AUDIO',
          mimeType: mimeType,
          fileSize: blob.size,
          duration: audioDuration,
          s3Key: key,
          s3Url: publicUrl,
        });

        setProgress(100);

        // Invalider le cache de la médiathèque
        utils.media.list.invalidate();

        toast.success('Exporté vers la médiathèque !');
      }

      // Fermer apres un court delai
      setTimeout(() => {
        onOpenChange(false);
        setIsExporting(false);
        setProgress(0);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
      setIsExporting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exporter le mix</DialogTitle>
          <DialogDescription>
            Exportez votre projet en fichier audio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informations du projet */}
          <div className="rounded-lg bg-muted p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Projet</div>
              <div className="font-medium">{project.name}</div>
              <div className="text-muted-foreground">Durée</div>
              <div className="font-medium">{formatDuration(duration)}</div>
              <div className="text-muted-foreground">Pistes</div>
              <div className="font-medium">{project.tracks.length}</div>
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-3">
            <Label>Destination</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => !isExporting && setExportTarget('download')}
                disabled={isExporting}
                className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-colors ${
                  exportTarget === 'download'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                } ${isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Download className="h-8 w-8 mb-2 text-muted-foreground" />
                <span className="text-sm font-medium">Télécharger</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  Sur votre ordinateur
                </span>
              </button>
              <button
                type="button"
                onClick={() => !isExporting && setExportTarget('mediatheque')}
                disabled={isExporting}
                className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-colors ${
                  exportTarget === 'mediatheque'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                } ${isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <FolderUp className="h-8 w-8 mb-2 text-muted-foreground" />
                <span className="text-sm font-medium">Médiathèque</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  Enregistrer dans la bibliothèque
                </span>
              </button>
            </div>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as 'wav' | 'mp3')}
              disabled={isExporting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wav">
                  WAV (sans perte, fichier volumineux)
                </SelectItem>
                <SelectItem value="mp3">
                  MP3 (compressé, fichier léger)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Progression */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Export en cours...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Export...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
