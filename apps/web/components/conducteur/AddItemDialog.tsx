'use client';

import { useState, useEffect } from 'react';
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
import { StorySelector } from './StorySelector';

const ITEM_TYPES = [
  { value: 'STORY', label: 'Sujet' },
  { value: 'INTERVIEW', label: 'Interview / Son' },
  { value: 'JINGLE', label: 'Jingle' },
  { value: 'MUSIC', label: 'Musique' },
  { value: 'LIVE', label: 'Direct' },
  { value: 'BREAK', label: 'Pause pub' },
  { value: 'OTHER', label: 'Autre' },
];

interface SelectedStory {
  id: string;
  title: string;
  estimatedDuration: number | null;
  status: string;
  category: string | null;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  media: Array<{
    id: string;
    mediaItem: {
      id: string;
      title: string;
      type: string;
      duration: number | null;
      s3Url: string;
    };
  }>;
}

interface AddItemInput {
  type: 'STORY' | 'INTERVIEW' | 'JINGLE' | 'MUSIC' | 'LIVE' | 'BREAK' | 'OTHER';
  title: string;
  duration: number;
  storyId?: string;
}

interface AddItemDialogProps {
  rundownId: string;
  onSuccess?: () => void;
  onAddItem?: (item: AddItemInput) => void; // Collaborative mode callback
}

export function AddItemDialog({ rundownId, onSuccess, onAddItem }: AddItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>('STORY');
  const [title, setTitle] = useState('');
  const [durationMins, setDurationMins] = useState('2');
  const [durationSecs, setDurationSecs] = useState('0');
  const [selectedStory, setSelectedStory] = useState<SelectedStory | null>(null);

  const utils = trpc.useUtils();
  const addItem = trpc.rundown.addItem.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate({ id: rundownId });
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
  });

  // Update title and duration when story is selected
  const handleStorySelect = (story: SelectedStory | null) => {
    setSelectedStory(story);
    if (story) {
      setTitle(story.title);
      const duration = story.estimatedDuration || 120;
      setDurationMins(Math.floor(duration / 60).toString());
      setDurationSecs((duration % 60).toString());
    } else {
      setTitle('');
      setDurationMins('2');
      setDurationSecs('0');
    }
  };

  // Reset story selection when type changes from STORY
  useEffect(() => {
    if (type !== 'STORY') {
      setSelectedStory(null);
    }
  }, [type]);

  const resetForm = () => {
    setType('STORY');
    setTitle('');
    setDurationMins('2');
    setDurationSecs('0');
    setSelectedStory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For STORY type, require a selected story
    if (type === 'STORY' && !selectedStory) return;
    if (type !== 'STORY' && !title.trim()) return;

    const duration =
      parseInt(durationMins || '0') * 60 + parseInt(durationSecs || '0');

    const itemData: AddItemInput = {
      type: type as AddItemInput['type'],
      title: title.trim(),
      duration,
      ...(type === 'STORY' && selectedStory && { storyId: selectedStory.id }),
    };

    // Use collaborative callback if provided
    if (onAddItem) {
      onAddItem(itemData);
      setOpen(false);
      resetForm();
      onSuccess?.();
    } else {
      // Fallback to direct API call
      addItem.mutate({
        rundownId,
        ...itemData,
      });
    }
  };

  // Determine if form is valid
  const isFormValid = type === 'STORY' ? !!selectedStory : !!title.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un element
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un element</DialogTitle>
            <DialogDescription>
              Ajoutez un nouvel element au conducteur.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* For STORY type: show story selector */}
            {type === 'STORY' ? (
              <>
                <div className="grid gap-2">
                  <Label>Sujet</Label>
                  <StorySelector
                    value={selectedStory?.id}
                    onSelect={handleStorySelect}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Duree (modifiable)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="99"
                      value={durationMins}
                      onChange={(e) => setDurationMins(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-gray-500">min</span>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={durationSecs}
                      onChange={(e) => setDurationSecs(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-gray-500">sec</span>
                  </div>
                </div>
              </>
            ) : (
              /* For other types: show manual fields */
              <>
                <div className="grid gap-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Lancement - Sommaire"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Duree</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="99"
                      value={durationMins}
                      onChange={(e) => setDurationMins(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-gray-500">min</span>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={durationSecs}
                      onChange={(e) => setDurationSecs(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-gray-500">sec</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!isFormValid || addItem.isPending}>
              {addItem.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
