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
      return ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.status && { status: input.status }),
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
      return ctx.db.story.delete({
        where: { id: input.id },
      });
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
        // Dynamic import to avoid server-side issues
        const { createStoryDoc } = await import('@/lib/google/docs');
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
        const { getDocContent, getDocWordCount, estimateReadingDuration } =
          await import('@/lib/google/docs');

        const content = await getDocContent(story.googleDocId);
        const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        const estimatedDuration = estimateReadingDuration(wordCount);

        return ctx.db.story.update({
          where: { id: input.id },
          data: {
            content,
            estimatedDuration,
          },
        });
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
});
