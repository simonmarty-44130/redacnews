'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ArrowLeft,
  Check,
  AlertCircle,
  User,
  Mail,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Labels français pour les rôles
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  EDITOR_IN_CHIEF: 'Rédacteur en chef',
  JOURNALIST: 'Journaliste',
  TECHNICIAN: 'Technicien',
  FREELANCER: 'Pigiste',
};

export default function SecuritePage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data: profile, isLoading } = trpc.settings.getProfile.useQuery();

  const changePassword = trpc.settings.changePassword.useMutation({
    onSuccess: () => {
      toast.success('Mot de passe modifié avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères');
      return;
    }

    changePassword.mutate({
      currentPassword,
      newPassword,
    });
  };

  // Validation du mot de passe en temps réel
  const passwordValidation = {
    length: newPassword.length >= 8,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /\d/.test(newPassword),
    match: newPassword === confirmPassword && confirmPassword.length > 0,
  };

  const isValidPassword = Object.values(passwordValidation).every(Boolean);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Sécurité</h1>
            <p className="text-muted-foreground">
              Gérez votre mot de passe et la sécurité de votre compte
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Informations du compte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations du compte
            </CardTitle>
            <CardDescription>
              Détails de votre compte utilisateur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Nom</span>
              </div>
              <span className="font-medium">
                {profile?.firstName} {profile?.lastName}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email</span>
              </div>
              <span className="font-medium">{profile?.email}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Rôle</span>
              </div>
              <span className="font-medium">
                {profile?.role && ROLE_LABELS[profile.role]}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Membre depuis</span>
              </div>
              <span>
                {profile?.createdAt &&
                  format(new Date(profile.createdAt), 'd MMMM yyyy', {
                    locale: fr,
                  })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Changement de mot de passe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Changer le mot de passe
            </CardTitle>
            <CardDescription>
              Utilisez un mot de passe fort et unique
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe actuel"
                    disabled={changePassword.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Entrez votre nouveau mot de passe"
                    disabled={changePassword.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Indicateurs de validation */}
                {newPassword.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <ValidationItem
                      valid={passwordValidation.length}
                      text="Au moins 8 caractères"
                    />
                    <ValidationItem
                      valid={passwordValidation.lowercase}
                      text="Une lettre minuscule"
                    />
                    <ValidationItem
                      valid={passwordValidation.uppercase}
                      text="Une lettre majuscule"
                    />
                    <ValidationItem
                      valid={passwordValidation.number}
                      text="Un chiffre"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  disabled={changePassword.isPending}
                />
                {confirmPassword.length > 0 && (
                  <ValidationItem
                    valid={passwordValidation.match}
                    text="Les mots de passe correspondent"
                  />
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={
                    !currentPassword ||
                    !isValidPassword ||
                    changePassword.isPending
                  }
                >
                  {changePassword.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Modification...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Changer le mot de passe
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Authentification à deux facteurs (à venir) */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Authentification à deux facteurs
              <span className="text-xs font-normal bg-gray-100 px-2 py-1 rounded ml-2">
                Bientôt
              </span>
            </CardTitle>
            <CardDescription>
              Ajoutez une couche de sécurité supplémentaire à votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              L'authentification à deux facteurs (2FA) sera bientôt disponible.
              Cette fonctionnalité vous permettra de sécuriser votre compte avec
              une application d'authentification.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Composant pour les indicateurs de validation
function ValidationItem({ valid, text }: { valid: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {valid ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-gray-300" />
      )}
      <span className={valid ? 'text-green-600' : 'text-muted-foreground'}>
        {text}
      </span>
    </div>
  );
}
