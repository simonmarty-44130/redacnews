'use client';

import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  Send,
  User,
  Clock,
  ExternalLink,
  Check,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RundownItem {
  id: string;
  type: string;
  title: string;
  duration: number;
  position: number;
}

interface GuestInfo {
  variableName: string;
  label: string;
  name: string;
  email: string;
  passages: Array<{
    time: string;
    title: string;
    duration: number;
  }>;
}

interface SendToGuestsGmailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rundownId: string;
  showName: string;
  rundownDate: Date;
  startTime: string;
  items: RundownItem[];
  templateVariables?: Record<string, string>;
}

// Variables qui représentent des invités dans le Tour des Clochers
const GUEST_VARIABLE_PATTERNS = [
  { pattern: /^INVITE_/i, labelPrefix: 'Invité' },
  { pattern: /FIL_ROUGE/i, labelPrefix: 'Fil rouge' },
];

// Helper pour formater la durée
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper pour calculer l'heure de passage
function calculateItemTime(startTime: string, items: RundownItem[], targetIndex: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  let totalSeconds = hours * 3600 + minutes * 60;

  for (let i = 0; i < targetIndex; i++) {
    totalSeconds += items[i].duration;
  }

  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Labels lisibles pour les variables
const VARIABLE_LABELS: Record<string, string> = {
  INVITE_FIL_ROUGE: 'Invité fil rouge',
  INVITE_EVANGILE: 'Invité évangile',
  INVITE_VIE_PAROISSIALE: 'Invité vie paroissiale',
  INVITE_ELUS: 'Invité élu(e)',
  INVITE_PATRIMOINE: 'Invité patrimoine',
  INVITE_ASSOCIATION: 'Invité association',
};

export function SendToGuestsGmail({
  open,
  onOpenChange,
  showName,
  rundownDate,
  startTime,
  items,
  templateVariables = {},
}: SendToGuestsGmailProps) {
  // État pour les emails de chaque invité
  const [guestEmails, setGuestEmails] = useState<Record<string, string>>({});

  // Extraire les invités depuis les variables du template
  const guests = useMemo(() => {
    const result: GuestInfo[] = [];

    Object.entries(templateVariables).forEach(([varName, value]) => {
      // Vérifier si c'est une variable d'invité
      const isGuest = GUEST_VARIABLE_PATTERNS.some((p) => p.pattern.test(varName));
      if (!isGuest || !value || value.trim() === '') return;

      // Trouver les passages de cet invité dans le conducteur
      // On cherche les items dont le titre contient le nom de l'invité ou la catégorie
      const categoryMapping: Record<string, string[]> = {
        INVITE_FIL_ROUGE: ['fil rouge', 'présentation'],
        INVITE_EVANGILE: ['évangile', 'evangile'],
        INVITE_VIE_PAROISSIALE: ['vie paroissiale', 'paroisse'],
        INVITE_ELUS: ['élu', 'maire', 'conseiller'],
        INVITE_PATRIMOINE: ['patrimoine', 'église', 'histoire'],
        INVITE_ASSOCIATION: ['association', 'bénévole'],
      };

      const keywords = categoryMapping[varName] || [];
      const passages = items
        .filter((item) => {
          const titleLower = item.title.toLowerCase();
          // L'item contient le nom de l'invité ou une des catégories associées
          return (
            titleLower.includes(value.toLowerCase()) ||
            keywords.some((kw) => titleLower.includes(kw))
          );
        })
        .map((item) => ({
          time: calculateItemTime(startTime, items, item.position),
          title: item.title,
          duration: item.duration,
        }));

      result.push({
        variableName: varName,
        label: VARIABLE_LABELS[varName] || varName.replace(/_/g, ' '),
        name: value,
        email: guestEmails[varName] || '',
        passages,
      });
    });

    return result;
  }, [templateVariables, items, startTime, guestEmails]);

  // Calculer toutes les heures de passage pour le conducteur complet
  const itemsWithTimes = useMemo(() => {
    return items.map((item) => ({
      ...item,
      time: calculateItemTime(startTime, items, item.position),
    }));
  }, [items, startTime]);

  // Générer le contenu de l'email pour un invité (version texte formatée pour Gmail Compose)
  const generateEmailContent = (guest: GuestInfo): { subject: string; body: string } => {
    const formattedDate = format(rundownDate, 'EEEE d MMMM yyyy', { locale: fr });
    const formattedDateShort = format(rundownDate, 'd MMMM yyyy', { locale: fr });

    const subject = `Radio Fidélité - ${showName} - ${formattedDateShort} - Votre participation`;

    // Trouver les titres des passages de l'invité pour le marquage
    const guestPassageTitles = guest.passages.map((p) => p.title.toLowerCase());

    // Construire le corps du message en texte formaté
    let body = `📻 RADIO FIDÉLITÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bonjour ${guest.name},

Vous êtes invité(e) à participer à l'émission "${showName}" sur Radio Fidélité.

📅 INFORMATIONS PRATIQUES
━━━━━━━━━━━━━━━━━━━━━━━━━
• Date : ${formattedDate}
• Heure de début : ${startTime}
• Lieu : Studios de Radio Fidélité (à confirmer)

`;

    // Ajouter les passages de l'invité
    if (guest.passages.length > 0) {
      body += `⭐ VOS PASSAGES PRÉVUS
━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      guest.passages.forEach((p) => {
        body += `▸ ${p.time}  │  ${p.title}  │  ${formatDuration(p.duration)}
`;
      });
      body += `
`;
    }

    // Conducteur complet
    body += `📋 CONDUCTEUR COMPLET DE L'ÉMISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(⭐ = Vos passages)

`;

    // Calculer la largeur max du titre pour l'alignement
    const maxTitleLength = Math.min(
      40,
      Math.max(...itemsWithTimes.map((item) => item.title.length))
    );

    itemsWithTimes.forEach((item) => {
      const isGuestPassage = guestPassageTitles.includes(item.title.toLowerCase());
      const marker = isGuestPassage ? '⭐' : '  ';
      const title = item.title.substring(0, maxTitleLength).padEnd(maxTitleLength);
      body += `${marker} ${item.time}  │  ${title}  │  ${formatDuration(item.duration)}
`;
    });

    body += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Merci de confirmer votre participation en répondant à cet email.

Cordialement,
L'équipe de Radio Fidélité

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 02 40 69 27 27  │  🌐 www.radio-fidelite.fr
Radio Fidélité - La radio qui vous rapproche
`;

    return { subject, body };
  };

  // Ouvrir Gmail Compose pour un invité
  const openGmailCompose = (guest: GuestInfo) => {
    if (!guest.email) return;

    const { subject, body } = generateEmailContent(guest);

    // Encoder pour l'URL
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);

    // URL Gmail Compose
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(guest.email)}&su=${encodedSubject}&body=${encodedBody}`;

    window.open(gmailUrl, '_blank');
  };

  // Ouvrir Gmail pour tous les invités avec email
  const openAllGmailCompose = () => {
    const guestsWithEmail = guests.filter((g) => g.email && g.email.includes('@'));
    guestsWithEmail.forEach((guest, index) => {
      // Délai pour éviter le blocage des pop-ups
      setTimeout(() => openGmailCompose(guest), index * 500);
    });
  };

  const guestsWithEmail = guests.filter((g) => g.email && g.email.includes('@'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envoyer le conducteur aux invités
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{showName}</span>
            {' — '}
            {format(rundownDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {guests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun invité détecté dans ce conducteur.</p>
                <p className="text-sm mt-2">
                  Ce conducteur n'a pas été créé depuis un template avec des variables d'invités.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Renseignez les emails des invités puis cliquez sur "Envoyer" pour ouvrir Gmail
                  avec le message pré-rempli.
                </div>

                {guests.map((guest) => (
                  <div key={guest.variableName} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {guest.name}
                        </div>
                        <div className="text-sm text-muted-foreground">{guest.label}</div>
                      </div>
                      {guest.passages.length > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {guest.passages.length} passage(s)
                        </Badge>
                      )}
                    </div>

                    {/* Passages prévus */}
                    {guest.passages.length > 0 && (
                      <div className="bg-gray-50 rounded p-2 space-y-1">
                        {guest.passages.map((passage, idx) => (
                          <div key={idx} className="text-sm flex items-center gap-2">
                            <span className="font-mono text-muted-foreground">
                              {passage.time}
                            </span>
                            <span>{passage.title}</span>
                            <span className="text-muted-foreground">
                              ({formatDuration(passage.duration)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Email */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`email-${guest.variableName}`} className="sr-only">
                          Email
                        </Label>
                        <Input
                          id={`email-${guest.variableName}`}
                          type="email"
                          placeholder="Email de l'invité"
                          value={guestEmails[guest.variableName] || ''}
                          onChange={(e) =>
                            setGuestEmails((prev) => ({
                              ...prev,
                              [guest.variableName]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!guestEmails[guest.variableName]?.includes('@')}
                        onClick={() =>
                          openGmailCompose({
                            ...guest,
                            email: guestEmails[guest.variableName] || '',
                          })
                        }
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Gmail
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator />

                {/* Résumé */}
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-green-800">
                  <Check className="h-4 w-4 inline mr-1" />
                  {guestsWithEmail.length} invité(s) avec email renseigné sur {guests.length}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {guests.length > 0 && (
            <Button onClick={openAllGmailCompose} disabled={guestsWithEmail.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              Envoyer à tous ({guestsWithEmail.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
