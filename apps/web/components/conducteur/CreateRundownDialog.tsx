'use client';

import { useState } from 'react';
import { Plus, Calendar, Radio, Palette } from 'lucide-react';
import { format } from 'date-fns';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface CreateRundownDialogProps {
  onSuccess?: (rundownId: string) => void;
}

// Couleurs prédéfinies pour les émissions
const SHOW_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

// Catégories d'émissions
const SHOW_CATEGORIES = [
  { value: 'FLASH', label: 'Flash info (1-3 min)' },
  { value: 'JOURNAL', label: 'Journal (6-12 min)' },
  { value: 'MAGAZINE', label: 'Magazine (1-2h)' },
  { value: 'CHRONIQUE', label: 'Chronique' },
  { value: 'AUTRE', label: 'Autre' },
];

export function CreateRundownDialog({ onSuccess }: CreateRundownDialogProps) {
  const [open, setOpen] = useState(false);
  const [showId, setShowId] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // État pour la création d'une nouvelle émission
  const [isCreatingShow, setIsCreatingShow] = useState(false);
  const [newShowName, setNewShowName] = useState('');
  const [newShowDescription, setNewShowDescription] = useState('');
  const [newShowDuration, setNewShowDuration] = useState(60);
  const [newShowColor, setNewShowColor] = useState(SHOW_COLORS[0]);
  const [newShowCategory, setNewShowCategory] = useState<string>('MAGAZINE');

  const { data: shows, refetch: refetchShows } = trpc.rundown.listShows.useQuery();

  const utils = trpc.useUtils();
  
  const createShow = trpc.rundown.createShow.useMutation({
    onSuccess: (data) => {
      // Rafraîchir la liste des émissions et sélectionner la nouvelle
      refetchShows().then(() => {
        setShowId(data.id);
        setIsCreatingShow(false);
        resetShowForm();
      });
    },
  });

  const createRundown = trpc.rundown.create.useMutation({
    onSuccess: (data) => {
      utils.rundown.list.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.(data.id);
    },
  });

  const resetShowForm = () => {
    setNewShowName('');
    setNewShowDescription('');
    setNewShowDuration(60);
    setNewShowColor(SHOW_COLORS[0]);
    setNewShowCategory('MAGAZINE');
  };

  const resetForm = () => {
    setShowId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setIsCreatingShow(false);
    resetShowForm();
  };

  const handleCreateShow = () => {
    if (!newShowName.trim()) return;

    createShow.mutate({
      name: newShowName.trim(),
      description: newShowDescription.trim() || undefined,
      defaultDuration: newShowDuration,
      color: newShowColor,
      category: newShowCategory as 'FLASH' | 'JOURNAL' | 'MAGAZINE' | 'CHRONIQUE' | 'AUTRE',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showId || !date) return;

    createRundown.mutate({
      showId,
      date: new Date(date),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau conducteur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {!isCreatingShow ? (
          // Formulaire de création de conducteur
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Créer un conducteur</DialogTitle>
              <DialogDescription>
                Sélectionnez une émission et une date pour créer un nouveau conducteur.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="show">Émission</Label>
                <Select value={showId} onValueChange={setShowId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une émission" />
                  </SelectTrigger>
                  <SelectContent>
                    {shows?.map((show) => (
                      <SelectItem key={show.id} value={show.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: show.color }}
                          />
                          {show.name}
                        </div>
                      </SelectItem>
                    ))}
                    {/* Option pour créer une nouvelle émission */}
                    <div className="border-t my-1" />
                    <button
                      type="button"
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-blue-600"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsCreatingShow(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer une nouvelle émission
                    </button>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
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
                disabled={!showId || !date || createRundown.isPending}
              >
                {createRundown.isPending ? 'Création...' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // Formulaire de création d'émission
          <div>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Nouvelle émission
              </DialogTitle>
              <DialogDescription>
                Créez un modèle d'émission réutilisable pour vos conducteurs.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="showName">Nom de l'émission *</Label>
                <Input
                  id="showName"
                  placeholder="Ex: Flash Info 7h, Tour des Clochers..."
                  value={newShowName}
                  onChange={(e) => setNewShowName(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="showDescription">Description</Label>
                <Textarea
                  id="showDescription"
                  placeholder="Description de l'émission (optionnel)"
                  value={newShowDescription}
                  onChange={(e) => setNewShowDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="showCategory">Type</Label>
                  <Select value={newShowCategory} onValueChange={setNewShowCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOW_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="showDuration">Durée (minutes)</Label>
                  <Input
                    id="showDuration"
                    type="number"
                    min={1}
                    max={240}
                    value={newShowDuration}
                    onChange={(e) => setNewShowDuration(parseInt(e.target.value) || 60)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Couleur
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {SHOW_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        newShowColor === color
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewShowColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreatingShow(false);
                  resetShowForm();
                }}
              >
                Retour
              </Button>
              <Button
                type="button"
                disabled={!newShowName.trim() || createShow.isPending}
                onClick={handleCreateShow}
              >
                {createShow.isPending ? 'Création...' : 'Créer l\'émission'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
