'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Calendar, Radio, Palette, FileText, Clock, Copy, ArrowRight, ArrowLeft, Check, Search } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

// Type pour les variables de template
interface TemplateVariable {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}

// Mode de création du conducteur
type CreationMode = 'empty' | 'template' | 'duplicate';

interface CreateRundownDialogProps {
  onSuccess?: (rundownId: string) => void;
}

// Couleurs prédéfinies pour les émissions
const SHOW_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

// Catégories d'émissions
const SHOW_CATEGORIES = [
  { value: 'FLASH', label: 'Flash info (1-3 min)' },
  { value: 'JOURNAL', label: 'Journal (6-12 min)' },
  { value: 'MAGAZINE', label: 'Magazine (1-2h)' },
  { value: 'CHRONIQUE', label: 'Chronique' },
  { value: 'AUTRE', label: 'Autre' },
];

export function CreateRundownDialog({ onSuccess }: CreateRundownDialogProps) {
  const [open, setOpen] = useState(false);
  const [showId, setShowId] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Mode de création : vide, depuis template, ou duplication
  const [creationMode, setCreationMode] = useState<CreationMode>('empty');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // Étape de sélection des sujets existants
  const [step, setStep] = useState<'main' | 'selectStories'>('main');
  const [selectedStories, setSelectedStories] = useState<Record<string, string>>({}); // templateItemId -> storyId
  const [storySearch, setStorySearch] = useState('');

  // État pour la création d'une nouvelle émission
  const [isCreatingShow, setIsCreatingShow] = useState(false);
  const [newShowName, setNewShowName] = useState('');
  const [newShowDescription, setNewShowDescription] = useState('');
  const [newShowDuration, setNewShowDuration] = useState(60);
  const [newShowColor, setNewShowColor] = useState(SHOW_COLORS[0]);
  const [newShowCategory, setNewShowCategory] = useState<string>('MAGAZINE');
  const [newShowStartTime, setNewShowStartTime] = useState('12:00'); // Heure de début par défaut

  const { data: shows, refetch: refetchShows } = trpc.rundown.listShows.useQuery();

  // Templates disponibles (filtrés par émission sélectionnée)
  const { data: templates } = trpc.template.list.useQuery(
    { showId: showId || undefined },
    { enabled: !!showId }
  );

  // Template sélectionné avec ses détails
  const { data: selectedTemplate } = trpc.template.get.useQuery(
    { id: selectedTemplateId },
    { enabled: !!selectedTemplateId }
  );

  // Liste des sujets disponibles pour la sélection (statuts non-archivés)
  const { data: availableStories } = trpc.story.list.useQuery(
    {},
    { enabled: step === 'selectStories' }
  );

  // Identifier les items de type STORY dans le template
  const storyItems = useMemo(() => {
    if (!selectedTemplate?.items) return [];
    return selectedTemplate.items.filter((item) => item.type === 'STORY');
  }, [selectedTemplate]);

  // Vérifier si le template a des sujets à configurer
  const hasStoryItems = storyItems.length > 0;

  // Filtrer les sujets disponibles par la recherche
  const filteredStories = useMemo(() => {
    if (!availableStories) return [];
    if (!storySearch.trim()) return availableStories;
    const search = storySearch.toLowerCase();
    return availableStories.filter(
      (story) =>
        story.title.toLowerCase().includes(search) ||
        story.category?.toLowerCase().includes(search)
    );
  }, [availableStories, storySearch]);

  // Ref pour tracker le dernier templateId pour lequel on a initialisé les variables
  const lastInitializedTemplateIdRef = useRef<string>('');
  // Ref pour tracker si les variables ont déjà été initialisées pour ce template
  const variablesInitializedRef = useRef<boolean>(false);

  // Initialiser les variables du template UNIQUEMENT quand l'ID du template change
  // Ne pas réinitialiser lors d'un refetch ou retour sur l'onglet
  useEffect(() => {
    // Si on a désélectionné le template, réinitialiser les refs
    if (!selectedTemplateId) {
      lastInitializedTemplateIdRef.current = '';
      variablesInitializedRef.current = false;
      // Ne pas effacer templateVariables ici pour éviter de perdre les données
      // si c'est juste un re-render temporaire
      return;
    }

    // Si c'est un NOUVEAU template (ID différent), initialiser les variables
    if (selectedTemplateId !== lastInitializedTemplateIdRef.current) {
      // Marquer qu'on a changé de template, mais attendre les données
      lastInitializedTemplateIdRef.current = selectedTemplateId;
      variablesInitializedRef.current = false;
    }

    // Initialiser les variables seulement si:
    // 1. On n'a pas encore initialisé pour ce template
    // 2. On a les données du template
    if (!variablesInitializedRef.current && selectedTemplate?.variables) {
      const vars = selectedTemplate.variables as unknown as TemplateVariable[];
      const initialValues: Record<string, string> = {};
      vars.forEach((v) => {
        initialValues[v.name] = v.defaultValue || '';
      });
      setTemplateVariables(initialValues);
      variablesInitializedRef.current = true;
    }
  }, [selectedTemplateId, selectedTemplate]);

  // Réinitialiser le template quand l'émission change
  useEffect(() => {
    setSelectedTemplateId('');
    setCreationMode('empty');
  }, [showId]);

  const utils = trpc.useUtils();
  
  const createShow = trpc.rundown.createShow.useMutation({
    onSuccess: (data) => {
      // Rafraîchir la liste des émissions et sélectionner la nouvelle
      refetchShows().then(() => {
        setShowId(data.id);
        setIsCreatingShow(false);
        resetShowForm();
      });
    },
  });

  const createRundown = trpc.rundown.create.useMutation({
    onSuccess: (data) => {
      utils.rundown.list.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.(data.id);
    },
  });

  const createFromTemplate = trpc.template.createRundownFromTemplate.useMutation({
    onSuccess: (data) => {
      utils.rundown.list.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.(data.id);
    },
  });

  const resetShowForm = () => {
    setNewShowName('');
    setNewShowDescription('');
    setNewShowDuration(60);
    setNewShowColor(SHOW_COLORS[0]);
    setNewShowCategory('MAGAZINE');
    setNewShowStartTime('12:00');
  };

  const resetForm = () => {
    setShowId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setCreationMode('empty');
    setSelectedTemplateId('');
    setTemplateVariables({});
    setIsCreatingShow(false);
    setStep('main');
    setSelectedStories({});
    setStorySearch('');
    // Réinitialiser les refs pour permettre une nouvelle initialisation
    lastInitializedTemplateIdRef.current = '';
    variablesInitializedRef.current = false;
    resetShowForm();
  };

  const handleCreateShow = () => {
    if (!newShowName.trim()) return;

    createShow.mutate({
      name: newShowName.trim(),
      description: newShowDescription.trim() || undefined,
      defaultDuration: newShowDuration,
      color: newShowColor,
      category: newShowCategory as 'FLASH' | 'JOURNAL' | 'MAGAZINE' | 'CHRONIQUE' | 'AUTRE',
      startTime: newShowStartTime,
    });
  };

  const handleNextStep = () => {
    // Si template avec des sujets et mode template, aller à l'étape de sélection
    if (creationMode === 'template' && selectedTemplateId && hasStoryItems) {
      setStep('selectStories');
    } else {
      // Sinon, créer directement
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = () => {
    if (!showId || !date) return;

    // Création depuis un template
    if (creationMode === 'template' && selectedTemplateId) {
      createFromTemplate.mutate({
        templateId: selectedTemplateId,
        date: new Date(date),
        variables: templateVariables,
        existingStories: Object.keys(selectedStories).length > 0 ? selectedStories : undefined,
      });
    } else {
      // Création d'un conducteur vide
      createRundown.mutate({
        showId,
        date: new Date(date),
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'main') {
      handleNextStep();
    } else {
      handleFinalSubmit();
    }
  };

  // Formater la durée en heures et minutes
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes} min`;
  };

  const isSubmitting = createRundown.isPending || createFromTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau conducteur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        {!isCreatingShow && step === 'main' ? (
          // Formulaire de création de conducteur
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <DialogTitle>Créer un conducteur</DialogTitle>
              <DialogDescription>
                Sélectionnez une émission et une date pour créer un nouveau conducteur.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 overflow-y-auto flex-1">
              <div className="grid gap-2">
                <Label htmlFor="show">Émission</Label>
                <Select value={showId} onValueChange={setShowId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une émission" />
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
                    {/* Option pour créer une nouvelle émission */}
                    <div className="border-t my-1" />
                    <button
                      type="button"
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-blue-600"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsCreatingShow(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer une nouvelle émission
                    </button>
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

              {/* Options de création */}
              {showId && (
                <div className="space-y-3 pt-2 border-t">
                  <Label>Mode de création</Label>
                  <div className="space-y-2">
                    {/* Option conducteur vide */}
                    <label
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        creationMode === 'empty'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="creationMode"
                        checked={creationMode === 'empty'}
                        onChange={() => {
                          setCreationMode('empty');
                          setSelectedTemplateId('');
                        }}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                          creationMode === 'empty'
                            ? 'border-blue-500'
                            : 'border-gray-300'
                        )}
                      >
                        {creationMode === 'empty' && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Conducteur vide</div>
                        <div className="text-sm text-gray-500">
                          Créer un conducteur sans éléments pré-remplis
                        </div>
                      </div>
                    </label>

                    {/* Option depuis un modèle */}
                    <label
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        creationMode === 'template'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300',
                        !templates?.length && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <input
                        type="radio"
                        name="creationMode"
                        checked={creationMode === 'template'}
                        onChange={() => setCreationMode('template')}
                        disabled={!templates?.length}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center mt-1',
                          creationMode === 'template'
                            ? 'border-blue-500'
                            : 'border-gray-300'
                        )}
                      >
                        {creationMode === 'template' && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Depuis un modèle
                        </div>
                        <div className="text-sm text-gray-500">
                          {templates?.length
                            ? 'Utiliser un modèle pré-configuré avec des éléments'
                            : 'Aucun modèle disponible pour cette émission'}
                        </div>
                      </div>
                    </label>

                    {/* Sélection du template et variables */}
                    {creationMode === 'template' && templates && templates.length > 0 && (
                      <div className="ml-7 space-y-3">
                        <Select
                          value={selectedTemplateId}
                          onValueChange={setSelectedTemplateId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un modèle" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                  <span>{template.name}</span>
                                  {template.isDefault && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                      Par défaut
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Infos du template sélectionné */}
                        {selectedTemplate && (
                          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                {selectedTemplate.items.length} éléments
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatDuration(selectedTemplate.totalDuration)}
                              </span>
                            </div>

                            {selectedTemplate.description && (
                              <p className="text-sm text-gray-500">
                                {selectedTemplate.description}
                              </p>
                            )}

                            {/* Variables à remplir */}
                            {selectedTemplate.variables &&
                              (selectedTemplate.variables as unknown as TemplateVariable[]).length > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                  <Label className="text-sm font-medium">
                                    Variables à remplir
                                  </Label>
                                  {(selectedTemplate.variables as unknown as TemplateVariable[]).map(
                                    (variable) => (
                                      <div key={variable.name} className="grid gap-1">
                                        <Label
                                          htmlFor={`var-${variable.name}`}
                                          className="text-sm text-gray-600"
                                        >
                                          {variable.label}
                                          {variable.required && (
                                            <span className="text-red-500 ml-1">*</span>
                                          )}
                                        </Label>
                                        <Input
                                          id={`var-${variable.name}`}
                                          value={templateVariables[variable.name] || ''}
                                          onChange={(e) =>
                                            setTemplateVariables((prev) => ({
                                              ...prev,
                                              [variable.name]: e.target.value,
                                            }))
                                          }
                                          placeholder={variable.defaultValue || ''}
                                          className="h-8"
                                        />
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                disabled={
                  !showId ||
                  !date ||
                  isSubmitting ||
                  (creationMode === 'template' && !selectedTemplateId)
                }
              >
                {isSubmitting ? 'Création...' : (
                  creationMode === 'template' && hasStoryItems ? (
                    <>
                      Suivant
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : 'Créer le conducteur'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : !isCreatingShow && step === 'selectStories' ? (
          // Étape de sélection des sujets existants
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Associer des sujets existants
              </DialogTitle>
              <DialogDescription>
                Sélectionnez des sujets de la bibliothèque pour les emplacements du conducteur.
                Laissez vide pour créer de nouveaux sujets.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Barre de recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un sujet..."
                  value={storySearch}
                  onChange={(e) => setStorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Liste des emplacements à remplir - hauteur fixe avec scroll */}
              <div className="h-[300px] overflow-y-auto border rounded-lg p-2 space-y-3">
                {storyItems.map((templateItem) => {
                  const selectedStoryId = selectedStories[templateItem.id];
                  const selectedStory = availableStories?.find(s => s.id === selectedStoryId);

                  return (
                    <div key={templateItem.id} className="border rounded-lg p-3 space-y-2 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{templateItem.title}</div>
                        <Badge variant="outline" className="text-xs">
                          {Math.floor(templateItem.duration / 60)}:{(templateItem.duration % 60).toString().padStart(2, '0')}
                        </Badge>
                      </div>

                      {selectedStory ? (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">{selectedStory.title}</span>
                            {selectedStory.category && (
                              <Badge variant="secondary" className="text-xs">{selectedStory.category}</Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newSelected = { ...selectedStories };
                              delete newSelected[templateItem.id];
                              setSelectedStories(newSelected);
                            }}
                            className="h-7 text-xs text-gray-500 hover:text-red-600"
                          >
                            Retirer
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value=""
                          onValueChange={(storyId) => {
                            setSelectedStories(prev => ({
                              ...prev,
                              [templateItem.id]: storyId
                            }));
                          }}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Nouveau sujet (par défaut) ou sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredStories.map((story) => (
                              <SelectItem key={story.id} value={story.id}>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                  <span>{story.title}</span>
                                  {story.category && (
                                    <span className="text-xs text-gray-500">({story.category})</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                            {filteredStories.length === 0 && (
                              <div className="p-2 text-sm text-gray-500 text-center">
                                Aucun sujet trouvé
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Résumé */}
              <div className="text-sm text-gray-600 border-t pt-3">
                <span className="font-medium">{Object.keys(selectedStories).length}</span> sujet(s) existant(s) sélectionné(s) sur{' '}
                <span className="font-medium">{storyItems.length}</span> emplacement(s).
                Les autres seront créés automatiquement.
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('main');
                  setStorySearch('');
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
              >
                {isSubmitting ? 'Création...' : 'Créer le conducteur'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Formulaire de création d'émission
          <div>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Nouvelle émission
              </DialogTitle>
              <DialogDescription>
                Créez un modèle d'émission réutilisable pour vos conducteurs.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="showName">Nom de l'émission *</Label>
                <Input
                  id="showName"
                  placeholder="Ex: Flash Info 7h, Tour des Clochers..."
                  value={newShowName}
                  onChange={(e) => setNewShowName(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="showDescription">Description</Label>
                <Textarea
                  id="showDescription"
                  placeholder="Description de l'émission (optionnel)"
                  value={newShowDescription}
                  onChange={(e) => setNewShowDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="showCategory">Type</Label>
                  <Select value={newShowCategory} onValueChange={setNewShowCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOW_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="showDuration">Durée (minutes)</Label>
                  <Input
                    id="showDuration"
                    type="number"
                    min={1}
                    max={240}
                    value={newShowDuration}
                    onChange={(e) => setNewShowDuration(parseInt(e.target.value) || 60)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="showStartTime" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Heure de début
                </Label>
                <Input
                  id="showStartTime"
                  type="time"
                  value={newShowStartTime}
                  onChange={(e) => setNewShowStartTime(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Heure de début par défaut pour les conducteurs de cette émission
                </p>
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Couleur
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {SHOW_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        newShowColor === color
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewShowColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreatingShow(false);
                  resetShowForm();
                }}
              >
                Retour
              </Button>
              <Button
                type="button"
                disabled={!newShowName.trim() || createShow.isPending}
                onClick={handleCreateShow}
              >
                {createShow.isPending ? 'Création...' : 'Créer l\'émission'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
