'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Users,
  Star,
  Radio,
  Mic,
  Music,
  Pause,
  FileText,
  User,
  Phone,
  Mail,
  Check,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

// ============ VALIDATION SCHEMAS ============

const teamMemberSchema = z.object({
  role: z.enum([
    'PRESENTER',
    'CO_PRESENTER',
    'STUDIO_HOST',
    'TECHNICIAN',
    'JOURNALIST',
    'MAIN_GUEST',
    'OTHER',
  ]),
  name: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  location: z.string().optional(),
});

const guestSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  title: z.string().optional(),
  organization: z.string().optional(),
  description: z.string().optional(),
});

const rundownItemSchema = z.object({
  type: z.enum(['STORY', 'INTERVIEW', 'JINGLE', 'MUSIC', 'LIVE', 'BREAK', 'OTHER']),
  title: z.string().min(1, 'Titre requis'),
  duration: z.number().min(0, 'Duree invalide'),
  startTime: z.string().optional(),
  notes: z.string().optional(),
  guests: z.array(guestSchema).optional(),
});

const wizardSchema = z.object({
  // Étape 1
  showId: z.string().min(1, 'Emission requise'),
  date: z.string().min(1, 'Date requise'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  location: z.string().optional(),
  locationAddress: z.string().optional(),
  notes: z.string().optional(),

  // Étape 2
  team: z.array(teamMemberSchema),

  // Étape 3
  items: z.array(rundownItemSchema),
});

type WizardFormData = z.infer<typeof wizardSchema>;

// ============ COMPOSANT PRINCIPAL ============

interface CreateRundownWizardProps {
  shows: Array<{ id: string; name: string; startTime?: string | null }>;
  onClose?: () => void;
  onSuccess?: (rundownId: string) => void;
}

export function CreateRundownWizard({ shows, onClose, onSuccess }: CreateRundownWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      showId: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '07:00',
      endTime: '09:00',
      title: '',
      subtitle: '',
      location: '',
      locationAddress: '',
      notes: '',
      team: [{ role: 'PRESENTER', name: '', phone: '', email: '', location: 'sur place' }],
      items: [],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const teamFields = useFieldArray({ control, name: 'team' });
  const itemsFields = useFieldArray({ control, name: 'items' });

  const createMutation = trpc.rundown.createComplete.useMutation({
    onSuccess: (data) => {
      toast.success('Conducteur cree avec succes !');
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/conducteur?selected=${data.id}`);
      }
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const onSubmit = (data: WizardFormData) => {
    // Nettoyer les données
    const cleanedData = {
      ...data,
      date: new Date(data.date),
      team: data.team.filter((m) => m.name.trim()),
      items: data.items.map((item) => ({
        ...item,
        guests: item.guests?.filter((g) => g.name.trim()),
      })),
    };

    createMutation.mutate(cleanedData);
  };

  const canProceed = () => {
    if (step === 1) {
      return watch('showId') && watch('date');
    }
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Mettre à jour l'heure de début quand on change d'émission
  const selectedShowId = watch('showId');
  const selectedShow = shows.find((s) => s.id === selectedShowId);

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s === step
                    ? 'bg-blue-600 text-white'
                    : s < step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s < step ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 sm:w-24 md:w-32 h-1 mx-2 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Infos generales</span>
          <span>Equipe</span>
          <span>Conducteur</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ========== ÉTAPE 1 : INFOS GÉNÉRALES ========== */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informations generales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Émission et date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="showId">Emission *</Label>
                  <Controller
                    name="showId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-remplir l'heure de début
                          const show = shows.find((s) => s.id === value);
                          if (show?.startTime) {
                            setValue('startTime', show.startTime);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionner une emission" />
                        </SelectTrigger>
                        <SelectContent>
                          {shows.map((show) => (
                            <SelectItem key={show.id} value={show.id}>
                              {show.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.showId && <p className="text-sm text-red-500">{errors.showId.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input type="date" {...register('date')} />
                </div>
              </div>

              {/* Horaires */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Heure de debut</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="time" {...register('startTime')} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Heure de fin</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="time" {...register('endTime')} className="pl-10" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Titre spécifique */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre specifique</Label>
                  <Input {...register('title')} placeholder="Ex: Loroux Bottereau" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Sous-titre</Label>
                  <Input
                    {...register('subtitle')}
                    placeholder="Ex: Paroisse Saint Barthelemy..."
                  />
                </div>
              </div>

              {/* Lieu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Lieu</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...register('location')}
                      className="pl-10"
                      placeholder="Ex: Centre paroissial"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationAddress">Adresse</Label>
                  <Input
                    {...register('locationAddress')}
                    placeholder="Ex: 7 rue Porte Saumon - 44430 Le Loroux Bottereau"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  {...register('notes')}
                  placeholder="Notes generales sur cette emission..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== ÉTAPE 2 : ÉQUIPE ========== */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipe de production
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamFields.fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Controller
                      name={`team.${index}.role`}
                      control={control}
                      render={({ field: roleField }) => (
                        <Select value={roleField.value} onValueChange={roleField.onChange}>
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESENTER">Presentateur</SelectItem>
                            <SelectItem value="CO_PRESENTER">Co-presentateur</SelectItem>
                            <SelectItem value="STUDIO_HOST">En studio</SelectItem>
                            <SelectItem value="TECHNICIAN">Technicien</SelectItem>
                            <SelectItem value="JOURNALIST">Journaliste</SelectItem>
                            <SelectItem value="MAIN_GUEST">Invite fil rouge</SelectItem>
                            <SelectItem value="OTHER">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {teamFields.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => teamFields.remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...register(`team.${index}.name`)}
                          className="pl-10"
                          placeholder="Nom complet"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Lieu</Label>
                      <Controller
                        name={`team.${index}.location`}
                        control={control}
                        render={({ field: locField }) => (
                          <Select value={locField.value || ''} onValueChange={locField.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selectionner" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sur place">Sur place</SelectItem>
                              <SelectItem value="en studio">En studio</SelectItem>
                              <SelectItem value="a distance">A distance</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...register(`team.${index}.phone`)}
                          className="pl-10"
                          placeholder="06 XX XX XX XX"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...register(`team.${index}.email`)}
                          className="pl-10"
                          type="email"
                          placeholder="email@exemple.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  teamFields.append({
                    role: 'OTHER',
                    name: '',
                    phone: '',
                    email: '',
                    location: '',
                  })
                }
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un membre d'equipe
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ========== ÉTAPE 3 : CONDUCTEUR ========== */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Elements du conducteur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {itemsFields.fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Radio className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Aucun element dans le conducteur</p>
                  <p className="text-sm">Ajoutez des elements ci-dessous</p>
                </div>
              )}

              {itemsFields.fields.map((field, index) => (
                <RundownItemEditor
                  key={field.id}
                  index={index}
                  control={control}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  onRemove={() => itemsFields.remove(index)}
                />
              ))}

              {/* Boutons d'ajout rapide */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemsFields.append({
                      type: 'JINGLE',
                      title: 'Jingle',
                      duration: 15,
                      startTime: '',
                      notes: '',
                      guests: [],
                    })
                  }
                >
                  <Music className="h-4 w-4 mr-1" />
                  Jingle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemsFields.append({
                      type: 'STORY',
                      title: '',
                      duration: 120,
                      startTime: '',
                      notes: '',
                      guests: [],
                    })
                  }
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Sujet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemsFields.append({
                      type: 'INTERVIEW',
                      title: '',
                      duration: 300,
                      startTime: '',
                      notes: '',
                      guests: [],
                    })
                  }
                >
                  <Mic className="h-4 w-4 mr-1" />
                  Interview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemsFields.append({
                      type: 'BREAK',
                      title: 'Pause pub',
                      duration: 180,
                      startTime: '',
                      notes: '',
                      guests: [],
                    })
                  }
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemsFields.append({
                      type: 'LIVE',
                      title: '',
                      duration: 600,
                      startTime: '',
                      notes: '',
                      guests: [],
                    })
                  }
                >
                  <Radio className="h-4 w-4 mr-1" />
                  Direct
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <div>
            {onClose && step === 1 && (
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
              </Button>
            )}
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            )}
          </div>

          {step < totalSteps ? (
            <Button type="button" onClick={handleNext} disabled={!canProceed()}>
              Continuer
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creation...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Creer le conducteur
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// ============ SOUS-COMPOSANT : ÉDITEUR D'ÉLÉMENT ============

function RundownItemEditor({
  index,
  control,
  register,
  watch,
  setValue,
  onRemove,
}: {
  index: number;
  control: any;
  register: any;
  watch: any;
  setValue: any;
  onRemove: () => void;
}) {
  const guestsField = useFieldArray({
    control,
    name: `items.${index}.guests`,
  });

  const itemType = watch(`items.${index}.type`);
  const showGuests = ['INTERVIEW', 'STORY', 'LIVE'].includes(itemType);

  const typeLabels: Record<string, string> = {
    STORY: 'Sujet',
    INTERVIEW: 'Interview',
    JINGLE: 'Jingle',
    MUSIC: 'Musique',
    LIVE: 'Direct',
    BREAK: 'Pub',
    OTHER: 'Autre',
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header de l'élément */}
      <div className="bg-gray-50 p-3 flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-gray-400" />

        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Controller
            name={`items.${index}.type`}
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JINGLE">Jingle</SelectItem>
                  <SelectItem value="STORY">Sujet</SelectItem>
                  <SelectItem value="INTERVIEW">Interview</SelectItem>
                  <SelectItem value="MUSIC">Musique</SelectItem>
                  <SelectItem value="LIVE">Direct</SelectItem>
                  <SelectItem value="BREAK">Pub</SelectItem>
                  <SelectItem value="OTHER">Autre</SelectItem>
                </SelectContent>
              </Select>
            )}
          />

          <Input
            {...register(`items.${index}.title`)}
            className="flex-1 min-w-[150px] h-8"
            placeholder="Titre de l'element"
          />

          <div className="flex items-center gap-1">
            <Input
              type="number"
              {...register(`items.${index}.duration`, { valueAsNumber: true })}
              className="w-20 h-8 text-right"
              min={0}
            />
            <span className="text-sm text-muted-foreground">sec</span>
          </div>
        </div>

        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {/* Invités (si applicable) */}
      {showGuests && (
        <div className="p-3 bg-white space-y-3">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Star className="h-4 w-4" />
            Invites de cet element
          </div>

          {guestsField.fields.map((guest, guestIndex) => (
            <div key={guest.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Input
                  {...register(`items.${index}.guests.${guestIndex}.name`)}
                  className="flex-1 h-8 font-medium"
                  placeholder="Nom de l'invite"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => guestsField.remove(guestIndex)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="relative">
                  <Phone className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    {...register(`items.${index}.guests.${guestIndex}.phone`)}
                    className="h-8 pl-7 text-sm"
                    placeholder="Telephone"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    {...register(`items.${index}.guests.${guestIndex}.email`)}
                    className="h-8 pl-7 text-sm"
                    type="email"
                    placeholder="Email"
                  />
                </div>
              </div>

              <Input
                {...register(`items.${index}.guests.${guestIndex}.title`)}
                className="h-8 text-sm"
                placeholder="Fonction (ex: Maire, Economiste...)"
              />

              <Textarea
                {...register(`items.${index}.guests.${guestIndex}.description`)}
                className="text-sm min-h-[60px]"
                placeholder="Description / contexte..."
                rows={2}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              guestsField.append({
                name: '',
                phone: '',
                email: '',
                title: '',
                organization: '',
                description: '',
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter un invite
          </Button>
        </div>
      )}
    </div>
  );
}
