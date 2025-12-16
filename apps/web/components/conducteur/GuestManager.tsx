'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { UserPlus, X, Mail, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Guest {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

interface GuestManagerProps {
  rundownItemId: string;
  itemTitle: string;
  itemDuration: number;
  guests: Guest[];
  onUpdate: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GuestManager({
  rundownItemId,
  itemTitle,
  itemDuration,
  guests,
  onUpdate,
}: GuestManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', email: '', role: '' });

  const addGuestMutation = trpc.rundownGuest.addGuestToItem.useMutation({
    onSuccess: () => {
      toast.success('Invite ajoute');
      setIsAdding(false);
      setNewGuest({ name: '', email: '', role: '' });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const removeGuestMutation = trpc.rundownGuest.removeGuest.useMutation({
    onSuccess: () => {
      toast.success('Invite retire');
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const handleAddGuest = () => {
    if (!newGuest.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    addGuestMutation.mutate({
      rundownItemId,
      name: newGuest.name.trim(),
      email: newGuest.email.trim() || undefined,
      role: newGuest.role.trim() || undefined,
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {guests.map((guest) => (
        <Badge
          key={guest.id}
          variant="secondary"
          className="flex items-center gap-1 py-1 px-2"
        >
          <span className="font-medium">{guest.name}</span>
          {guest.role && (
            <span className="text-muted-foreground text-xs">({guest.role})</span>
          )}
          {guest.email && <Mail className="h-3 w-3 text-blue-500" />}
          <button
            onClick={() => removeGuestMutation.mutate({ guestId: guest.id })}
            className="ml-1 hover:text-destructive"
            disabled={removeGuestMutation.isPending}
          >
            {removeGuestMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </Badge>
      ))}

      <Popover open={isAdding} onOpenChange={setIsAdding}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <UserPlus className="h-3 w-3 mr-1" />
            Invite
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div className="text-sm font-medium">
              Ajouter un invite a "{itemTitle}"
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Duree : {formatDuration(itemDuration)}
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor="guest-name" className="text-xs">
                  Nom *
                </Label>
                <Input
                  id="guest-name"
                  value={newGuest.name}
                  onChange={(e) =>
                    setNewGuest({ ...newGuest, name: e.target.value })
                  }
                  placeholder="Jean Dupont"
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="guest-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={newGuest.email}
                  onChange={(e) =>
                    setNewGuest({ ...newGuest, email: e.target.value })
                  }
                  placeholder="jean@exemple.fr"
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="guest-role" className="text-xs">
                  Fonction
                </Label>
                <Input
                  id="guest-role"
                  value={newGuest.role}
                  onChange={(e) =>
                    setNewGuest({ ...newGuest, role: e.target.value })
                  }
                  placeholder="Economiste, Maire..."
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleAddGuest}
                disabled={addGuestMutation.isPending}
              >
                {addGuestMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Ajout...
                  </>
                ) : (
                  'Ajouter'
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
