import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  LanguageCode,
} from '@aws-sdk/client-transcribe';
import { router, protectedProcedure } from '../trpc';

// Transcription job name storage (in production, store in DB)
const transcriptionJobs = new Map<string, string>(); // mediaItemId -> jobName

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const transcribeClient = new TranscribeClient({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Supported audio/video formats for transcription
const TRANSCRIBABLE_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/ogg',
];

export const mediaRouter = router({
  // Get presigned URL for upload
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = `${ctx.organizationId}/media/${Date.now()}-${input.filename}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET || 'redacnews-media',
        Key: key,
        ContentType: input.contentType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
      });

      const publicUrl = process.env.AWS_CLOUDFRONT_DOMAIN
        ? `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`
        : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      return {
        uploadUrl,
        key,
        publicUrl,
      };
    }),
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

  // Add media to collection
  addToCollection: protectedProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        collectionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the highest position in the collection
      const lastItem = await ctx.db.collectionItem.findFirst({
        where: { collectionId: input.collectionId },
        orderBy: { position: 'desc' },
      });

      return ctx.db.collectionItem.create({
        data: {
          mediaItemId: input.mediaItemId,
          collectionId: input.collectionId,
          position: (lastItem?.position ?? 0) + 1,
        },
      });
    }),

  // Remove media from collection
  removeFromCollection: protectedProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        collectionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.collectionItem.delete({
        where: {
          collectionId_mediaItemId: {
            collectionId: input.collectionId,
            mediaItemId: input.mediaItemId,
          },
        },
      });
    }),

  // Start transcription for a media item
  startTranscription: protectedProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        languageCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mediaItem = await ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.mediaItemId },
      });

      // Check if mime type is supported
      if (!TRANSCRIBABLE_MIME_TYPES.includes(mediaItem.mimeType.toLowerCase())) {
        throw new Error(
          `File type ${mediaItem.mimeType} is not supported for transcription`
        );
      }

      const bucket = process.env.AWS_S3_BUCKET || 'redacnews-media';
      const jobName = `redacnews-${input.mediaItemId}-${Date.now()}`;

      // Start transcription job
      await transcribeClient.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: jobName,
          LanguageCode: (input.languageCode as LanguageCode) || LanguageCode.FR_FR,
          Media: {
            MediaFileUri: `s3://${bucket}/${mediaItem.s3Key}`,
          },
          OutputBucketName: bucket,
          OutputKey: `transcriptions/${input.mediaItemId}.json`,
          Settings: {
            ShowSpeakerLabels: true,
            MaxSpeakerLabels: 10,
          },
        })
      );

      // Store job name for later retrieval
      transcriptionJobs.set(input.mediaItemId, jobName);

      // Update media item status
      await ctx.db.mediaItem.update({
        where: { id: input.mediaItemId },
        data: { transcriptionStatus: 'PENDING' },
      });

      return { jobName, status: 'PENDING' };
    }),

  // Get transcription status and result
  getTranscriptionStatus: protectedProcedure
    .input(z.object({ mediaItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mediaItem = await ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.mediaItemId },
      });

      // If already completed, return the stored transcription
      if (mediaItem.transcriptionStatus === 'COMPLETED' && mediaItem.transcription) {
        return {
          status: 'COMPLETED',
          transcription: mediaItem.transcription,
        };
      }

      // Get job name from memory or try to reconstruct it
      let jobName = transcriptionJobs.get(input.mediaItemId);

      if (!jobName && mediaItem.transcriptionStatus === 'IN_PROGRESS') {
        // Job name not in memory, return current status from DB
        return {
          status: mediaItem.transcriptionStatus,
          transcription: null,
        };
      }

      if (!jobName) {
        return {
          status: mediaItem.transcriptionStatus || 'NONE',
          transcription: null,
        };
      }

      try {
        const response = await transcribeClient.send(
          new GetTranscriptionJobCommand({
            TranscriptionJobName: jobName,
          })
        );

        const job = response.TranscriptionJob;
        const status = job?.TranscriptionJobStatus;

        if (status === 'COMPLETED' && job?.Transcript?.TranscriptFileUri) {
          // Fetch transcription from S3
          const bucket = process.env.AWS_S3_BUCKET || 'redacnews-media';
          const outputKey = `transcriptions/${input.mediaItemId}.json`;

          const { GetObjectCommand } = await import('@aws-sdk/client-s3');
          const { S3Client } = await import('@aws-sdk/client-s3');

          const s3 = new S3Client({
            region: process.env.AWS_REGION || 'eu-west-3',
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
          });

          const s3Response = await s3.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: outputKey,
            })
          );

          const bodyString = await s3Response.Body?.transformToString();
          let transcription = '';

          if (bodyString) {
            const data = JSON.parse(bodyString);
            const transcripts = data.results?.transcripts;
            if (transcripts && transcripts.length > 0) {
              transcription = transcripts.map((t: any) => t.transcript).join('\n\n');
            }
          }

          // Update media item with transcription
          await ctx.db.mediaItem.update({
            where: { id: input.mediaItemId },
            data: {
              transcription,
              transcriptionStatus: 'COMPLETED',
            },
          });

          // Clean up job name from memory
          transcriptionJobs.delete(input.mediaItemId);

          return { status: 'COMPLETED', transcription };
        }

        if (status === 'FAILED') {
          await ctx.db.mediaItem.update({
            where: { id: input.mediaItemId },
            data: { transcriptionStatus: 'FAILED' },
          });

          transcriptionJobs.delete(input.mediaItemId);

          return {
            status: 'FAILED',
            error: job?.FailureReason || 'Transcription failed',
          };
        }

        // Update status in DB
        if (status === 'IN_PROGRESS') {
          await ctx.db.mediaItem.update({
            where: { id: input.mediaItemId },
            data: { transcriptionStatus: 'IN_PROGRESS' },
          });
        }

        return { status: status || 'UNKNOWN', transcription: null };
      } catch (error) {
        console.error('Error getting transcription status:', error);
        return {
          status: mediaItem.transcriptionStatus || 'NONE',
          transcription: null,
        };
      }
    }),

  // Check if a file is transcribable
  isTranscribable: protectedProcedure
    .input(z.object({ mimeType: z.string() }))
    .query(({ input }) => {
      return {
        isTranscribable: TRANSCRIBABLE_MIME_TYPES.includes(
          input.mimeType.toLowerCase()
        ),
      };
    }),
});
