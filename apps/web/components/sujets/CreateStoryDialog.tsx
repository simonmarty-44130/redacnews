'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { STORY_CATEGORIES } from '@/lib/stories/config';

interface CreateStoryDialogProps {
  onSuccess?: (storyId: string) => void;
}

export function CreateStoryDialog({ onSuccess }: CreateStoryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('');
  const [withGoogleDoc, setWithGoogleDoc] = useState(true);

  const utils = trpc.useUtils();

  const createStory = trpc.story.create.useMutation({
    onSuccess: (data) => {
      utils.story.list.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.(data.id);
      // Rediriger vers la page d'edition plein ecran
      router.push(`/sujets/${data.id}`);
    },
  });

  const createWithGoogleDoc = trpc.story.createWithGoogleDoc.useMutation({
    onSuccess: (data) => {
      utils.story.list.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.(data.id);
      // Rediriger vers la page d'edition plein ecran
      router.push(`/sujets/${data.id}`);
    },
  });

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setWithGoogleDoc(true);
  };

  const isPending = createStory.isPending || createWithGoogleDoc.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      category: category || undefined,
    };

    if (withGoogleDoc) {
      createWithGoogleDoc.mutate(payload);
    } else {
      createStory.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau sujet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Creer un nouveau sujet</DialogTitle>
            <DialogDescription>
              Donnez un titre a votre sujet pour commencer la redaction.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titre du sujet</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Greve SNCF - Perturbations attendues"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Categorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner une categorie" />
                </SelectTrigger>
                <SelectContent>
                  {STORY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Google Docs option */}
            <div className="grid gap-2">
              <Label>Mode d'edition</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={withGoogleDoc ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWithGoogleDoc(true)}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Google Docs
                  {withGoogleDoc && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Recommande
                    </Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant={!withGoogleDoc ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWithGoogleDoc(false)}
                  className="flex-1"
                >
                  Texte local
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {withGoogleDoc
                  ? 'Un document Google sera cree pour la collaboration en temps reel.'
                  : 'Le texte sera stocke localement (pas de collaboration Google Docs).'}
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
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending
                ? withGoogleDoc
                  ? 'Creation du document...'
                  : 'Creation...'
                : 'Creer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
