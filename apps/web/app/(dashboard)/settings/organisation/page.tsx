'use client';

import { useState, useEffect } from 'react';
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
  Building2,
  Save,
  Loader2,
  Users,
  Radio,
  FileText,
  Music,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function OrganisationPage() {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: organization, isLoading } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();

  const updateOrganization = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => {
      toast.success('Organisation mise à jour');
      utils.settings.getOrganization.invalidate();
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Initialiser les valeurs quand les données arrivent
  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setLogo(organization.logo || '');
    }
  }, [organization]);

  // Détecter les changements
  useEffect(() => {
    if (organization) {
      const nameChanged = name !== organization.name;
      const logoChanged = logo !== (organization.logo || '');
      setHasChanges(nameChanged || logoChanged);
    }
  }, [name, logo, organization]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization.mutate({
      name: name !== organization?.name ? name : undefined,
      logo: logo !== (organization?.logo || '') ? (logo || null) : undefined,
    });
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
          <Building2 className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Organisation</h1>
            <p className="text-muted-foreground">
              Paramètres de votre organisation
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
            <CardDescription>
              Modifiez les informations de votre organisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'organisation *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ma Radio"
                  disabled={updateOrganization.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">URL du logo</Label>
                <Input
                  id="logo"
                  type="url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled={updateOrganization.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  URL d'une image (PNG, JPG) pour le logo de votre organisation
                </p>
              </div>

              {logo && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Aperçu du logo
                  </Label>
                  <img
                    src={logo}
                    alt="Logo preview"
                    className="h-16 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={!hasChanges || updateOrganization.isPending}
                >
                  {updateOrganization.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
            <CardDescription>
              Vue d'ensemble de votre organisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900">
                  {organization?._count.users || 0}
                </div>
                <div className="text-sm text-blue-600">Membres</div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <Radio className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-900">
                  {organization?._count.shows || 0}
                </div>
                <div className="text-sm text-purple-600">Émissions</div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg text-center">
                <FileText className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900">
                  {organization?._count.stories || 0}
                </div>
                <div className="text-sm text-green-600">Sujets</div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg text-center">
                <Music className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-900">
                  {organization?._count.mediaItems || 0}
                </div>
                <div className="text-sm text-amber-600">Médias</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations techniques */}
        <Card>
          <CardHeader>
            <CardTitle>Informations techniques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Identifiant</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                {organization?.id}
              </code>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Slug</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                {organization?.slug}
              </code>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Date de création</span>
              <span>
                {organization?.createdAt &&
                  format(new Date(organization.createdAt), 'd MMMM yyyy', {
                    locale: fr,
                  })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
