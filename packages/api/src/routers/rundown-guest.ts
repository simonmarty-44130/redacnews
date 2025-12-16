import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { nanoid } from 'nanoid';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Type label mapping pour les types d'items
const typeLabels: Record<string, string> = {
  STORY: 'Sujet',
  INTERVIEW: 'Interview',
  JINGLE: 'Jingle',
  MUSIC: 'Musique',
  LIVE: 'Direct',
  BREAK: 'Pub',
  OTHER: 'Autre',
};

// Helper pour formater la durée
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper pour calculer l'heure de passage
function calculateItemTime(startTime: string, items: { duration: number }[], targetIndex: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  let totalSeconds = hours * 3600 + minutes * 60;

  for (let i = 0; i < targetIndex; i++) {
    totalSeconds += items[i].duration;
  }

  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export const rundownGuestRouter = router({
  // ========== GESTION DES INVITÉS SUR LES ITEMS ==========

  // Ajouter un invité à un élément du conducteur
  addGuestToItem: protectedProcedure
    .input(
      z.object({
        rundownItemId: z.string(),
        name: z.string().min(1),
        email: z.string().email().optional(),
        role: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'item appartient à l'organisation
      const item = await ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.rundownItemId },
        include: { rundown: { include: { show: true } } },
      });

      if (item.rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.db.rundownItemGuest.create({
        data: {
          rundownItemId: input.rundownItemId,
          name: input.name,
          email: input.email,
          role: input.role,
          notes: input.notes,
        },
      });
    }),

  // Modifier un invité
  updateGuest: protectedProcedure
    .input(
      z.object({
        guestId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        role: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'invité appartient à l'organisation
      const guest = await ctx.db.rundownItemGuest.findUniqueOrThrow({
        where: { id: input.guestId },
        include: {
          rundownItem: {
            include: {
              rundown: { include: { show: true } },
            },
          },
        },
      });

      if (guest.rundownItem.rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const { guestId, ...data } = input;
      return ctx.db.rundownItemGuest.update({
        where: { id: guestId },
        data,
      });
    }),

  // Supprimer un invité
  removeGuest: protectedProcedure
    .input(z.object({ guestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'invité appartient à l'organisation
      const guest = await ctx.db.rundownItemGuest.findUniqueOrThrow({
        where: { id: input.guestId },
        include: {
          rundownItem: {
            include: {
              rundown: { include: { show: true } },
            },
          },
        },
      });

      if (guest.rundownItem.rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.db.rundownItemGuest.delete({
        where: { id: input.guestId },
      });
    }),

  // Lister tous les invités d'un conducteur (agrégé par email)
  listGuestsForRundown: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              guests: true,
            },
          },
        },
      });

      if (rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Agréger les invités uniques avec leurs passages
      const guestsMap = new Map<
        string,
        {
          email: string;
          name: string;
          role?: string;
          passages: Array<{
            itemId: string;
            itemTitle: string;
            position: number;
            duration: number;
          }>;
        }
      >();

      for (const item of rundown.items) {
        for (const guest of item.guests) {
          const key = guest.email || guest.name; // Clé unique

          if (!guestsMap.has(key)) {
            guestsMap.set(key, {
              email: guest.email || '',
              name: guest.name,
              role: guest.role || undefined,
              passages: [],
            });
          }

          guestsMap.get(key)!.passages.push({
            itemId: item.id,
            itemTitle: item.title,
            position: item.position,
            duration: item.duration,
          });
        }
      }

      return Array.from(guestsMap.values()).sort((a, b) => {
        // Trier par premier passage
        const aFirst = Math.min(...a.passages.map((p) => p.position));
        const bFirst = Math.min(...b.passages.map((p) => p.position));
        return aFirst - bFirst;
      });
    }),

  // ========== ENVOI DU CONDUCTEUR ==========

  // Envoyer le conducteur à un ou plusieurs invités
  sendToGuests: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        recipients: z
          .array(
            z.object({
              email: z.string().email(),
              name: z.string(),
              // IDs des RundownItems à mettre en surbrillance pour cet invité
              highlightItemIds: z.array(z.string()),
            })
          )
          .min(1),
        personalMessage: z.string().optional(),
        includePdf: z.boolean().default(false),
        includeWebLink: z.boolean().default(false), // Lien web sécurisé
        webLinkExpirationDays: z.number().min(1).max(30).default(7),
        sendCopyToSelf: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Récupérer le conducteur (version bloc uniquement)
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: {
            include: { organization: true },
          },
          items: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              type: true,
              title: true,
              duration: true,
              position: true,
              guests: {
                select: {
                  name: true,
                  role: true,
                },
              },
              // EXCLUS : notes, storyId, story content, script, etc.
            },
          },
        },
      });

      // Vérifier permissions
      if (rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // 2. Récupérer l'utilisateur qui envoie
      const sender = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.userId! },
        select: { firstName: true, lastName: true, email: true },
      });

      // 3. Préparer les données de base du template
      const startTime = rundown.show.startTime || '12:00';
      const totalDuration = rundown.items.reduce((acc, item) => acc + item.duration, 0);
      const formattedDate = format(rundown.date, "EEEE d MMMM yyyy", { locale: fr });

      const baseItems = rundown.items.map((item, index) => ({
        id: item.id,
        time: calculateItemTime(startTime, rundown.items, index),
        type: item.type,
        typeLabel: typeLabels[item.type] || item.type,
        title: item.title,
        duration: formatDuration(item.duration),
        durationSeconds: item.duration,
        guestNames: item.guests.map((g) => g.name),
      }));

      // 4. Envoyer à chaque destinataire
      const results: Array<{ email: string; success: boolean; error?: string }> = [];

      // Import du service email et template
      const { sendRundownEmail } = await import('../lib/email/ses');
      const { renderRundownGuestEmail } = await import('../lib/email/rundown-guest-template');

      for (const recipient of input.recipients) {
        try {
          // Personnaliser les highlights pour cet invité
          const personalizedItems = baseItems.map((item) => ({
            ...item,
            isHighlighted: recipient.highlightItemIds.includes(item.id),
          }));

          // Calculer le temps total de passage de l'invité
          const totalGuestDuration = personalizedItems
            .filter((item) => item.isHighlighted)
            .reduce((sum, item) => sum + item.durationSeconds, 0);

          const templateData = {
            showName: rundown.show.name,
            organizationName: rundown.show.organization.name,
            formattedDate,
            items: personalizedItems,
            totalDuration: formatDuration(totalDuration),
            recipientName: recipient.name,
            personalMessage: input.personalMessage,
            totalGuestDuration: formatDuration(totalGuestDuration),
            highlightedCount: recipient.highlightItemIds.length,
            senderName:
              `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email,
            webUrl: undefined as string | undefined,
          };

          // Générer le token pour lien web si demandé
          let accessToken: string | undefined;

          if (input.includeWebLink) {
            accessToken = nanoid(32);
            templateData.webUrl = `${process.env.NEXT_PUBLIC_APP_URL}/conducteur/partage/${accessToken}`;
          }

          // Générer le HTML de l'email
          const htmlContent = renderRundownGuestEmail(templateData);

          // Envoyer l'email via SES
          await sendRundownEmail({
            to: recipient.email,
            subject: `📻 Conducteur : ${rundown.show.name} - ${formattedDate}`,
            htmlBody: htmlContent,
            replyTo: sender.email,
          });

          // Enregistrer l'envoi dans l'historique
          await ctx.db.rundownGuestShare.create({
            data: {
              rundownId: input.rundownId,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              highlightedItems: recipient.highlightItemIds,
              personalMessage: input.personalMessage,
              includedPdf: input.includePdf,
              sentById: ctx.userId!,
              accessToken,
              tokenExpiresAt: accessToken
                ? addDays(new Date(), input.webLinkExpirationDays)
                : undefined,
            },
          });

          results.push({ email: recipient.email, success: true });
        } catch (error) {
          console.error(`Erreur envoi à ${recipient.email}:`, error);
          results.push({
            email: recipient.email,
            success: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          });
        }
      }

      // 5. Copie à l'expéditeur si demandé
      if (input.sendCopyToSelf && sender.email) {
        try {
          // Simple récapitulatif textuel pour l'expéditeur
          const recipientList = input.recipients
            .map((r) => `• ${r.name} (${r.email}) - ${r.highlightItemIds.length} passage(s)`)
            .join('\n');

          const summaryHtml = `
            <h2>Récapitulatif d'envoi</h2>
            <p><strong>Conducteur :</strong> ${rundown.show.name} - ${formattedDate}</p>
            <p><strong>Destinataires :</strong></p>
            <pre>${recipientList}</pre>
            <p><strong>Résultat :</strong> ${results.filter((r) => r.success).length}/${results.length} envoyé(s)</p>
          `;

          await sendRundownEmail({
            to: sender.email,
            subject: `[Copie] Conducteur envoyé : ${rundown.show.name}`,
            htmlBody: summaryHtml,
          });
        } catch (error) {
          console.error('Erreur envoi copie:', error);
        }
      }

      return {
        total: results.length,
        sent: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        details: results,
      };
    }),

  // ========== HISTORIQUE DES ENVOIS ==========

  getShareHistory: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Vérifier permissions
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: { show: true },
      });

      if (rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.db.rundownGuestShare.findMany({
        where: { rundownId: input.rundownId },
        include: {
          sentBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { sentAt: 'desc' },
      });
    }),

  // ========== ACCÈS WEB SÉCURISÉ ==========

  // Récupérer un conducteur partagé via token (route publique)
  getSharedRundown: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const share = await ctx.db.rundownGuestShare.findUnique({
        where: { accessToken: input.token },
        include: {
          rundown: {
            include: {
              show: {
                include: { organization: true },
              },
              items: {
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  type: true,
                  title: true,
                  duration: true,
                  position: true,
                  guests: {
                    select: { name: true, role: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!share) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: "Ce lien n'existe pas ou a expiré",
        });
      }

      // Vérifier expiration
      if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Ce lien a expiré',
        });
      }

      // Marquer comme vu
      if (!share.viewedAt) {
        await ctx.db.rundownGuestShare.update({
          where: { id: share.id },
          data: { viewedAt: new Date() },
        });
      }

      // Préparer les données avec highlights
      const startTime = share.rundown.show.startTime || '12:00';
      const totalDuration = share.rundown.items.reduce((acc, item) => acc + item.duration, 0);
      const formattedDate = format(share.rundown.date, "EEEE d MMMM yyyy", { locale: fr });

      const items = share.rundown.items.map((item, index) => ({
        id: item.id,
        time: calculateItemTime(startTime, share.rundown.items, index),
        type: item.type,
        typeLabel: typeLabels[item.type] || item.type,
        title: item.title,
        duration: formatDuration(item.duration),
        durationSeconds: item.duration,
        guestNames: item.guests.map((g) => g.name),
        isHighlighted: share.highlightedItems.includes(item.id),
      }));

      return {
        recipientName: share.recipientName,
        showName: share.rundown.show.name,
        organizationName: share.rundown.show.organization.name,
        date: share.rundown.date,
        formattedDate,
        items,
        totalDuration: formatDuration(totalDuration),
        expiresAt: share.tokenExpiresAt,
      };
    }),
});
