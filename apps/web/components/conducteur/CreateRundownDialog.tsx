'use client';

import { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
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
import { trpc } from '@/lib/trpc/client';

interface CreateRundownDialogProps {
  onSuccess?: (rundownId: string) => void;
}

export function CreateRundownDialog({ onSuccess }: CreateRundownDialogProps) {
  const [open, setOpen] = useState(false);
  const [showId, setShowId] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: shows } = trpc.rundown.listShows.useQuery();

  const utils = trpc.useUtils();
  const createRundown = trpc.rundown.create.useMutation({
    onSuccess: (data) => {
      utils.rundown.list.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.(data.id);
    },
  });

  const resetForm = () => {
    setShowId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau conducteur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Creer un conducteur</DialogTitle>
            <DialogDescription>
              Selectionnez une emission et une date pour creer un nouveau conducteur.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="show">Emission</Label>
              <Select value={showId} onValueChange={setShowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner une emission" />
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
              {createRundown.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
