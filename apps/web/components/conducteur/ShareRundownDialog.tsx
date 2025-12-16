'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Link,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RundownItemGuest {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

interface RundownItem {
  id: string;
  type: string;
  title: string;
  duration: number;
  position: number;
  guests: RundownItemGuest[];
}

interface ShareRundownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rundownId: string;
  showName: string;
  rundownDate: Date;
  items: RundownItem[];
}

interface RecipientConfig {
  email: string;
  name: string;
  highlightItemIds: string[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ShareRundownDialog({
  open,
  onOpenChange,
  rundownId,
  showName,
  rundownDate,
  items,
}: ShareRundownDialogProps) {
  const [step, setStep] = useState<'select' | 'configure' | 'confirm'>('select');
  const [recipients, setRecipients] = useState<RecipientConfig[]>([]);
  const [manualRecipient, setManualRecipient] = useState({ email: '', name: '' });
  const [personalMessage, setPersonalMessage] = useState('');
  const [includePdf, setIncludePdf] = useState(false);
  const [includeWebLink, setIncludeWebLink] = useState(true);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(true);
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);

  // Extraire les invites uniques qui ont un email
  const guestsWithEmail = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        email: string;
        role?: string;
        itemIds: string[];
        totalDuration: number;
      }
    >();

    items.forEach((item) => {
      item.guests.forEach((guest) => {
        if (guest.email) {
          if (!map.has(guest.email)) {
            map.set(guest.email, {
              name: guest.name,
              email: guest.email,
              role: guest.role || undefined,
              itemIds: [],
              totalDuration: 0,
            });
          }
          const entry = map.get(guest.email)!;
          entry.itemIds.push(item.id);
          entry.totalDuration += item.duration;
        }
      });
    });

    return Array.from(map.values());
  }, [items]);

  const sendMutation = trpc.rundownGuest.sendToGuests.useMutation({
    onSuccess: (data) => {
      if (data.failed === 0) {
        toast.success(`Conducteur envoye a ${data.sent} destinataire(s)`);
      } else {
        toast.warning(`${data.sent} envoye(s), ${data.failed} echec(s)`);
      }
      resetAndClose();
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const resetAndClose = () => {
    setStep('select');
    setRecipients([]);
    setManualRecipient({ email: '', name: '' });
    setPersonalMessage('');
    setIncludePdf(false);
    setIncludeWebLink(true);
    setSendCopyToSelf(true);
    setExpandedRecipient(null);
    onOpenChange(false);
  };

  const toggleGuestSelection = (guest: (typeof guestsWithEmail)[0]) => {
    const existing = recipients.find((r) => r.email === guest.email);
    if (existing) {
      setRecipients(recipients.filter((r) => r.email !== guest.email));
    } else {
      setRecipients([
        ...recipients,
        {
          email: guest.email,
          name: guest.name,
          highlightItemIds: guest.itemIds,
        },
      ]);
    }
  };

  const addManualRecipient = () => {
    if (!manualRecipient.email || !manualRecipient.name) {
      toast.error('Email et nom requis');
      return;
    }
    if (recipients.some((r) => r.email === manualRecipient.email)) {
      toast.error('Ce destinataire existe deja');
      return;
    }
    setRecipients([
      ...recipients,
      {
        email: manualRecipient.email,
        name: manualRecipient.name,
        highlightItemIds: [],
      },
    ]);
    setManualRecipient({ email: '', name: '' });
  };

  const toggleItemHighlight = (recipientEmail: string, itemId: string) => {
    setRecipients(
      recipients.map((r) => {
        if (r.email !== recipientEmail) return r;
        const hasItem = r.highlightItemIds.includes(itemId);
        return {
          ...r,
          highlightItemIds: hasItem
            ? r.highlightItemIds.filter((id) => id !== itemId)
            : [...r.highlightItemIds, itemId],
        };
      })
    );
  };

  const handleSend = () => {
    if (recipients.length === 0) {
      toast.error('Aucun destinataire selectionne');
      return;
    }
    sendMutation.mutate({
      rundownId,
      recipients,
      personalMessage: personalMessage || undefined,
      includePdf,
      includeWebLink,
      sendCopyToSelf,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envoyer le conducteur aux invites
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{showName}</span>
            {' — '}
            {format(rundownDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Etape 1 : Selection des destinataires */}
          {step === 'select' && (
            <div className="space-y-4 py-4">
              {/* Invites detectes automatiquement */}
              {guestsWithEmail.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invites detectes ({guestsWithEmail.length})
                  </Label>
                  <div className="space-y-2">
                    {guestsWithEmail.map((guest) => {
                      const isSelected = recipients.some(
                        (r) => r.email === guest.email
                      );
                      return (
                        <div
                          key={guest.email}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-blue-200'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => toggleGuestSelection(guest)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={isSelected} />
                            <div>
                              <div className="font-medium">{guest.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {guest.email}
                                {guest.role && ` — ${guest.role}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDuration(guest.totalDuration)}
                            </div>
                            <div className="text-xs">
                              {guest.itemIds.length} passage(s)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {guestsWithEmail.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun invite avec email detecte.</p>
                  <p className="text-sm">
                    Ajoutez des invites aux elements du conducteur ou saisissez
                    manuellement.
                  </p>
                </div>
              )}

              <Separator />

              {/* Ajout manuel */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ajouter manuellement</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom"
                    value={manualRecipient.name}
                    onChange={(e) =>
                      setManualRecipient({
                        ...manualRecipient,
                        name: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={manualRecipient.email}
                    onChange={(e) =>
                      setManualRecipient({
                        ...manualRecipient,
                        email: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={addManualRecipient}>
                    Ajouter
                  </Button>
                </div>
              </div>

              {/* Recapitulatif des selectionnes */}
              {recipients.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    {recipients.length} destinataire(s) selectionne(s)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {recipients.map((r) => (
                      <Badge key={r.email} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etape 2 : Configuration des highlights */}
          {step === 'configure' && (
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 inline mr-1 text-amber-600" />
                <span className="text-amber-800">
                  Verifiez les passages mis en surbrillance pour chaque invite.
                  Les elements coches apparaitront en jaune dans leur email.
                </span>
              </div>

              {recipients.map((recipient) => (
                <div
                  key={recipient.email}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100"
                    onClick={() =>
                      setExpandedRecipient(
                        expandedRecipient === recipient.email
                          ? null
                          : recipient.email
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{recipient.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({recipient.email})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {recipient.highlightItemIds.length} passage(s)
                      </Badge>
                      {expandedRecipient === recipient.email ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {expandedRecipient === recipient.email && (
                    <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                      {items.map((item) => {
                        const isHighlighted = recipient.highlightItemIds.includes(
                          item.id
                        );
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                              isHighlighted ? 'bg-yellow-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <Checkbox
                              checked={isHighlighted}
                              onCheckedChange={() =>
                                toggleItemHighlight(recipient.email, item.id)
                              }
                            />
                            <div className="flex-1">
                              <span className="font-medium">{item.title}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({formatDuration(item.duration)})
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Etape 3 : Options et confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4 py-4">
              {/* Message personnalise */}
              <div className="space-y-2">
                <Label>Message personnalise (optionnel)</Label>
                <Textarea
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  placeholder="Merci de votre participation a notre emission..."
                  rows={3}
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeWebLink"
                    checked={includeWebLink}
                    onCheckedChange={(checked) => setIncludeWebLink(!!checked)}
                  />
                  <Label htmlFor="includeWebLink" className="cursor-pointer">
                    <Link className="h-4 w-4 inline mr-1" />
                    Inclure un lien web de consultation (expire apres 7 jours)
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sendCopyToSelf"
                    checked={sendCopyToSelf}
                    onCheckedChange={(checked) => setSendCopyToSelf(!!checked)}
                  />
                  <Label htmlFor="sendCopyToSelf" className="cursor-pointer">
                    M'envoyer une copie recapitulative
                  </Label>
                </div>
              </div>

              {/* Recapitulatif final */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-800 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Recapitulatif de l'envoi
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <div>{recipients.length} destinataire(s)</div>
                  {recipients.map((r) => (
                    <div key={r.email} className="ml-4 text-green-600">
                      • {r.name} — {r.highlightItemIds.length} passage(s) en
                      surbrillance
                    </div>
                  ))}
                </div>
              </div>

              {/* Avertissement confidentialite */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Seuls les <strong>horaires et titres</strong> des rubriques seront
                partages. Le contenu editorial reste confidentiel.
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={resetAndClose}>
                Annuler
              </Button>
              <Button
                onClick={() => setStep('configure')}
                disabled={recipients.length === 0}
              >
                Continuer
                <span className="ml-1">({recipients.length})</span>
              </Button>
            </>
          )}

          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Retour
              </Button>
              <Button onClick={() => setStep('confirm')}>Continuer</Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                Retour
              </Button>
              <Button onClick={handleSend} disabled={sendMutation.isPending}>
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
