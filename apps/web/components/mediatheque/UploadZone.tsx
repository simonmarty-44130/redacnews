'use client';

import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  duration?: number; // Duree extraite pour les fichiers audio/video
}

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

function getMediaType(mimeType: string): 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' {
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  return 'DOCUMENT';
}

/**
 * Extrait la duree d'un fichier audio ou video
 * Retourne la duree en secondes (arrondie) ou null si non disponible
 */
async function extractDuration(file: File): Promise<number | null> {
  const mimeType = file.type.toLowerCase();

  // Verifier si c'est un fichier audio ou video
  if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
    return null;
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = mimeType.startsWith('audio/')
      ? new Audio()
      : document.createElement('video');

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    media.onloadedmetadata = () => {
      const duration = media.duration;
      cleanup();
      // Verifier que la duree est valide (pas Infinity ou NaN)
      if (duration && isFinite(duration) && duration > 0) {
        resolve(Math.round(duration));
      } else {
        resolve(null);
      }
    };

    media.onerror = () => {
      cleanup();
      resolve(null);
    };

    // Timeout de securite (5 secondes)
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    media.src = url;
  });
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);

  const utils = trpc.useUtils();
  const getUploadUrl = trpc.media.getUploadUrl.useMutation();
  const createMedia = trpc.media.create.useMutation();

  const uploadFile = useCallback(
    async (uploadFile: UploadFile) => {
      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
          )
        );

        // Get presigned URL
        const { uploadUrl, key, publicUrl } = await getUploadUrl.mutateAsync({
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type,
        });

        // Upload to S3
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) =>
              prev.map((f) => (f.id === uploadFile.id ? { ...f, progress } : f))
            );
          }
        };

        await new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error('Upload failed'));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', uploadFile.file.type);
          xhr.send(uploadFile.file);
        });

        // Create media item in database
        await createMedia.mutateAsync({
          title: uploadFile.file.name.replace(/\.[^/.]+$/, ''),
          type: getMediaType(uploadFile.file.type),
          mimeType: uploadFile.file.type,
          fileSize: uploadFile.file.size,
          s3Key: key,
          s3Url: publicUrl,
          duration: uploadFile.duration, // Inclure la duree extraite
        });

        // Update status to done
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'done', progress: 100 } : f
          )
        );
        toast.success(`${uploadFile.file.name} uploade`);
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'error', error: 'Erreur lors de l\'upload' }
              : f
          )
        );
        toast.error(`Erreur pour ${uploadFile.file.name}`);
      }
    },
    [getUploadUrl, createMedia]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const filesArray = Array.from(fileList);

      // Creer les objets UploadFile avec extraction de duree pour audio/video
      const newFiles: UploadFile[] = await Promise.all(
        filesArray.map(async (file) => {
          const duration = await extractDuration(file);
          return {
            file,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            progress: 0,
            status: 'pending' as const,
            duration: duration ?? undefined,
          };
        })
      );

      setFiles((prev) => [...prev, ...newFiles]);

      // Start uploading each file
      newFiles.forEach((f) => uploadFile(f));
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleClose = () => {
    const hasUploading = files.some((f) => f.status === 'uploading');
    if (hasUploading) {
      if (!confirm('Des uploads sont en cours. Voulez-vous vraiment fermer ?')) {
        return;
      }
    }
    setOpen(false);
    setFiles([]);
    utils.media.list.invalidate();
    onUploadComplete?.();
  };

  const allDone = files.length > 0 && files.every((f) => f.status === 'done');

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Upload
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Uploader des fichiers</DialogTitle>
          </DialogHeader>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <Upload className="h-10 w-10 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              Glissez-deposez vos fichiers ici
            </p>
            <p className="text-sm text-gray-500 mb-4">ou</p>
            <label>
              <input
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
                accept="audio/*,video/*,image/*,.pdf,.doc,.docx"
              />
              <Button variant="outline" asChild>
                <span>Parcourir les fichiers</span>
              </Button>
            </label>
          </div>

          {/* Files list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-3 max-h-60 overflow-auto">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {f.status === 'uploading' && (
                        <Progress value={f.progress} className="flex-1 h-1.5" />
                      )}
                      {f.status === 'done' && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Termine
                        </span>
                      )}
                      {f.status === 'error' && (
                        <span className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {f.error}
                        </span>
                      )}
                      {f.status === 'pending' && (
                        <span className="text-xs text-gray-500">En attente...</span>
                      )}
                    </div>
                  </div>
                  {f.status === 'uploading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  )}
                  {f.status === 'done' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {f.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClose}>
              {allDone ? 'Fermer' : 'Annuler'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
