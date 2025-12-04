'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  FolderOpen,
  Link2,
  ArrowLeft,
  Clock,
  HardDrive,
} from 'lucide-react';

interface ExportSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
  duration: number;
  fileSize: number;
  sourceContext: {
    type: 'media' | 'story' | 'new';
    storyId?: string;
  };
  onAttachToStory?: () => void;
  onGoToMedia: () => void;
  onContinueEditing: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportSuccessDialog({
  open,
  onClose,
  mediaId,
  mediaTitle,
  duration,
  fileSize,
  sourceContext,
  onAttachToStory,
  onGoToMedia,
  onContinueEditing,
}: ExportSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle>Export reussi !</DialogTitle>
          </div>
          <DialogDescription>
            Votre montage audio a ete sauvegarde dans la mediatheque.
          </DialogDescription>
        </DialogHeader>

        {/* Media info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900 truncate">{mediaTitle}</h4>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(duration)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-4 w-4" />
              {formatFileSize(fileSize)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={onGoToMedia}
          >
            <FolderOpen className="h-4 w-4 mr-3" />
            Voir dans la mediatheque
          </Button>

          {sourceContext.type === 'story' && sourceContext.storyId && onAttachToStory && (
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={onAttachToStory}
            >
              <Link2 className="h-4 w-4 mr-3" />
              Attacher au sujet
            </Button>
          )}

          <Button
            className="w-full justify-start"
            variant="ghost"
            onClick={onContinueEditing}
          >
            <ArrowLeft className="h-4 w-4 mr-3" />
            Continuer le montage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
