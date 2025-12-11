'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Radio, Palette, FileText, Clock, Copy } from 'lucide-react';
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

  // Initialiser les variables du template quand il change
  useEffect(() => {
    if (selectedTemplate?.variables) {
      const vars = selectedTemplate.variables as unknown as TemplateVariable[];
      const initialValues: Record<string, string> = {};
      vars.forEach((v) => {
        initialValues[v.name] = v.defaultValue || '';
      });
      setTemplateVariables(initialValues);
    } else {
      setTemplateVariables({});
    }
  }, [selectedTemplate]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showId || !date) return;

    // Création depuis un template
    if (creationMode === 'template' && selectedTemplateId) {
      createFromTemplate.mutate({
        templateId: selectedTemplateId,
        date: new Date(date),
        variables: templateVariables,
      });
    } else {
      // Création d'un conducteur vide
      createRundown.mutate({
        showId,
        date: new Date(date),
      });
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        {!isCreatingShow ? (
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
                {isSubmitting ? 'Création...' : 'Créer le conducteur'}
              </Button>
            </DialogFooter>
          </form>
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
