// packages/api/src/routers/montage.ts

import { z } from 'zod';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper pour extraire la cle S3 depuis une URL S3
function extractS3KeyFromUrl(url: string): string | null {
  try {
    // URL format: https://bucket.s3.region.amazonaws.com/key
    // ou https://bucket.s3.amazonaws.com/key
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('s3.')) {
      // Retirer le / initial et decoder l'URL (pour eviter le double encodage)
      return decodeURIComponent(urlObj.pathname.slice(1));
    }
    return null;
  } catch {
    return null;
  }
}

// Helper pour generer une URL signee a partir d'une URL S3
async function getPresignedUrlFromS3Url(s3Url: string): Promise<string> {
  const s3Key = extractS3KeyFromUrl(s3Url);
  if (!s3Key) {
    // Si on ne peut pas extraire la cle, retourner l'URL originale
    return s3Url;
  }

  try {
    const bucket = process.env.AWS_S3_BUCKET || 'redacnews-media';
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      }),
      { expiresIn: 3600 }
    );
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return s3Url;
  }
}

export const montageRouter = router({
  // Liste des projets
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No organization' });
    }

    return ctx.db.montageProject.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { tracks: true } },
      },
    });
  }),

  // Obtenir un projet
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.montageProject.findUnique({
        where: { id: input.id },
        include: {
          tracks: {
            orderBy: { order: 'asc' },
            include: {
              clips: {
                include: { mediaItem: true },
              },
            },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      // Verifier que le projet appartient a l'organisation
      if (project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      // Generer des URLs signees pour chaque clip
      const tracksWithSignedUrls = await Promise.all(
        project.tracks.map(async (track) => ({
          ...track,
          clips: await Promise.all(
            track.clips.map(async (clip) => ({
              ...clip,
              sourceUrl: await getPresignedUrlFromS3Url(clip.sourceUrl),
            }))
          ),
        }))
      );

      return {
        ...project,
        tracks: tracksWithSignedUrls,
      };
    }),

  // Creer un projet
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId || !ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return ctx.db.montageProject.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
          createdById: ctx.userId,
        },
      });
    }),

  // Mettre a jour un projet
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verifier l'acces
      const project = await ctx.db.montageProject.findUnique({
        where: { id },
        select: { organizationId: true },
      });

      if (!project || project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageProject.update({
        where: { id },
        data,
      });
    }),

  // Supprimer un projet
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces
      const project = await ctx.db.montageProject.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });

      if (!project || project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageProject.delete({
        where: { id: input.id },
      });
    }),

  // === TRACKS ===

  addTrack: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces au projet
      const project = await ctx.db.montageProject.findUnique({
        where: { id: input.projectId },
        select: { organizationId: true },
      });

      if (!project || project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      // Trouver le prochain ordre
      const lastTrack = await ctx.db.montageTrack.findFirst({
        where: { projectId: input.projectId },
        orderBy: { order: 'desc' },
      });

      return ctx.db.montageTrack.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          color: input.color || '#3B82F6',
          order: (lastTrack?.order ?? -1) + 1,
        },
      });
    }),

  updateTrack: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        color: z.string().optional(),
        volume: z.number().min(0).max(1).optional(),
        pan: z.number().min(-1).max(1).optional(),
        muted: z.boolean().optional(),
        solo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verifier l'acces via le projet
      const track = await ctx.db.montageTrack.findUnique({
        where: { id },
        include: { project: { select: { organizationId: true } } },
      });

      if (!track || track.project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageTrack.update({
        where: { id },
        data,
      });
    }),

  deleteTrack: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces via le projet
      const track = await ctx.db.montageTrack.findUnique({
        where: { id: input.id },
        include: { project: { select: { organizationId: true } } },
      });

      if (!track || track.project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageTrack.delete({
        where: { id: input.id },
      });
    }),

  reorderTracks: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        trackIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces au projet
      const project = await ctx.db.montageProject.findUnique({
        where: { id: input.projectId },
        select: { organizationId: true },
      });

      if (!project || project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      const updates = input.trackIds.map((id, index) =>
        ctx.db.montageTrack.update({
          where: { id },
          data: { order: index },
        })
      );
      await ctx.db.$transaction(updates);
      return { success: true };
    }),

  // === CLIPS ===

  addClip: protectedProcedure
    .input(
      z.object({
        trackId: z.string(),
        name: z.string(),
        mediaItemId: z.string().optional(),
        sourceUrl: z.string(),
        sourceDuration: z.number(),
        startTime: z.number(),
        inPoint: z.number(),
        outPoint: z.number(),
        volume: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces via le projet
      const track = await ctx.db.montageTrack.findUnique({
        where: { id: input.trackId },
        include: { project: { select: { organizationId: true } } },
      });

      if (!track || track.project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageClip.create({
        data: {
          trackId: input.trackId,
          name: input.name,
          mediaItemId: input.mediaItemId,
          sourceUrl: input.sourceUrl,
          sourceDuration: input.sourceDuration,
          startTime: input.startTime,
          inPoint: input.inPoint,
          outPoint: input.outPoint,
          volume: input.volume ?? 1,
          fadeInDuration: 0,
          fadeOutDuration: 0,
        },
      });
    }),

  updateClip: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        startTime: z.number().optional(),
        inPoint: z.number().optional(),
        outPoint: z.number().optional(),
        volume: z.number().optional(),
        fadeInDuration: z.number().optional(),
        fadeOutDuration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verifier l'acces via le projet
      const clip = await ctx.db.montageClip.findUnique({
        where: { id },
        include: {
          track: {
            include: { project: { select: { organizationId: true } } },
          },
        },
      });

      if (!clip || clip.track.project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageClip.update({
        where: { id },
        data,
      });
    }),

  moveClip: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        trackId: z.string(),
        startTime: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces via le projet
      const clip = await ctx.db.montageClip.findUnique({
        where: { id: input.id },
        include: {
          track: {
            include: { project: { select: { organizationId: true } } },
          },
        },
      });

      if (!clip || clip.track.project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      // Verifier que la piste cible appartient au meme projet
      const targetTrack = await ctx.db.montageTrack.findUnique({
        where: { id: input.trackId },
        select: { projectId: true },
      });

      if (!targetTrack || targetTrack.projectId !== clip.track.projectId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target track must be in the same project',
        });
      }

      return ctx.db.montageClip.update({
        where: { id: input.id },
        data: {
          trackId: input.trackId,
          startTime: input.startTime,
        },
      });
    }),

  deleteClip: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces via le projet
      const clip = await ctx.db.montageClip.findUnique({
        where: { id: input.id },
        include: {
          track: {
            include: { project: { select: { organizationId: true } } },
          },
        },
      });

      if (!clip || clip.track.project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return ctx.db.montageClip.delete({
        where: { id: input.id },
      });
    }),

  // === BATCH OPERATIONS ===

  // Sauvegarder l'etat complet d'un projet (pour auto-save)
  saveProjectState: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        duration: z.number(),
        tracks: z.array(
          z.object({
            id: z.string(),
            volume: z.number(),
            pan: z.number(),
            muted: z.boolean(),
            solo: z.boolean(),
          })
        ),
        clips: z.array(
          z.object({
            id: z.string(),
            startTime: z.number(),
            inPoint: z.number(),
            outPoint: z.number(),
            volume: z.number(),
            fadeInDuration: z.number(),
            fadeOutDuration: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifier l'acces au projet
      const project = await ctx.db.montageProject.findUnique({
        where: { id: input.projectId },
        select: { organizationId: true },
      });

      if (!project || project.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      // Transaction pour tout mettre a jour
      const operations = [
        // Mettre a jour la duree du projet
        ctx.db.montageProject.update({
          where: { id: input.projectId },
          data: { duration: input.duration },
        }),
        // Mettre a jour les pistes
        ...input.tracks.map((track) =>
          ctx.db.montageTrack.update({
            where: { id: track.id },
            data: {
              volume: track.volume,
              pan: track.pan,
              muted: track.muted,
              solo: track.solo,
            },
          })
        ),
        // Mettre a jour les clips
        ...input.clips.map((clip) =>
          ctx.db.montageClip.update({
            where: { id: clip.id },
            data: {
              startTime: clip.startTime,
              inPoint: clip.inPoint,
              outPoint: clip.outPoint,
              volume: clip.volume,
              fadeInDuration: clip.fadeInDuration,
              fadeOutDuration: clip.fadeOutDuration,
            },
          })
        ),
      ];

      await ctx.db.$transaction(operations);
      return { success: true };
    }),
});
