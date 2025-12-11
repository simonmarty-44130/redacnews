'use client';

import { useState } from 'react';
import { Link2, Plus, Unlink, Radio, Calendar, FileText, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

// Mode de liaison
type LinkMode = 'existing' | 'create';

interface LinkedRundownInfo {
  id: string;
  status: string;
  show: {
    id: string;
    name: string;
    color: string;
  };
  items: Array<{
    id: string;
    script: string | null;
    googleDocId: string | null;
  }>;
}

interface LinkRundownDialogProps {
  itemId: string;
  itemTitle: string;
  rundownId: string;
  rundownDate: Date;
  linkedRundown?: LinkedRundownInfo | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function LinkRundownDialog({
  itemId,
  itemTitle,
  rundownId,
  rundownDate,
  linkedRundown,
  trigger,
  onSuccess,
}: LinkRundownDialogProps) {
  const [open, setOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<LinkMode>('existing');
  const [selectedRundownId, setSelectedRundownId] = useState<string>('');

  // Pour la creation d'un nouveau conducteur
  const [newShowId, setNewShowId] = useState<string>('');
  const [newDate, setNewDate] = useState(format(rundownDate, 'yyyy-MM-dd'));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Conducteurs disponibles pour liaison
  const { data: availableRundowns } = trpc.rundown.listAvailableForLinking.useQuery(
    { currentRundownId: rundownId, date: rundownDate },
    { enabled: open }
  );

  // Emissions disponibles
  const { data: shows } = trpc.rundown.listShows.useQuery(undefined, {
    enabled: open && linkMode === 'create',
  });

  // Templates disponibles pour l'emission selectionnee
  const { data: templates } = trpc.template.list.useQuery(
    { showId: newShowId || undefined },
    { enabled: !!newShowId && linkMode === 'create' }
  );

  const utils = trpc.useUtils();

  const linkMutation = trpc.rundown.linkRundownToItem.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate();
      utils.script.getAssembled.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
  });

  const createLinkedMutation = trpc.rundown.createLinkedRundown.useMutation({
    onSuccess: () => {
      utils.rundown.get.invalidate();
      utils.rundown.list.invalidate();
      utils.script.getAssembled.invalidate();
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
  });

  const resetForm = () => {
    setLinkMode('existing');
    setSelectedRundownId('');
    setNewShowId('');
    setNewDate(format(rundownDate, 'yyyy-MM-dd'));
    setSelectedTemplateId('');
  };

  const handleSubmit = () => {
    if (linkMode === 'existing' && selectedRundownId) {
      linkMutation.mutate({
        itemId,
        linkedRundownId: selectedRundownId,
      });
    } else if (linkMode === 'create' && newShowId && newDate) {
      createLinkedMutation.mutate({
        parentItemId: itemId,
        showId: newShowId,
        date: new Date(newDate),
        templateId: selectedTemplateId || undefined,
      });
    }
  };

  const handleUnlink = () => {
    linkMutation.mutate({
      itemId,
      linkedRundownId: null,
    });
  };

  const isSubmitting = linkMutation.isPending || createLinkedMutation.isPending;

  // Grouper les conducteurs par emission
  const rundownsByShow = availableRundowns?.reduce((acc, r) => {
    const showId = r.show.id;
    if (!acc[showId]) {
      acc[showId] = {
        show: r.show,
        rundowns: [],
      };
    }
    acc[showId].rundowns.push(r);
    return acc;
  }, {} as Record<string, { show: typeof availableRundowns[0]['show']; rundowns: typeof availableRundowns }>);

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-purple-600">
            <Link2 className="h-4 w-4 mr-1" />
            {linkedRundown ? 'Modifier le lien' : 'Lier un conducteur'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Conducteur imbrique
          </DialogTitle>
          <DialogDescription>
            Liez un autre conducteur a l'element &quot;{itemTitle}&quot;. Le presentateur
            verra les reperes de fin dans son prompteur.
          </DialogDescription>
        </DialogHeader>

        {/* Si deja lie, afficher le lien actuel */}
        {linkedRundown && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: linkedRundown.show.color }}
                />
                <span className="font-medium">{linkedRundown.show.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/conducteur?id=${linkedRundown.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleUnlink}
                  disabled={isSubmitting}
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Supprimer le lien
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Mode de liaison */}
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={linkMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLinkMode('existing')}
              >
                <Link2 className="h-4 w-4 mr-1" />
                Conducteur existant
              </Button>
              <Button
                type="button"
                variant={linkMode === 'create' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLinkMode('create')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Creer un conducteur
              </Button>
            </div>
          </div>

          {/* Mode: Lier un conducteur existant */}
          {linkMode === 'existing' && (
            <div className="space-y-2">
              <Label>Selectionner un conducteur</Label>
              {availableRundowns && availableRundowns.length > 0 ? (
                <Select
                  value={selectedRundownId}
                  onValueChange={setSelectedRundownId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un conducteur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rundownsByShow &&
                      Object.values(rundownsByShow).map(({ show, rundowns }) => (
                        <div key={show.id}>
                          <div className="px-2 py-1.5 text-xs font-medium text-gray-500 flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: show.color }}
                            />
                            {show.name}
                          </div>
                          {rundowns.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {format(new Date(r.date), 'EEE d MMM', { locale: fr })}
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                  Aucun conducteur disponible pour liaison (meme date +/- 1 jour).
                  Creez-en un nouveau.
                </p>
              )}
            </div>
          )}

          {/* Mode: Creer un nouveau conducteur */}
          {linkMode === 'create' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Emission</Label>
                <Select value={newShowId} onValueChange={(v) => {
                  setNewShowId(v);
                  setSelectedTemplateId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une emission..." />
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
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {newShowId && templates && templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Modele (optionnel)</Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={setSelectedTemplateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Conducteur vide" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <span className="text-gray-500">Conducteur vide</span>
                      </SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            {t.name}
                            {t.isDefault && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Defaut
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
            type="button"
            disabled={
              isSubmitting ||
              (linkMode === 'existing' && !selectedRundownId) ||
              (linkMode === 'create' && (!newShowId || !newDate))
            }
            onClick={handleSubmit}
          >
            {isSubmitting
              ? 'En cours...'
              : linkMode === 'existing'
              ? 'Lier'
              : 'Creer et lier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
