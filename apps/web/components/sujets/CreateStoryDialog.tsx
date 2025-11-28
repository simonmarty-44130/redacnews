'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { trpc } from '@/lib/trpc/client';

const CATEGORIES = [
  'Actualite',
  'Politique',
  'Economie',
  'Societe',
  'Culture',
  'Sport',
  'Meteo',
  'International',
  'Local',
];

interface CreateStoryDialogProps {
  onSuccess?: (storyId: string) => void;
}

export function CreateStoryDialog({ onSuccess }: CreateStoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('');

  const utils = trpc.useUtils();
  const createStory = trpc.story.create.useMutation({
    onSuccess: (data) => {
      utils.story.list.invalidate();
      setOpen(false);
      setTitle('');
      setCategory('');
      onSuccess?.(data.id);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createStory.mutate({
      title: title.trim(),
      category: category || undefined,
    });
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
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              type="submit"
              disabled={!title.trim() || createStory.isPending}
            >
              {createStory.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
