'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  POLITICAL_FAMILIES,
  ELECTION_TYPES,
  type PoliticalFamilyCode,
  type ElectionTypeCode,
  formatDuration,
} from '@/lib/politics/config';
import { PoliticalBadge } from './PoliticalBadge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface SelectedTag {
  politicalTagId: string;
  speakingTime?: number;
  isMainSubject: boolean;
}

interface PoliticalTagSelectorProps {
  storyId: string;
  electionType?: ElectionTypeCode | null;
  onElectionTypeChange?: (type: ElectionTypeCode | null) => void;
  className?: string;
  /** Durée estimée de lecture du sujet (en secondes) */
  estimatedDuration?: number | null;
}

export function PoliticalTagSelector({
  storyId,
  electionType,
  onElectionTypeChange,
  className,
  estimatedDuration,
}: PoliticalTagSelectorProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<PoliticalFamilyCode | ''>('');
  const [newTagData, setNewTagData] = useState({
    partyName: '',
    candidateName: '',
    constituency: '',
    electionYear: new Date().getFullYear(),
  });
  const [isMainSubject, setIsMainSubject] = useState(false);

  const utils = trpc.useUtils();

  // Charger les tags existants de l'organisation
  const { data: availableTags, isLoading: loadingTags } = trpc.politics.listTags.useQuery({
    electionType: electionType || undefined,
  });

  // Charger les tags associés au sujet
  const { data: storyTags, isLoading: loadingStoryTags } = trpc.politics.getStoryTags.useQuery({
    storyId,
  });

  // Charger les médias attachés au sujet pour calculer la durée
  const { data: storyMedia } = trpc.storyMedia.listByStory.useQuery(
    { storyId },
    { enabled: !!storyId }
  );

  // Calculer le temps de parole automatique
  // Priorité : durée totale des sons attachés > durée estimée de lecture
  const autoSpeakingTime = useMemo(() => {
    // Calculer la durée totale des sons attachés
    const audioMedia = storyMedia?.filter((m) => m.mediaItem.type === 'AUDIO') || [];
    const totalAudioDuration = audioMedia.reduce((sum, m) => sum + (m.mediaItem.duration || 0), 0);

    if (totalAudioDuration > 0) {
      return totalAudioDuration;
    }

    // Sinon utiliser la durée estimée de lecture du sujet
    return estimatedDuration || 0;
  }, [storyMedia, estimatedDuration]);

  // Mutations
  const createTag = trpc.politics.createTag.useMutation({
    onSuccess: () => {
      utils.politics.listTags.invalidate();
      setShowCreateDialog(false);
      resetNewTagForm();
    },
  });

  const tagStory = trpc.politics.tagStory.useMutation({
    onSuccess: () => {
      utils.politics.getStoryTags.invalidate({ storyId });
      setIsMainSubject(false);
    },
  });

  const untagStory = trpc.politics.untagStory.useMutation({
    onSuccess: () => {
      utils.politics.getStoryTags.invalidate({ storyId });
    },
  });

  const setElectionType = trpc.politics.setStoryElectionType.useMutation({
    onSuccess: () => {
      onElectionTypeChange?.(electionType || null);
    },
  });

  const resetNewTagForm = () => {
    setSelectedFamily('');
    setNewTagData({
      partyName: '',
      candidateName: '',
      constituency: '',
      electionYear: new Date().getFullYear(),
    });
  };

  // Grouper les tags disponibles par famille
  const tagsByFamily = useMemo(() => {
    if (!availableTags) return {};

    const grouped: Record<string, typeof availableTags> = {};
    for (const tag of availableTags) {
      if (!grouped[tag.family]) {
        grouped[tag.family] = [];
      }
      grouped[tag.family].push(tag);
    }
    return grouped;
  }, [availableTags]);

  // IDs des tags déjà associés
  const associatedTagIds = useMemo(() => {
    return new Set(storyTags?.map((st) => st.politicalTagId) || []);
  }, [storyTags]);

  const handleAddTag = (tagId: string) => {
    tagStory.mutate({
      storyId,
      politicalTagId: tagId,
      speakingTime: autoSpeakingTime > 0 ? autoSpeakingTime : undefined,
      isMainSubject,
    });
  };

  const handleRemoveTag = (tagId: string) => {
    untagStory.mutate({
      storyId,
      politicalTagId: tagId,
    });
  };

  const handleCreateTag = () => {
    if (!selectedFamily) return;

    createTag.mutate({
      family: selectedFamily as PoliticalFamilyCode,
      partyName: newTagData.partyName || undefined,
      candidateName: newTagData.candidateName || undefined,
      constituency: newTagData.constituency || undefined,
      electionType: electionType || undefined,
      electionYear: newTagData.electionYear,
    });
  };

  const handleElectionTypeChange = (value: string) => {
    const newType = value === 'none' ? null : (value as ElectionTypeCode);
    setElectionType.mutate({
      storyId,
      electionType: newType,
    });
    onElectionTypeChange?.(newType);
  };

  if (loadingTags || loadingStoryTags) {
    return <div className="text-sm text-gray-500">Chargement...</div>;
  }

  return (
    <div className={className}>
      {/* Type d'élection */}
      <div className="mb-4">
        <Label className="text-sm font-medium mb-2 block">Type d'élection</Label>
        <Select
          value={electionType || 'none'}
          onValueChange={handleElectionTypeChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sélectionner le type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun / Non électoral</SelectItem>
            {Object.entries(ELECTION_TYPES).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.icon} {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags politiques associés */}
      <div className="mb-4">
        <Label className="text-sm font-medium mb-2 block">
          Étiquettes politiques ({storyTags?.length || 0})
        </Label>

        {storyTags && storyTags.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {storyTags.map((st) => (
              <PoliticalBadge
                key={st.id}
                family={st.politicalTag.family as PoliticalFamilyCode}
                partyName={st.politicalTag.partyName}
                candidateName={st.politicalTag.candidateName}
                speakingTime={st.speakingTime}
                onRemove={() => handleRemoveTag(st.politicalTagId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">
            Aucune étiquette politique associée
          </p>
        )}
      </div>

      {/* Ajouter un tag existant */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <Label className="text-sm font-medium mb-2 block">Ajouter une étiquette</Label>

        {/* Temps de parole automatique */}
        <div className="flex items-center justify-between mb-3 p-2 bg-white rounded border">
          <div className="text-sm">
            <span className="text-gray-500">Temps de parole : </span>
            <span className="font-medium">
              {autoSpeakingTime > 0 ? formatDuration(autoSpeakingTime) : '--:--'}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              {storyMedia?.some((m) => m.mediaItem.type === 'AUDIO')
                ? '(durée des sons)'
                : '(durée de lecture)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isMainSubject"
              checked={isMainSubject}
              onCheckedChange={(checked) => setIsMainSubject(checked === true)}
            />
            <Label htmlFor="isMainSubject" className="text-sm cursor-pointer">
              Sujet principal
            </Label>
          </div>
        </div>

        {/* Liste des tags par famille */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {Object.entries(POLITICAL_FAMILIES).map(([familyCode, familyConfig]) => {
            const familyTags = tagsByFamily[familyCode] || [];
            const availableForSelection = familyTags.filter(
              (t) => !associatedTagIds.has(t.id)
            );

            if (availableForSelection.length === 0 && familyTags.length > 0) {
              return null; // Tous les tags de cette famille sont déjà associés
            }

            return (
              <div key={familyCode} className="flex flex-wrap items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: familyConfig.color }}
                />
                <span className="text-xs text-gray-600 w-20">
                  {familyConfig.shortLabel}:
                </span>
                {availableForSelection.length > 0 ? (
                  availableForSelection.map((tag) => (
                    <Button
                      key={tag.id}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => handleAddTag(tag.id)}
                      disabled={tagStory.isPending}
                    >
                      {tag.partyName || tag.candidateName || familyConfig.shortLabel}
                    </Button>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Créer un nouveau tag */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-3 w-full">
              + Créer une nouvelle étiquette
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle étiquette politique</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Famille politique *</Label>
                <Select
                  value={selectedFamily}
                  onValueChange={(v) => setSelectedFamily(v as PoliticalFamilyCode)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une famille" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POLITICAL_FAMILIES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Parti politique</Label>
                <Input
                  placeholder="Ex: Renaissance, LR, PS..."
                  value={newTagData.partyName}
                  onChange={(e) =>
                    setNewTagData({ ...newTagData, partyName: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Nom du candidat</Label>
                <Input
                  placeholder="Ex: Jean Dupont"
                  value={newTagData.candidateName}
                  onChange={(e) =>
                    setNewTagData({ ...newTagData, candidateName: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Circonscription / Commune</Label>
                <Input
                  placeholder="Ex: Nantes, 3ème circo Loire-Atlantique"
                  value={newTagData.constituency}
                  onChange={(e) =>
                    setNewTagData({ ...newTagData, constituency: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Année électorale</Label>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={newTagData.electionYear}
                  onChange={(e) =>
                    setNewTagData({
                      ...newTagData,
                      electionYear: parseInt(e.target.value, 10) || new Date().getFullYear(),
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetNewTagForm();
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateTag}
                  disabled={!selectedFamily || createTag.isPending}
                >
                  {createTag.isPending ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
