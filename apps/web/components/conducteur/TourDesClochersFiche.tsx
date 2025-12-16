'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Trash2,
  MapPin,
  Calendar,
  Star,
  Radio,
  Phone,
  Mail,
  Loader2,
  Church,
  User,
  Clock,
  Users,
  BookOpen,
  Building2,
  Landmark,
  Heart,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============ CRÉNEAUX FIXES DU TOUR DES CLOCHERS ============
// Ces créneaux correspondent aux éléments INTERVIEW du template

const CRENEAUX = {
  'vie-paroissiale': {
    id: 'vie-paroissiale',
    startTime: '7h31',
    endTime: '7h58',
    duration: 27,
    label: 'Vie paroissiale',
    description: 'Invités paroissiaux (peut avoir plusieurs invités)',
    icon: Users,
    // Titres des items dans le template qui correspondent à ce créneau
    templateTitles: ['Vie paroissiale'],
    variablePrefix: 'INVITE_PAROISSIAL',
  },
  elus: {
    id: 'elus',
    startTime: '8h06',
    endTime: '8h16',
    duration: 10,
    label: 'Élus / Institution',
    description: 'Maire, adjoints, élus locaux...',
    icon: Building2,
    templateTitles: ['Élus / Institution'],
    variablePrefix: 'INVITE_ELUS',
  },
  histoire: {
    id: 'histoire',
    startTime: '8h17',
    endTime: '8h28',
    duration: 11,
    label: 'Histoire / Patrimoine',
    description: 'Historien local, association patrimoine...',
    icon: Landmark,
    templateTitles: ['Histoire / Patrimoine'],
    variablePrefix: 'INVITE_PATRIMOINE',
  },
  association: {
    id: 'association',
    startTime: '8h45',
    endTime: '8h55',
    duration: 10,
    label: 'Association',
    description: 'Association locale, initiative solidaire...',
    icon: Heart,
    templateTitles: ['Association'],
    variablePrefix: 'INVITE_ASSOCIATION',
  },
} as const;

type CreneauId = keyof typeof CRENEAUX;

// ============ VALIDATION SCHEMA ============

const guestSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  description: z.string().optional(),
});

const creneauSchema = z.object({
  guests: z.array(guestSchema),
});

const formSchema = z.object({
  // Date
  date: z.string().min(1, 'Date requise'),

  // Lieu
  paroisse: z.string().min(1, 'Nom de la paroisse requis'),
  commune: z.string().min(1, 'Nom de la commune requis'),
  adresse: z.string().optional(),
  directionGeographique: z.string().optional(),
  descriptionParoisse: z.string().optional(),

  // Invité fil rouge (le prêtre)
  inviteFilRouge: z.object({
    name: z.string().min(1, 'Nom du prêtre requis'),
    phone: z.string().optional(),
  }),

  // Évangile (optionnel)
  evangile: z.object({
    livre: z.string().optional(),
    chapitre: z.string().optional(),
    versets: z.string().optional(),
    commentateur: z.string().optional(),
  }),

  // 4 créneaux
  creneaux: z.object({
    'vie-paroissiale': creneauSchema,
    elus: creneauSchema,
    histoire: creneauSchema,
    association: creneauSchema,
  }),

  // Prochaine destination
  prochaineDestination: z.string().optional(),

  // Notes
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// ============ COMPOSANT PRINCIPAL ============

interface TourDesClochersFicheProps {
  showId: string;
  onClose?: () => void;
  onSuccess?: (rundownId: string) => void;
}

export function TourDesClochersFiche({ showId, onClose, onSuccess }: TourDesClochersFicheProps) {
  const router = useRouter();
  const [creationStep, setCreationStep] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Charger le template "Tour des Clochers"
  const { data: templates, isLoading: loadingTemplates } = trpc.template.list.useQuery({
    showId,
  });

  const tourDesClochers = useMemo(() => {
    return templates?.find(
      (t) =>
        t.name.toLowerCase().includes('tour des clochers') ||
        t.name.toLowerCase().includes('conducteur complet')
    );
  }, [templates]);

  // Calculer le prochain vendredi
  const getNextFriday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    return nextFriday.toISOString().split('T')[0];
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: getNextFriday(),
      paroisse: '',
      commune: '',
      adresse: '',
      directionGeographique: '',
      descriptionParoisse: '',
      inviteFilRouge: {
        name: '',
        phone: '',
      },
      evangile: {
        livre: '',
        chapitre: '',
        versets: '',
        commentateur: '',
      },
      creneaux: {
        'vie-paroissiale': { guests: [{ name: '', phone: '', email: '', description: '' }] },
        elus: { guests: [{ name: '', phone: '', email: '', description: '' }] },
        histoire: { guests: [{ name: '', phone: '', email: '', description: '' }] },
        association: { guests: [{ name: '', phone: '', email: '', description: '' }] },
      },
      prochaineDestination: '',
      notes: '',
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const watchedDate = watch('date');
  const formattedDate = useMemo(() => {
    if (!watchedDate) return '';
    const date = new Date(watchedDate);
    return format(date, 'd MMMM', { locale: fr });
  }, [watchedDate]);

  // Mutations
  const utils = trpc.useUtils();

  const createFromTemplate = trpc.template.createRundownFromTemplate.useMutation();
  const updateRundownInfo = trpc.rundown.updateInfo.useMutation();
  const addTeamMember = trpc.rundown.addTeamMember.useMutation();
  const addGuestToItem = trpc.rundownGuest.addGuestToItem.useMutation();

  const onSubmit = async (data: FormData) => {
    if (!tourDesClochers) {
      toast.error('Template Tour des Clochers non trouvé');
      return;
    }

    setCreationError(null);

    try {
      // ============ ÉTAPE 1 : Créer le conducteur depuis le template ============
      setCreationStep('Création du conducteur...');

      // Préparer les variables pour le template
      const variables: Record<string, string> = {
        DATE_TEXTE: formattedDate,
        COMMUNE: data.commune,
        PAROISSE: data.paroisse,
        DIRECTION_GEOGRAPHIQUE: data.directionGeographique || 'dans le diocèse',
        DESCRIPTION_PAROISSE: data.descriptionParoisse || '',
        INVITE_FIL_ROUGE: data.inviteFilRouge.name,
        PROCHAINE_DESTINATION: data.prochaineDestination || '',
      };

      // Évangile
      if (data.evangile.livre) variables.EVANGILE_LIVRE = data.evangile.livre;
      if (data.evangile.chapitre) variables.EVANGILE_CHAPITRE = data.evangile.chapitre;
      if (data.evangile.versets) variables.EVANGILE_VERSETS = data.evangile.versets;
      if (data.evangile.commentateur) variables.COMMENTATEUR_EVANGILE = data.evangile.commentateur;

      // Noms des invités pour les annonces
      const invitesVieParoissiale = data.creneaux['vie-paroissiale'].guests
        .filter((g) => g.name.trim())
        .map((g) => g.name)
        .join(', ');
      if (invitesVieParoissiale) {
        variables.INVITES_VIE_PAROISSIALE = invitesVieParoissiale;
        const firstGuest = data.creneaux['vie-paroissiale'].guests.find((g) => g.name.trim());
        if (firstGuest) variables.INVITE_PAROISSIAL_1 = firstGuest.name;
      }

      const inviteElus = data.creneaux.elus.guests.find((g) => g.name.trim());
      if (inviteElus) variables.INVITE_ELUS = inviteElus.name;

      const invitePatrimoine = data.creneaux.histoire.guests.find((g) => g.name.trim());
      if (invitePatrimoine) variables.INVITE_PATRIMOINE = invitePatrimoine.name;

      const inviteAssociation = data.creneaux.association.guests.find((g) => g.name.trim());
      if (inviteAssociation) variables.INVITE_ASSOCIATION = inviteAssociation.name;

      // Créer le conducteur
      const rundown = await createFromTemplate.mutateAsync({
        templateId: tourDesClochers.id,
        date: new Date(data.date),
        variables,
        createGoogleDocs: false, // On crée les docs plus tard si besoin
      });

      // ============ ÉTAPE 2 : Mettre à jour les infos générales ============
      setCreationStep('Mise à jour des informations...');

      await updateRundownInfo.mutateAsync({
        id: rundown.id,
        title: data.commune,
        subtitle: data.paroisse,
        startTime: '07:00',
        endTime: '09:00',
        location: data.commune,
        locationAddress: data.adresse || undefined,
        notes: data.notes || undefined,
      });

      // ============ ÉTAPE 3 : Ajouter l'invité fil rouge ============
      setCreationStep("Ajout de l'invité fil rouge...");

      await addTeamMember.mutateAsync({
        rundownId: rundown.id,
        role: 'MAIN_GUEST',
        name: data.inviteFilRouge.name,
        phone: data.inviteFilRouge.phone || undefined,
        location: 'sur place',
      });

      // ============ ÉTAPE 4 : Ajouter les invités sur les créneaux ============
      setCreationStep('Ajout des invités...');

      // Pour chaque créneau, trouver les items correspondants et ajouter les invités
      for (const [creneauId, creneauData] of Object.entries(data.creneaux)) {
        const creneau = CRENEAUX[creneauId as CreneauId];
        const validGuests = creneauData.guests.filter((g) => g.name.trim());

        if (validGuests.length === 0) continue;

        // Trouver les items du conducteur qui correspondent à ce créneau
        // On cherche par le titre de l'élément
        const matchingItems = rundown.items.filter((item) =>
          creneau.templateTitles.some(
            (title) =>
              item.title.toLowerCase().includes(title.toLowerCase()) ||
              item.title.toLowerCase().includes(creneau.label.toLowerCase())
          )
        );

        // Ajouter les invités sur le premier item trouvé (ou tous si plusieurs invités)
        for (const item of matchingItems) {
          for (const guest of validGuests) {
            try {
              await addGuestToItem.mutateAsync({
                rundownItemId: item.id,
                name: guest.name,
                email: guest.email || undefined,
                notes: guest.description || undefined,
                role: guest.phone ? `Tél: ${guest.phone}` : undefined,
              });
            } catch (error) {
              console.error(`Erreur ajout invité ${guest.name}:`, error);
            }
          }
        }
      }

      // ============ SUCCÈS ============
      setCreationStep(null);
      toast.success('Conducteur créé avec succès !');

      // Invalider le cache
      utils.rundown.list.invalidate();

      if (onSuccess) {
        onSuccess(rundown.id);
      } else {
        router.push(`/conducteur?selected=${rundown.id}`);
      }
    } catch (error) {
      console.error('Erreur création conducteur:', error);
      setCreationError(error instanceof Error ? error.message : 'Erreur inconnue');
      setCreationStep(null);
      toast.error(`Erreur : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const isCreating = creationStep !== null;

  // Afficher un loader si on charge les templates
  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  // Si pas de template trouvé
  if (!tourDesClochers) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Le template "Tour des Clochers" n'a pas été trouvé.
            <br />
            Exécutez le script de seed : <code>npx tsx prisma/seed-tour-des-clochers.ts</code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-amber-100 rounded-full">
          <Church className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Le Tour des Clochers</h1>
          <p className="text-muted-foreground">Fiche de préparation - 7h00 à 9h00</p>
        </div>
      </div>

      {/* Indicateur de template */}
      <Alert className="mb-6 border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Template trouvé : <strong>{tourDesClochers.name}</strong> ({tourDesClochers._count?.items || '?'} éléments)
        </AlertDescription>
      </Alert>

      {/* Message de création en cours */}
      {isCreating && (
        <Alert className="mb-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>{creationStep}</AlertDescription>
        </Alert>
      )}

      {/* Erreur de création */}
      {creationError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{creationError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Date */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label htmlFor="date">Date de l'émission (vendredi)</Label>
                <Input type="date" {...register('date')} className="mt-1 max-w-xs" />
                {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date.message}</p>}
              </div>
              {formattedDate && (
                <Badge variant="outline" className="text-base">
                  {formattedDate}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lieu */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              Lieu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paroisse">Paroisse *</Label>
                <Input
                  {...register('paroisse')}
                  placeholder="Ex: Nouvelle-Alliance-Hauts-de-l'Erdre"
                  className="mt-1"
                />
                {errors.paroisse && (
                  <p className="text-sm text-red-500 mt-1">{errors.paroisse.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="commune">Commune *</Label>
                <Input {...register('commune')} placeholder="Ex: Riaillé" className="mt-1" />
                {errors.commune && (
                  <p className="text-sm text-red-500 mt-1">{errors.commune.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="adresse">Adresse complète du lieu</Label>
              <Input
                {...register('adresse')}
                placeholder="Ex: Maison paroissiale de Riaillé"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="directionGeographique">Direction géographique</Label>
                <Input
                  {...register('directionGeographique')}
                  placeholder="Ex: au nord-est du diocèse"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Utilisé dans l'intro : "Tiphaine nous emmène [direction]..."
                </p>
              </div>
              <div>
                <Label htmlFor="descriptionParoisse">Description courte</Label>
                <Input
                  {...register('descriptionParoisse')}
                  placeholder="Ex: 9 clochers, 9 communautés"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invité fil rouge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-amber-500" />
              Invité fil rouge
            </CardTitle>
            <CardDescription>Présent toute l'émission (7h07-8h58)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nom *</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...register('inviteFilRouge.name')}
                    className="pl-10"
                    placeholder="Ex: Père Jean-Marc Houssais"
                  />
                </div>
                {errors.inviteFilRouge?.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.inviteFilRouge.name.message}</p>
                )}
              </div>
              <div>
                <Label>Téléphone</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...register('inviteFilRouge.phone')}
                    className="pl-10"
                    placeholder="06 XX XX XX XX"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Évangile (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Évangile du jour
            </CardTitle>
            <CardDescription>Optionnel - Pour personnaliser les scripts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Livre</Label>
                <Input
                  {...register('evangile.livre')}
                  placeholder="Luc"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Chapitre</Label>
                <Input
                  {...register('evangile.chapitre')}
                  placeholder="12"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Versets</Label>
                <Input
                  {...register('evangile.versets')}
                  placeholder="1 à 7"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Commentateur</Label>
                <Input
                  {...register('evangile.commentateur')}
                  placeholder="Isabelle Sebilleau"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Créneaux */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Intervenants par créneau
          </h2>

          {(Object.keys(CRENEAUX) as CreneauId[]).map((creneauId) => (
            <CreneauCard
              key={creneauId}
              creneau={CRENEAUX[creneauId]}
              control={control}
              register={register}
              errors={errors}
            />
          ))}
        </div>

        {/* Prochaine destination */}
        <Card>
          <CardContent className="pt-6">
            <Label>Prochaine destination (pour la conclusion)</Label>
            <Input
              {...register('prochaineDestination')}
              placeholder="Ex: Saint-Gildas-des-Bois"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              "Vendredi prochain, le Tour des Clochers fera étape à..."
            </p>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register('notes')}
              placeholder="Notes complémentaires, points d'attention..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {creationStep}
              </>
            ) : (
              <>
                <Radio className="h-4 w-4 mr-2" />
                Créer le conducteur complet
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============ SOUS-COMPOSANT : CARTE CRÉNEAU ============

function CreneauCard({
  creneau,
  control,
  register,
  errors,
}: {
  creneau: (typeof CRENEAUX)[CreneauId];
  control: any;
  register: any;
  errors: any;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `creneaux.${creneau.id}.guests`,
  });

  const Icon = creneau.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{creneau.label}</h3>
                <Badge variant="outline" className="font-mono text-xs">
                  {creneau.startTime} - {creneau.endTime}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{creneau.description}</p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{creneau.duration} min</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-3">
                {/* Nom */}
                <div>
                  <Input
                    {...register(`creneaux.${creneau.id}.guests.${index}.name`)}
                    placeholder="Nom de l'invité"
                    className="font-medium"
                  />
                </div>

                {/* Téléphone + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...register(`creneaux.${creneau.id}.guests.${index}.phone`)}
                      className="pl-10"
                      placeholder="Téléphone"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...register(`creneaux.${creneau.id}.guests.${index}.email`)}
                      className="pl-10"
                      type="email"
                      placeholder="Email"
                    />
                  </div>
                </div>

                {/* Description / Contexte */}
                <Textarea
                  {...register(`creneaux.${creneau.id}.guests.${index}.description`)}
                  placeholder="Fonction, contexte, points à aborder..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="h-8 w-8 mt-1"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: '', phone: '', email: '', description: '' })}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un invité sur ce créneau
        </Button>
      </CardContent>
    </Card>
  );
}
