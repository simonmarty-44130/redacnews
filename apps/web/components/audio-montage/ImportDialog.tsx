'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileAudio, X, Loader2, FolderOpen, HardDrive, Music, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Track } from '@/lib/audio-montage/types';

interface MediaItem {
  id: string;
  title: string;
  duration: number | null;
  s3Url: string;
  type: string;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracks: Track[];
  mediaItems: MediaItem[];
  onImportFile: (file: File, duration: number, trackId: string) => void;
  onImportFromLibrary: (mediaItem: MediaItem, trackId: string) => void;
}

type ImportSource = 'library' | 'local';

export function ImportDialog({
  open,
  onOpenChange,
  tracks,
  mediaItems,
  onImportFile,
  onImportFromLibrary,
}: ImportDialogProps) {
  // Source d'import
  const [source, setSource] = useState<ImportSource>('library');

  // Selection de piste
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');

  // Pour l'import local
  const [file, setFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pour l'import depuis la mediatheque
  const [search, setSearch] = useState('');
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);

  // Erreur
  const [error, setError] = useState<string | null>(null);

  // Filtrer les items audio de la mediatheque
  const filteredMediaItems = mediaItems.filter(
    (item) =>
      item.type === 'AUDIO' &&
      item.title.toLowerCase().includes(search.toLowerCase())
  );

  // Selectionner la premiere piste par defaut
  useEffect(() => {
    if (open && tracks.length > 0 && !selectedTrackId) {
      setSelectedTrackId(tracks[0].id);
    }
  }, [open, tracks, selectedTrackId]);

  const resetState = useCallback(() => {
    setFile(null);
    setFileDuration(null);
    setError(null);
    setIsLoadingFile(false);
    setIsDragging(false);
    setSelectedMediaItem(null);
    setSearch('');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  // Obtenir la duree d'un fichier audio
  const getAudioDuration = async (audioFile: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(audioFile);

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (audio.duration && isFinite(audio.duration)) {
          resolve(audio.duration);
        } else {
          reject(new Error('Impossible de lire la duree du fichier'));
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Fichier audio invalide ou non supporte'));
      };

      audio.src = url;
    });
  };

  const processFile = async (selectedFile: File) => {
    // Verifier le type de fichier
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a'];
    const isValidType = validTypes.some(type => selectedFile.type.includes(type.split('/')[1])) ||
                        selectedFile.name.match(/\.(mp3|wav|ogg|webm|aac|m4a)$/i);

    if (!isValidType) {
      setError('Format non supporte. Utilisez MP3, WAV, OGG, WebM, AAC ou M4A.');
      return;
    }

    // Verifier la taille (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('Fichier trop volumineux (max 100 MB)');
      return;
    }

    setIsLoadingFile(true);
    setError(null);
    setFile(selectedFile);

    try {
      const audioDuration = await getAudioDuration(selectedFile);
      setFileDuration(audioDuration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier');
      setFile(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleImport = () => {
    if (!selectedTrackId) {
      setError('Veuillez selectionner une piste');
      return;
    }

    if (source === 'local' && file && fileDuration !== null) {
      onImportFile(file, fileDuration, selectedTrackId);
      handleClose();
    } else if (source === 'library' && selectedMediaItem) {
      onImportFromLibrary(selectedMediaItem, selectedTrackId);
      handleClose();
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canImport = selectedTrackId && (
    (source === 'local' && file && fileDuration !== null) ||
    (source === 'library' && selectedMediaItem)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer un son</DialogTitle>
          <DialogDescription>
            Choisissez un son depuis la mediatheque ou importez un fichier depuis votre ordinateur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Choix de la source */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setSource('library');
                setFile(null);
                setFileDuration(null);
                setError(null);
              }}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-colors',
                source === 'library'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/50'
              )}
            >
              <FolderOpen className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Mediatheque</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                Sons de RedacNews
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSource('local');
                setSelectedMediaItem(null);
                setError(null);
              }}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-colors',
                source === 'local'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/50'
              )}
            >
              <HardDrive className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Ordinateur</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                Fichier local
              </span>
            </button>
          </div>

          {/* Contenu selon la source */}
          {source === 'library' ? (
            <div className="space-y-3">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un son..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Liste des sons */}
              <ScrollArea className="h-48 border rounded-md">
                {filteredMediaItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Music className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Aucun son trouve</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredMediaItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedMediaItem(item)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                          selectedMediaItem?.id === item.id
                            ? 'bg-primary/10 border border-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Music className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDuration(item.duration)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                isDragging && 'border-primary bg-primary/5',
                !isDragging && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
                file && 'border-primary bg-primary/5'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.webm,.aac,.m4a"
                onChange={handleFileSelect}
                className="hidden"
              />

              {isLoadingFile ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
              ) : file && fileDuration !== null ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <FileAudio className="h-8 w-8 text-primary" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setFileDuration(null);
                      }}
                      className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1 hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium truncate max-w-[280px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(fileDuration)} - {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Glissez un fichier audio ici
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ou cliquez pour parcourir
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3, WAV, OGG, WebM, AAC, M4A (max 100 MB)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Selection de la piste */}
          <div className="space-y-2">
            <Label>Piste de destination</Label>
            <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une piste" />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: track.color }}
                      />
                      {track.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Erreur */}
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
