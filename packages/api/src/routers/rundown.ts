import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const rundownRouter = router({
  // List rundowns
  list: protectedProcedure
    .input(
      z.object({
        showId: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.rundown.findMany({
        where: {
          show: { organizationId: ctx.organizationId! },
          ...(input.showId && { showId: input.showId }),
          ...(input.from && { date: { gte: input.from } }),
          ...(input.to && { date: { lte: input.to } }),
        },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: { story: true, assignee: true },
          },
        },
        orderBy: { date: 'desc' },
      });
    }),

  // Get single rundown
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              story: {
                include: {
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
              },
              assignee: true,
              media: { include: { mediaItem: true } },
            },
          },
        },
      });
    }),

  // Create rundown
  create: protectedProcedure
    .input(
      z.object({
        showId: z.string(),
        date: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.rundown.create({
        data: input,
      });
    }),

  // Update rundown
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DRAFT', 'READY', 'ON_AIR', 'ARCHIVED']).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.rundown.update({
        where: { id },
        data,
      });
    }),

  // Reorder items
  reorderItems: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        itemIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = input.itemIds.map((id, index) =>
        ctx.db.rundownItem.update({
          where: { id },
          data: { position: index },
        })
      );
      await ctx.db.$transaction(updates);
      return { success: true };
    }),

  // Add item
  addItem: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        type: z.enum([
          'STORY',
          'INTERVIEW',
          'JINGLE',
          'MUSIC',
          'LIVE',
          'BREAK',
          'OTHER',
        ]),
        title: z.string(),
        duration: z.number(),
        storyId: z.string().optional(),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { rundownId, position, ...data } = input;

      // If no position, add at the end
      const lastItem = await ctx.db.rundownItem.findFirst({
        where: { rundownId },
        orderBy: { position: 'desc' },
      });

      return ctx.db.rundownItem.create({
        data: {
          ...data,
          rundownId,
          position: position ?? (lastItem?.position ?? 0) + 1,
        },
      });
    }),

  // Delete item
  deleteItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.rundownItem.delete({
        where: { id: input.id },
      });
    }),

  // Update item
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        duration: z.number().optional(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'READY', 'ON_AIR', 'DONE']).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.rundownItem.update({
        where: { id },
        data,
      });
    }),

  // List shows
  listShows: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.show.findMany({
      where: { organizationId: ctx.organizationId! },
      orderBy: { name: 'asc' },
    });
  }),

  // Create show
  createShow: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        defaultDuration: z.number().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.show.create({
        data: {
          ...input,
          organizationId: ctx.organizationId!,
        },
      });
    }),

  // Batch update for collaborative editing
  batchUpdate: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        items: z.array(
          z.object({
            id: z.string(),
            type: z.enum([
              'STORY',
              'INTERVIEW',
              'JINGLE',
              'MUSIC',
              'LIVE',
              'BREAK',
              'OTHER',
            ]),
            title: z.string(),
            duration: z.number(),
            position: z.number(),
            status: z.enum(['PENDING', 'IN_PROGRESS', 'READY', 'ON_AIR', 'DONE']),
            notes: z.string().optional(),
            storyId: z.string().optional(),
            assigneeId: z.string().optional(),
          })
        ),
        status: z.enum(['DRAFT', 'READY', 'ON_AIR', 'ARCHIVED']).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { rundownId, items, status, notes } = input;

      // Update rundown metadata
      if (status || notes !== undefined) {
        await ctx.db.rundown.update({
          where: { id: rundownId },
          data: {
            ...(status && { status }),
            ...(notes !== undefined && { notes }),
          },
        });
      }

      // Update items - upsert each item
      const operations = items.map((item) => {
        const { id, ...data } = item;

        // Check if it's a temp ID (new item)
        if (id.startsWith('temp-')) {
          return ctx.db.rundownItem.create({
            data: {
              ...data,
              rundownId,
            },
          });
        }

        return ctx.db.rundownItem.upsert({
          where: { id },
          create: {
            id,
            ...data,
            rundownId,
          },
          update: data,
        });
      });

      await ctx.db.$transaction(operations);

      // Delete items that are no longer in the list
      const itemIds = items.filter((i) => !i.id.startsWith('temp-')).map((i) => i.id);
      await ctx.db.rundownItem.deleteMany({
        where: {
          rundownId,
          id: { notIn: itemIds },
        },
      });

      return { success: true };
    }),
});
