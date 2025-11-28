import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const mediaRouter = router({
  // List media items
  list: protectedProcedure
    .input(
      z.object({
        type: z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT']).optional(),
        collectionId: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.mediaItem.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.type && { type: input.type }),
          ...(input.collectionId && {
            collections: {
              some: { collectionId: input.collectionId },
            },
          }),
          ...(input.search && {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { description: { contains: input.search, mode: 'insensitive' } },
              { transcription: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
        },
        include: {
          uploadedBy: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  // Get single media item
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          uploadedBy: true,
          collections: {
            include: { collection: true },
          },
        },
      });
    }),

  // Create media item
  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        type: z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT']),
        mimeType: z.string(),
        fileSize: z.number(),
        duration: z.number().optional(),
        s3Key: z.string(),
        s3Url: z.string(),
        thumbnailUrl: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.mediaItem.create({
        data: {
          ...input,
          tags: input.tags || [],
          uploadedById: ctx.userId!,
          organizationId: ctx.organizationId!,
        },
      });
    }),

  // Update media item
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        transcription: z.string().optional(),
        transcriptionStatus: z
          .enum(['NONE', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'])
          .optional(),
        waveformData: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.mediaItem.update({
        where: { id },
        data,
      });
    }),

  // Delete media item
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.mediaItem.delete({
        where: { id: input.id },
      });
    }),

  // List collections
  listCollections: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.collection.findMany({
      where: { organizationId: ctx.organizationId! },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }),

  // Create collection
  createCollection: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.collection.create({
        data: {
          ...input,
          organizationId: ctx.organizationId!,
        },
      });
    }),
});
