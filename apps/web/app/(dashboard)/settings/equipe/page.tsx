'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Mail,
  Clock,
  Shield,
  Trash2,
  RefreshCw,
  XCircle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { InviteMemberDialog } from '@/components/settings/InviteMemberDialog';

// Couleurs des badges de rôle
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800 border-red-200',
  EDITOR_IN_CHIEF: 'bg-purple-100 text-purple-800 border-purple-200',
  JOURNALIST: 'bg-blue-100 text-blue-800 border-blue-200',
  TECHNICIAN: 'bg-amber-100 text-amber-800 border-amber-200',
  FREELANCER: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function TeamPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(
    null
  );

  const utils = trpc.useUtils();

  // Queries
  const { data: members, isLoading: membersLoading } =
    trpc.team.listMembers.useQuery();
  const { data: invitations, isLoading: invitationsLoading } =
    trpc.team.listInvitations.useQuery();

  // Mutations
  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success('Membre supprimé');
      utils.team.listMembers.invalidate();
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelInvitation = trpc.team.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success('Invitation annulée');
      utils.team.listInvitations.invalidate();
      setInvitationToCancel(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resendInvitation = trpc.team.resendInvitation.useMutation({
    onSuccess: (data) => {
      toast.success('Invitation renouvelée');
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

  const handleDeleteMember = (id: string, name: string) => {
    setMemberToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteMember = () => {
    if (memberToDelete) {
      removeMember.mutate({ userId: memberToDelete.id });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Équipe</h1>
            <p className="text-muted-foreground">
              Gérez les membres de votre organisation
            </p>
          </div>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter un membre
        </Button>
      </div>

      {/* Membres actuels */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Membres</CardTitle>
          <CardDescription>
            {members?.length || 0} membre(s) dans l'organisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members && members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Ajouté le</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {member.firstName?.[0] || member.email[0].toUpperCase()}
                          {member.lastName?.[0] || ''}
                        </div>
                        <div>
                          <div className="font-medium">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ROLE_COLORS[member.role]}
                      >
                        {member.roleLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(member.createdAt), 'd MMM yyyy', {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled>
                            <Shield className="h-4 w-4 mr-2" />
                            Modifier le rôle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() =>
                              handleDeleteMember(
                                member.id,
                                `${member.firstName} ${member.lastName}`
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun membre pour le moment
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitations en attente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Invitations en attente
          </CardTitle>
          <CardDescription>
            {invitations?.length || 0} invitation(s) en attente de réponse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invitations && invitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Invité par</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invitation.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ROLE_COLORS[invitation.role]}
                      >
                        {invitation.roleLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invitation.invitedBy.firstName}{' '}
                      {invitation.invitedBy.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invitation.expiresAt), 'd MMM yyyy', {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Renvoyer"
                          onClick={() =>
                            resendInvitation.mutate({ id: invitation.id })
                          }
                          disabled={resendInvitation.isPending}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${resendInvitation.isPending ? 'animate-spin' : ''}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Annuler"
                          onClick={() => setInvitationToCancel(invitation.id)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucune invitation en attente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'invitation */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{' '}
              <strong>{memberToDelete?.name}</strong> de l'organisation ? Cette
              action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMember}
              className="bg-red-600 hover:bg-red-700"
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation d'annulation d'invitation */}
      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={() => setInvitationToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette invitation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien d'invitation ne sera plus valide.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (invitationToCancel) {
                  cancelInvitation.mutate({ id: invitationToCancel });
                }
              }}
              disabled={cancelInvitation.isPending}
            >
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
