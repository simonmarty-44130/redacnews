import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { format, addSeconds } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getRundownEndCues } from '../lib/script-utils';

// Types for the assembled script
interface LinkedRundownItem {
  id: string;
  title: string;
  script: string | null;
  duration: number;
  type: string;
  position: number;
}

interface LinkedRundownInfo {
  id: string;
  showName: string;
  assigneeName: string | null;
  endCues: string[]; // Les 2 dernieres phrases comme reperes de fin
  items: LinkedRundownItem[]; // Tous les items du conducteur imbrique
}

interface PrompterSection {
  id: string;
  time: string;
  title: string;
  type: string;
  duration: number;
  content: string;
  soundCues: { title: string; duration: number | null }[];
  notes: string | null;
  // Info conducteur imbrique (optionnel)
  linkedRundown?: LinkedRundownInfo;
}

// Helper to format duration
function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${min}:00`;
}

// Helper to format duration for script (MM'SS")
function formatDurationScript(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}'${sec.toString().padStart(2, '0')}"` : `${min}'`;
}

export const scriptRouter = router({
  // Get assembled script for the prompter
  getAssembled: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              story: {
                select: {
                  id: true,
                  title: true,
                  content: true,
                },
              },
              media: {
                include: {
                  mediaItem: {
                    select: {
                      id: true,
                      title: true,
                      type: true,
                      duration: true,
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
              // Conducteur imbrique avec tous ses items
              linkedRundown: {
                include: {
                  show: true,
                  items: {
                    orderBy: { position: 'asc' },
                    select: {
                      id: true,
                      title: true,
                      script: true,
                      duration: true,
                      type: true,
                      position: true,
                    },
                  },
                },
              },
              // Assignee pour le conducteur imbrique
              assignee: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      // Build prompter sections
      // Utiliser l'heure de debut de l'emission (ou 12h00 par defaut)
      let currentTime = new Date(rundown.date);
      const startTimeParts = (rundown.show.startTime || '12:00').split(':');
      const startHour = parseInt(startTimeParts[0], 10) || 12;
      const startMinute = parseInt(startTimeParts[1], 10) || 0;
      currentTime.setHours(startHour, startMinute, 0, 0);

      const sections: PrompterSection[] = rundown.items.map((item) => {
        // Construire les infos du conducteur imbrique si present
        let linkedRundownInfo: LinkedRundownInfo | undefined;
        if (item.linkedRundown) {
          // Nom de l'assignee (presentateur du conducteur imbrique)
          const assigneeName = item.assignee
            ? `${item.assignee.firstName || ''} ${item.assignee.lastName || ''}`.trim() || null
            : null;

          linkedRundownInfo = {
            id: item.linkedRundown.id,
            showName: item.linkedRundown.show.name,
            assigneeName,
            endCues: getRundownEndCues(item.linkedRundown.items),
            items: item.linkedRundown.items.map((linkedItem) => ({
              id: linkedItem.id,
              title: linkedItem.title,
              script: linkedItem.script,
              duration: linkedItem.duration,
              type: linkedItem.type,
              position: linkedItem.position,
            })),
          };
        }

        const section: PrompterSection = {
          id: item.id,
          time: format(currentTime, 'HH:mm'),
          title: item.title,
          type: item.type,
          duration: item.duration,
          // Priority: script field > story content > empty
          content: item.script || item.story?.content || '',
          // Sound cues from attached media
          soundCues: item.media?.map((m) => ({
            title: m.mediaItem.title,
            duration: m.mediaItem.duration,
          })) || [],
          notes: item.notes,
          // Conducteur imbrique
          linkedRundown: linkedRundownInfo,
        };

        currentTime = addSeconds(currentTime, item.duration);
        return section;
      });

      return {
        rundownId: rundown.id,
        showName: rundown.show.name,
        date: rundown.date,
        startTime: rundown.date,
        sections,
        currentItemId: rundown.currentItemId,
        status: rundown.status,
      };
    }),

  // Set current item for prompter sync
  setCurrentItem: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        itemId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.rundown.update({
        where: { id: input.rundownId },
        data: { currentItemId: input.itemId },
      });
      return { success: true };
    }),

  // Get plain text script content (for copy/export)
  getPlainText: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              story: {
                select: {
                  content: true,
                },
              },
              media: {
                include: {
                  mediaItem: {
                    select: {
                      title: true,
                      duration: true,
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      });

      // Build plain text content
      let content = '';
      content += `${rundown.show.name.toUpperCase()}\n`;
      content += `${format(rundown.date, 'EEEE d MMMM yyyy', { locale: fr })}\n`;
      content += `${'═'.repeat(60)}\n\n`;

      // Utiliser l'heure de debut de l'emission (ou 12h00 par defaut)
      let currentTime = new Date(rundown.date);
      const startTimeParts = (rundown.show.startTime || '12:00').split(':');
      const startHour = parseInt(startTimeParts[0], 10) || 12;
      const startMinute = parseInt(startTimeParts[1], 10) || 0;
      currentTime.setHours(startHour, startMinute, 0, 0);

      for (const item of rundown.items) {
        const timeStr = format(currentTime, 'HH:mm');
        const durationStr = formatDurationScript(item.duration);

        // Section header
        content += `${'─'.repeat(60)}\n`;
        content += `${timeStr} - ${item.title.toUpperCase()} (${durationStr})\n`;
        content += `${'─'.repeat(60)}\n\n`;

        // Content: item script OR linked story content
        const scriptContent = item.script || item.story?.content;
        if (scriptContent) {
          content += `${scriptContent}\n\n`;
        }

        // Special markers based on type
        if (item.type === 'JINGLE' || item.type === 'MUSIC') {
          content += `    >>> ${item.type === 'JINGLE' ? 'JINGLE' : 'MUSIQUE'} : ${item.title} <<<\n\n`;
        } else if (item.type === 'BREAK') {
          content += `    >>> PUBLICITE : ${durationStr} <<<\n\n`;
        }

        // Attached sounds
        if (item.media?.length > 0) {
          for (const m of item.media) {
            const mediaDuration = m.mediaItem.duration
              ? formatDuration(m.mediaItem.duration)
              : '';
            content += `    ╔${'═'.repeat(50)}╗\n`;
            content += `    ║  SON : ${m.mediaItem.title} ${mediaDuration ? `(${mediaDuration})` : ''}\n`;
            content += `    ╚${'═'.repeat(50)}╝\n\n`;
          }
        }

        // Advance time
        currentTime = addSeconds(currentTime, item.duration);
      }

      return {
        content,
        showName: rundown.show.name,
        date: rundown.date,
      };
    }),
});
