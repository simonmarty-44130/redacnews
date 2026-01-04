'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
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
import { UserPlus, Loader2, Check, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLES = [
  {
    value: 'JOURNALIST',
    label: 'Journaliste',
    description: 'Peut créer et éditer des sujets et conducteurs',
  },
  {
    value: 'EDITOR_IN_CHIEF',
    label: 'Rédacteur en chef',
    description: 'Peut valider les sujets et gérer les plannings',
  },
  {
    value: 'TECHNICIAN',
    label: 'Technicien',
    description: 'Accès aux outils techniques et à la médiathèque',
  },
  {
    value: 'FREELANCER',
    label: 'Pigiste',
    description: 'Accès limité aux sujets qui lui sont assignés',
  },
  {
    value: 'ADMIN',
    label: 'Administrateur',
    description: 'Accès complet, peut gérer l\'équipe',
  },
];

export function InviteMemberDialog({
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<string>('JOURNALIST');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const invite = trpc.team.invite.useMutation({
    onSuccess: (data) => {
      toast.success(`Invitation créée pour ${data.email}`);
      setInviteUrl(data.inviteUrl);
      utils.team.listInvitations.invalidate();
      // Ouvrir Gmail pour envoyer l'email
      if (data.gmailUrl) {
        window.open(data.gmailUrl, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    invite.mutate({
      email,
      role: role as any,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });
  };

  const handleClose = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole('JOURNALIST');
    setInviteUrl(null);
    onOpenChange(false);
  };

  const copyLink = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Lien copié !');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Inviter un membre
          </DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email pour rejoindre votre organisation.
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="collegue@radio.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={invite.isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={invite.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={invite.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rôle *</Label>
              <Select
                value={role}
                onValueChange={setRole}
                disabled={invite.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={invite.isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={invite.isPending || !email}>
                {invite.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Envoyer l'invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-lg">Invitation créée !</h3>
              <p className="text-muted-foreground mt-1">
                Gmail s'est ouvert pour envoyer l'invitation à <strong>{email}</strong>
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <Label className="text-xs text-muted-foreground">
                Lien d'invitation (valable 7 jours)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={inviteUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(inviteUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Vous pouvez aussi partager ce lien directement.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Fermer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
