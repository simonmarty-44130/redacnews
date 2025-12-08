'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
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
import { getMontageAudioEngine } from '@/lib/audio-montage';
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
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      const engine = getMontageAudioEngine();

      // Simuler la progression (l'export reel n'a pas de callback de progression)
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 200);

      const blob = await engine.exportMix(
        { ...project, duration },
        format
      );

      clearInterval(progressInterval);
      setProgress(100);

      // Telecharger le fichier
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
              <div className="text-muted-foreground">Duree</div>
              <div className="font-medium">{formatDuration(duration)}</div>
              <div className="text-muted-foreground">Pistes</div>
              <div className="font-medium">{project.tracks.length}</div>
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
                  MP3 (compresse, fichier leger)
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
