'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AudioEditor } from './AudioEditor';

interface AudioEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  onSave?: (audioBlob: Blob, format: 'wav') => void;
}

export function AudioEditorModal({
  open,
  onOpenChange,
  url,
  title,
  onSave,
}: AudioEditorModalProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSave = (audioBlob: Blob, format: 'wav') => {
    onSave?.(audioBlob, format);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Editeur audio - {title}</DialogTitle>
        </VisuallyHidden>
        <AudioEditor
          url={url}
          title={title}
          onSave={handleSave}
          onClose={handleClose}
          className="h-full"
        />
      </DialogContent>
    </Dialog>
  );
}
