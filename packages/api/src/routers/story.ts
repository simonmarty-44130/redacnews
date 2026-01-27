import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

// Google Docs integration types
interface GoogleDocResult {
  id: string;
  url: string;
  embedUrl: string;
}

export const storyRouter = router({
  // List stories
  // Par défaut, exclut les sujets archivés sauf si on demande explicitement le statut ARCHIVED
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
          .optional(),
        authorId: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Si un statut spécifique est demandé, on filtre dessus
      // Sinon, on exclut les archivés par défaut
      const statusFilter = input.status
        ? { status: input.status }
        : { status: { not: 'ARCHIVED' as const } };

      return ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...statusFilter,
          ...(input.authorId && { authorId: input.authorId }),
          ...(input.category && { category: input.category }),
          ...(input.search && {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { content: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
        },
        include: {
          author: true,
          assignee: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  // Get single story
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.story.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          author: true,
          assignee: true,
          media: {
            include: { mediaItem: true },
            orderBy: { position: 'asc' },
          },
          comments: {
            include: { author: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }),

  // Create story
  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      return ctx.db.story.create({
        data: {
          ...input,
          slug: `${slug}-${Date.now()}`,
          authorId: ctx.userId!,
          organizationId: ctx.organizationId!,
          tags: input.tags || [],
        },
      });
    }),

  // Update story
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        summary: z.string().optional(),
        status: z
          .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
          .optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        estimatedDuration: z.number().optional(),
        authorId: z.string().optional(),
        assigneeId: z.string().nullable().optional(),
        googleDocId: z.string().optional(),
        googleDocUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.story.update({
        where: { id },
        data,
      });
    }),

  // Delete story
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier si le story existe d'abord
      const story = await ctx.db.story.findUnique({
        where: { id: input.id },
        include: {
          politicalTags: true,
        },
      });

      if (!story) {
        // Story déjà supprimé ou n'existe pas - pas d'erreur
        return { success: true, alreadyDeleted: true };
      }

      // Vérifier que le story appartient à l'organisation
      if (story.organizationId !== ctx.organizationId) {
        throw new Error('Non autorisé');
      }

      // Empêcher la suppression des sujets politiques (pour préserver le temps de parole ARCOM)
      // Ces sujets peuvent uniquement être archivés
      if (story.politicalTags && story.politicalTags.length > 0) {
        throw new Error(
          'Les sujets politiques ne peuvent pas être supprimés pour préserver le suivi du pluralisme (ARCOM). ' +
          'Vous pouvez uniquement archiver ce sujet.'
        );
      }

      // Dissocier le story des RundownItems (mettre storyId à null)
      await ctx.db.rundownItem.updateMany({
        where: { storyId: input.id },
        data: { storyId: null },
      });

      // Supprimer le story (StoryMedia et Comments seront supprimés en cascade)
      await ctx.db.story.delete({
        where: { id: input.id },
      });

      return { success: true, alreadyDeleted: false };
    }),

  // Create story with Google Doc
  createWithGoogleDoc: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create Google Doc
      let googleDoc: GoogleDocResult | null = null;

      try {
        // Import from local lib
        const { createStoryDoc } = await import('../lib/google/docs');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        googleDoc = await createStoryDoc(input.title, folderId);
      } catch (error) {
        console.error('Failed to create Google Doc:', error);
        // Continue without Google Doc - user can edit in plain text
      }

      const slug = input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      return ctx.db.story.create({
        data: {
          ...input,
          slug: `${slug}-${Date.now()}`,
          authorId: ctx.userId!,
          organizationId: ctx.organizationId!,
          tags: input.tags || [],
          googleDocId: googleDoc?.id,
          googleDocUrl: googleDoc?.url,
        },
      });
    }),

  // Sync content from Google Doc
  // Retourne le contenu et la duree estimee pour le timer de lecture
  // Si du texte est en gras (lancement/pied), seul ce texte est comptabilisé pour la durée
  syncGoogleDoc: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.db.story.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (!story.googleDocId) {
        throw new Error('Story does not have a linked Google Doc');
      }

      try {
        const { getDocContentWithFormatting, estimateReadingDuration } =
          await import('../lib/google/docs');

        const { fullText, boldText, hasBoldText } = await getDocContentWithFormatting(story.googleDocId);

        // Si du texte est en gras, ne compter que le gras (lancement/pied)
        // Sinon compter tout le texte
        const textForDuration = hasBoldText ? boldText : fullText;
        const wordCount = textForDuration.trim().split(/\s+/).filter(Boolean).length;
        const estimatedDuration = estimateReadingDuration(wordCount);

        const updated = await ctx.db.story.update({
          where: { id: input.id },
          data: {
            content: fullText, // Sauvegarder tout le contenu pour backup
            estimatedDuration,
          },
        });

        // Retourner les donnees pour le timer de lecture
        return {
          id: updated.id,
          content: updated.content,
          estimatedDuration: updated.estimatedDuration,
          wordCount,
          usedBoldOnly: hasBoldText, // Indiquer si seul le gras a été compté
        };
      } catch (error) {
        console.error('Failed to sync Google Doc:', error);
        throw new Error('Failed to sync content from Google Doc');
      }
    }),

  // Link existing Google Doc to story
  linkGoogleDoc: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        googleDocId: z.string(),
        googleDocUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const url = input.googleDocUrl ||
        `https://docs.google.com/document/d/${input.googleDocId}/edit`;

      return ctx.db.story.update({
        where: { id: input.storyId },
        data: {
          googleDocId: input.googleDocId,
          googleDocUrl: url,
        },
      });
    }),

  // List stories for rundown selection (APPROVED/PUBLISHED only)
  listForRundown: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: {
            in: ['APPROVED', 'PUBLISHED'],
          },
          ...(input.search && {
            title: { contains: input.search, mode: 'insensitive' },
          }),
        },
        select: {
          id: true,
          title: true,
          estimatedDuration: true,
          status: true,
          category: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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
                  s3Url: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
    }),
});
