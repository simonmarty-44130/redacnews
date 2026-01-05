'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addSeconds, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  Save,
  Download,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Volume2,
  X,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

interface RundownItemData {
  id: string;
  type: 'STORY' | 'INTERVIEW' | 'JINGLE' | 'MUSIC' | 'LIVE' | 'BREAK' | 'OTHER';
  title: string;
  duration: number;
  position: number;
  script?: string | null;
  googleDocId?: string | null;
  notes?: string | null;
}

interface FullScriptEditorProps {
  rundownId: string;
  showName: string;
  rundownDate: Date;
  startTime: string;
  items: RundownItemData[];
  onClose: () => void;
  onScriptsSaved?: () => void;
}

const typeConfig = {
  STORY: { label: 'Sujet', color: 'bg-blue-100 text-blue-700' },
  INTERVIEW: { label: 'Interview', color: 'bg-purple-100 text-purple-700' },
  JINGLE: { label: 'Jingle', color: 'bg-orange-100 text-orange-700' },
  MUSIC: { label: 'Musique', color: 'bg-pink-100 text-pink-700' },
  LIVE: { label: 'Direct', color: 'bg-red-100 text-red-700' },
  BREAK: { label: 'Pause', color: 'bg-gray-100 text-gray-700' },
  OTHER: { label: 'Autre', color: 'bg-gray-100 text-gray-700' },
};

// Types qui ont un script éditable
const EDITABLE_TYPES = ['STORY', 'INTERVIEW', 'LIVE', 'OTHER'];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ScriptSection {
  itemId: string;
  title: string;
  type: RundownItemData['type'];
  duration: number;
  originalDuration: number;
  startTime: string;
  originalScript: string;
  editedScript: string;
  isEditable: boolean;
  isExpanded: boolean;
  hasChanges: boolean;
  hasDurationChanges: boolean;
  isEditingDuration: boolean;
}

export function FullScriptEditor({
  rundownId,
  showName,
  rundownDate,
  startTime,
  items,
  onClose,
  onScriptsSaved,
}: FullScriptEditorProps) {
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandAll, setExpandAll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const utils = trpc.useUtils();

  // Mutation pour mettre à jour un item
  const updateItem = trpc.rundown.updateItem.useMutation();

  // Générer le script Google Doc
  const generateScript = trpc.rundown.generateScript.useMutation({
    onSuccess: (data) => {
      if (data.scriptDocUrl) {
        window.open(data.scriptDocUrl, '_blank');
        toast.success('Script exporté vers Google Doc');
      }
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Gestion du raccourci clavier Escape pour quitter le plein écran
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Initialiser les sections depuis les items
  useEffect(() => {
    const baseTime = parse(startTime || '12:00', 'HH:mm', new Date());
    let currentTime = baseTime;

    const initialSections: ScriptSection[] = items.map((item) => {
      const sectionStartTime = format(currentTime, 'HH:mm:ss');
      currentTime = addSeconds(currentTime, item.duration);

      return {
        itemId: item.id,
        title: item.title,
        type: item.type,
        duration: item.duration,
        originalDuration: item.duration,
        startTime: sectionStartTime,
        originalScript: item.script || '',
        editedScript: item.script || '',
        isEditable: EDITABLE_TYPES.includes(item.type),
        isExpanded: EDITABLE_TYPES.includes(item.type),
        hasChanges: false,
        hasDurationChanges: false,
        isEditingDuration: false,
      };
    });

    setSections(initialSections);
  }, [items, startTime]);

  // Calculer si il y a des changements non sauvegardés
  const hasUnsavedChanges = useMemo(() => {
    return sections.some((s) => s.hasChanges || s.hasDurationChanges);
  }, [sections]);

  // Nombre de sections modifiées
  const changedCount = useMemo(() => {
    return sections.filter((s) => s.hasChanges || s.hasDurationChanges).length;
  }, [sections]);

  // Recalculer les heures de passage quand les durées changent
  const recalculateStartTimes = useCallback((updatedSections: ScriptSection[]) => {
    const baseTime = parse(startTime || '12:00', 'HH:mm', new Date());
    let currentTime = baseTime;

    return updatedSections.map((section) => {
      const sectionStartTime = format(currentTime, 'HH:mm:ss');
      currentTime = addSeconds(currentTime, section.duration);
      return { ...section, startTime: sectionStartTime };
    });
  }, [startTime]);

  // Mettre à jour le script d'une section
  const handleScriptChange = useCallback((itemId: string, newScript: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.itemId === itemId) {
          return {
            ...s,
            editedScript: newScript,
            hasChanges: newScript !== s.originalScript,
          };
        }
        return s;
      })
    );
  }, []);

  // Toggle expand/collapse d'une section
  const toggleSection = useCallback((itemId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.itemId === itemId) {
          return { ...s, isExpanded: !s.isExpanded };
        }
        return s;
      })
    );
  }, []);

  // Expand/collapse all
  const handleToggleAll = useCallback(() => {
    setExpandAll((prev) => !prev);
    setSections((prev) =>
      prev.map((s) => ({ ...s, isExpanded: s.isEditable ? !expandAll : s.isExpanded }))
    );
  }, [expandAll]);

  // Commencer l'édition de durée
  const handleStartEditDuration = useCallback((itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        isEditingDuration: s.itemId === itemId,
      }))
    );
  }, []);

  // Mettre à jour la durée d'une section
  const handleDurationChange = useCallback((itemId: string, newDuration: number) => {
    setSections((prev) => {
      const updated = prev.map((s) => {
        if (s.itemId === itemId) {
          return {
            ...s,
            duration: newDuration,
            hasDurationChanges: newDuration !== s.originalDuration,
          };
        }
        return s;
      });
      return recalculateStartTimes(updated);
    });
  }, [recalculateStartTimes]);

  // Valider l'édition de durée
  const handleConfirmDuration = useCallback((itemId: string) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        isEditingDuration: false,
      }))
    );
  }, []);

  // Annuler l'édition de durée
  const handleCancelDuration = useCallback((itemId: string) => {
    setSections((prev) => {
      const updated = prev.map((s) => {
        if (s.itemId === itemId) {
          return {
            ...s,
            duration: s.originalDuration,
            hasDurationChanges: false,
            isEditingDuration: false,
          };
        }
        return { ...s, isEditingDuration: false };
      });
      return recalculateStartTimes(updated);
    });
  }, [recalculateStartTimes]);

  // Sauvegarder toutes les modifications
  const handleSaveAll = async () => {
    const changedSections = sections.filter((s) => s.hasChanges || s.hasDurationChanges);
    if (changedSections.length === 0) {
      toast.info('Aucune modification à sauvegarder');
      return;
    }

    setIsSaving(true);
    setSaveResult(null);

    try {
      // Sauvegarder chaque section modifiée (script et/ou durée)
      const promises = changedSections.map((section) =>
        updateItem.mutateAsync({
          id: section.itemId,
          ...(section.hasChanges && { script: section.editedScript }),
          ...(section.hasDurationChanges && { duration: section.duration }),
        })
      );

      await Promise.all(promises);

      // Mettre à jour l'état local
      setSections((prev) =>
        prev.map((s) => {
          if (s.hasChanges || s.hasDurationChanges) {
            return {
              ...s,
              originalScript: s.editedScript,
              originalDuration: s.duration,
              hasChanges: false,
              hasDurationChanges: false,
            };
          }
          return s;
        })
      );

      setSaveResult({
        success: true,
        message: `${changedSections.length} section(s) sauvegardée(s)`,
      });

      // Invalider le cache pour rafraîchir le conducteur
      utils.rundown.get.invalidate({ id: rundownId });
      onScriptsSaved?.();

      toast.success(`${changedSections.length} section(s) sauvegardée(s)`);
    } catch (error) {
      console.error('Save error:', error);
      setSaveResult({
        success: false,
        message: 'Erreur lors de la sauvegarde',
      });
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // Exporter vers Google Doc
  const handleExportToDoc = async () => {
    // Si des changements non sauvegardés, proposer de sauvegarder d'abord
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Des modifications ne sont pas sauvegardées. Voulez-vous sauvegarder avant d\'exporter ?'
      );
      if (confirmed) {
        await handleSaveAll();
      }
    }

    generateScript.mutate({ rundownId, regenerate: true });
  };

  // Auto-resize textarea
  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null, itemId: string) => {
    if (el) {
      textareaRefs.current.set(itemId, el);
      // Auto-resize
      el.style.height = 'auto';
      el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    }
  }, []);

  // Resize on input
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>, itemId: string) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    handleScriptChange(itemId, el.value);
  }, [handleScriptChange]);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'flex flex-col p-0 transition-all duration-200',
          isFullscreen
            ? 'max-w-none w-screen h-screen rounded-none'
            : 'max-w-4xl h-[90vh]'
        )}
      >
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Script complet - {showName}
            </DialogTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="h-8 w-8"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DialogDescription>
            {format(rundownDate, 'EEEE d MMMM yyyy', { locale: fr })}
            {' • '}
            Éditer les scripts de chaque élément puis exporter vers Google Doc
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleAll}
            >
              {expandAll ? 'Tout replier' : 'Tout déplier'}
            </Button>

            {hasUnsavedChanges && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {changedCount} modification(s) non sauvegardée(s)
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAll}
                    disabled={isSaving || !hasUnsavedChanges}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Sauvegarder
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Sauvegarder les modifications vers les éléments du conducteur
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={handleExportToDoc}
                    disabled={generateScript.isPending}
                  >
                    {generateScript.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exporter Google Doc
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Générer/Régénérer le script complet dans Google Docs
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Save result message */}
        {saveResult && (
          <div
            className={cn(
              'mx-6 mt-3 p-3 rounded-lg flex items-center gap-2',
              saveResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            )}
          >
            {saveResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {saveResult.message}
          </div>
        )}

        {/* Script sections */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-4">
            {sections.map((section, index) => (
              <div
                key={section.itemId}
                className={cn(
                  'border rounded-lg overflow-hidden',
                  (section.hasChanges || section.hasDurationChanges) && 'ring-2 ring-orange-300',
                  !section.isEditable && 'bg-gray-50'
                )}
              >
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.itemId)}
                  className={cn(
                    'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors',
                    !section.isEditable && 'cursor-default'
                  )}
                >
                  {section.isEditable ? (
                    section.isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )
                  ) : (
                    <Volume2 className="h-4 w-4 text-gray-400" />
                  )}

                  <span className="font-mono text-sm text-gray-500 w-16">
                    {section.startTime.slice(0, 5)}
                  </span>

                  <Badge className={cn('text-xs', typeConfig[section.type].color)}>
                    {typeConfig[section.type].label}
                  </Badge>

                  <span className="font-medium flex-1 truncate">{section.title}</span>

                  {/* Durée éditable */}
                  {section.isEditingDuration ? (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Clock className="h-3 w-3 text-blue-600" />
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={Math.floor(section.duration / 60)}
                        onChange={(e) => {
                          const mins = Math.max(0, parseInt(e.target.value) || 0);
                          const secs = section.duration % 60;
                          handleDurationChange(section.itemId, mins * 60 + secs);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmDuration(section.itemId);
                          if (e.key === 'Escape') handleCancelDuration(section.itemId);
                        }}
                        className="w-10 h-6 text-sm text-center border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <span className="text-gray-400">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={(section.duration % 60).toString().padStart(2, '0')}
                        onChange={(e) => {
                          const mins = Math.floor(section.duration / 60);
                          const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                          handleDurationChange(section.itemId, mins * 60 + secs);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmDuration(section.itemId);
                          if (e.key === 'Escape') handleCancelDuration(section.itemId);
                        }}
                        className="w-10 h-6 text-sm text-center border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleConfirmDuration(section.itemId)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-gray-600"
                        onClick={() => handleCancelDuration(section.itemId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'flex items-center gap-1 text-sm cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors',
                              section.hasDurationChanges ? 'text-blue-600 bg-blue-50' : 'text-gray-500'
                            )}
                            onClick={(e) => handleStartEditDuration(section.itemId, e)}
                          >
                            <Clock className="h-3 w-3" />
                            {formatDuration(section.duration)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Cliquer pour modifier la durée
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {(section.hasChanges || section.hasDurationChanges) && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                      Modifié
                    </Badge>
                  )}
                </button>

                {/* Section content */}
                {section.isExpanded && section.isEditable && (
                  <div className="px-4 pb-4 border-t bg-white">
                    <Textarea
                      ref={(el) => handleTextareaRef(el, section.itemId)}
                      value={section.editedScript}
                      onChange={(e) => handleTextareaInput(e, section.itemId)}
                      placeholder="Saisir le script de cet élément..."
                      className="mt-3 min-h-[120px] resize-none font-mono text-sm"
                    />
                  </div>
                )}

                {/* Non-editable preview */}
                {section.isExpanded && !section.isEditable && (
                  <div className="px-4 pb-4 border-t">
                    <p className="mt-3 text-sm text-gray-500 italic">
                      Élément non textuel ({typeConfig[section.type].label})
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
