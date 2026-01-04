'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
  Bell,
  Mail,
  Smartphone,
  Save,
  Loader2,
  ArrowLeft,
  FileText,
  Radio,
  UserPlus,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState({
    emailNewStory: true,
    emailRundownReady: true,
    emailInvitation: true,
    emailWeeklyDigest: false,
    pushNewStory: false,
    pushRundownReady: false,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: initialPrefs, isLoading } =
    trpc.settings.getNotificationPreferences.useQuery(undefined, {
      onSuccess: (data) => {
        setPreferences(data);
      },
    });

  const updatePreferences = trpc.settings.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success('Préférences mises à jour');
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return newPrefs;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences.mutate(preferences);
  };

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
          <Bell className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              Gérez vos préférences de notifications
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Notifications par email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notifications par email
              </CardTitle>
              <CardDescription>
                Choisissez quand recevoir des emails de RédacNews
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="emailNewStory" className="font-medium">
                      Nouveau sujet
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quand un sujet vous est assigné
                    </p>
                  </div>
                </div>
                <Switch
                  id="emailNewStory"
                  checked={preferences.emailNewStory}
                  onCheckedChange={() => handleToggle('emailNewStory')}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Radio className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="emailRundownReady" className="font-medium">
                      Conducteur prêt
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quand un conducteur passe en statut "Prêt"
                    </p>
                  </div>
                </div>
                <Switch
                  id="emailRundownReady"
                  checked={preferences.emailRundownReady}
                  onCheckedChange={() => handleToggle('emailRundownReady')}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="emailInvitation" className="font-medium">
                      Nouvelles invitations
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quand quelqu'un rejoint l'équipe
                    </p>
                  </div>
                </div>
                <Switch
                  id="emailInvitation"
                  checked={preferences.emailInvitation}
                  onCheckedChange={() => handleToggle('emailInvitation')}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="emailWeeklyDigest" className="font-medium">
                      Résumé hebdomadaire
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Un récapitulatif de l'activité chaque lundi
                    </p>
                  </div>
                </div>
                <Switch
                  id="emailWeeklyDigest"
                  checked={preferences.emailWeeklyDigest}
                  onCheckedChange={() => handleToggle('emailWeeklyDigest')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications push */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Notifications push
              </CardTitle>
              <CardDescription>
                Notifications dans le navigateur (nécessite l'autorisation)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="pushNewStory" className="font-medium">
                      Nouveau sujet
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notification instantanée pour les nouveaux sujets
                    </p>
                  </div>
                </div>
                <Switch
                  id="pushNewStory"
                  checked={preferences.pushNewStory}
                  onCheckedChange={() => handleToggle('pushNewStory')}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Radio className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="pushRundownReady" className="font-medium">
                      Conducteur prêt
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notification quand un conducteur est finalisé
                    </p>
                  </div>
                </div>
                <Switch
                  id="pushRundownReady"
                  checked={preferences.pushRundownReady}
                  onCheckedChange={() => handleToggle('pushRundownReady')}
                />
              </div>

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note :</strong> Les notifications push ne sont pas encore
                  disponibles. Cette fonctionnalité arrive prochainement.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bouton de sauvegarde */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!hasChanges || updatePreferences.isPending}
            >
              {updatePreferences.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les préférences
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
