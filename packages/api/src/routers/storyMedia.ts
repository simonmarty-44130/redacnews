import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const storyMediaRouter = router({
  // Lier un media a un sujet
  link: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        mediaItemId: z.string(),
        insertionType: z
          .enum(['INLINE', 'BACKGROUND', 'REFERENCE'])
          .default('REFERENCE'),
        notes: z.string().optional(),
        timecodeStart: z.number().optional(),
        timecodeEnd: z.number().optional(),
        textMarker: z.string().optional(),
        cuePoint: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storyId, mediaItemId, ...data } = input;

      // Recuperer la derniere position
      const lastItem = await ctx.db.storyMedia.findFirst({
        where: { storyId },
        orderBy: { position: 'desc' },
      });

      // Creer la liaison
      const storyMedia = await ctx.db.storyMedia.create({
        data: {
          storyId,
          mediaItemId,
          position: (lastItem?.position ?? 0) + 1,
          ...data,
        },
        include: { mediaItem: true },
      });

      // Incrementer le compteur d'utilisation
      await ctx.db.mediaItem.update({
        where: { id: mediaItemId },
        data: { usageCount: { increment: 1 } },
      });

      return storyMedia;
    }),

  // Delier un media d'un sujet
  unlink: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        mediaItemId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.storyMedia.delete({
        where: {
          storyId_mediaItemId: {
            storyId: input.storyId,
            mediaItemId: input.mediaItemId,
          },
        },
      });

      // Decrementer le compteur d'utilisation
      await ctx.db.mediaItem.update({
        where: { id: input.mediaItemId },
        data: { usageCount: { decrement: 1 } },
      });

      return { success: true };
    }),

  // Mettre a jour les metadonnees d'une liaison
  update: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        mediaItemId: z.string(),
        insertionType: z
          .enum(['INLINE', 'BACKGROUND', 'REFERENCE'])
          .optional(),
        notes: z.string().nullable().optional(),
        timecodeStart: z.number().nullable().optional(),
        timecodeEnd: z.number().nullable().optional(),
        textMarker: z.string().nullable().optional(),
        cuePoint: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storyId, mediaItemId, ...data } = input;

      return ctx.db.storyMedia.update({
        where: {
          storyId_mediaItemId: { storyId, mediaItemId },
        },
        data,
        include: { mediaItem: true },
      });
    }),

  // Reordonner les medias d'un sujet
  reorder: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        mediaItemIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = input.mediaItemIds.map((mediaItemId, index) =>
        ctx.db.storyMedia.update({
          where: {
            storyId_mediaItemId: {
              storyId: input.storyId,
              mediaItemId,
            },
          },
          data: { position: index },
        })
      );

      await ctx.db.$transaction(updates);
      return { success: true };
    }),

  // Lister les medias d'un sujet
  listByStory: protectedProcedure
    .input(z.object({ storyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyMedia.findMany({
        where: { storyId: input.storyId },
        include: {
          mediaItem: {
            include: { uploadedBy: true },
          },
        },
        orderBy: { position: 'asc' },
      });
    }),

  // Lister les utilisations d'un media (vue "Utilisations")
  listByMedia: protectedProcedure
    .input(z.object({ mediaItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [storyUsages, rundownUsages] = await Promise.all([
        // Utilisations dans les sujets
        ctx.db.storyMedia.findMany({
          where: { mediaItemId: input.mediaItemId },
          include: {
            story: {
              include: { author: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Utilisations dans les conducteurs
        ctx.db.rundownItemMedia.findMany({
          where: { mediaItemId: input.mediaItemId },
          include: {
            rundownItem: {
              include: {
                rundown: {
                  include: { show: true },
                },
              },
            },
          },
        }),
      ]);

      return { storyUsages, rundownUsages };
    }),
});
