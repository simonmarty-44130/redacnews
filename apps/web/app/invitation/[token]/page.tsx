'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Query pour vérifier l'invitation
  const {
    data: invitation,
    isLoading,
    error,
  } = trpc.team.getInvitation.useQuery(
    { token },
    {
      retry: false,
    }
  );

  // Mutation pour accepter
  const acceptInvitation = trpc.team.acceptInvitation.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      toast.success('Compte créé avec succès !');
      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères');
      return;
    }

    acceptInvitation.mutate({
      token,
      firstName,
      lastName,
      password,
    });
  };

  // État de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-muted-foreground">
            Vérification de l'invitation...
          </p>
        </div>
      </div>
    );
  }

  // Erreur (invitation invalide, expirée, etc.)
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Invitation invalide
              </h2>
              <p className="mt-2 text-muted-foreground">{error.message}</p>
              <Button className="mt-6" onClick={() => router.push('/login')}>
                Retour à la connexion
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Succès - compte créé
  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Bienvenue dans l'équipe !
              </h2>
              <p className="mt-2 text-muted-foreground">
                Votre compte a été créé avec succès. Vous allez être redirigé
                vers la page de connexion...
              </p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulaire d'acceptation
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Radio className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            Rejoignez {invitation?.organization.name}
          </CardTitle>
          <CardDescription>
            Vous avez été invité(e) à rejoindre l'équipe sur RédacNews
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="font-medium">{invitation?.email}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-muted-foreground">Rôle</span>
              <Badge variant="secondary">{invitation?.roleLabel}</Badge>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  required
                  disabled={acceptInvitation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  required
                  disabled={acceptInvitation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  required
                  minLength={8}
                  disabled={acceptInvitation.isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Au moins 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                disabled={acceptInvitation.isPending}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                acceptInvitation.isPending ||
                !firstName ||
                !lastName ||
                !password ||
                !confirmPassword
              }
            >
              {acceptInvitation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création du compte...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Créer mon compte
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
