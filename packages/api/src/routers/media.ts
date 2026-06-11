import { z } from 'zod';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  LanguageCode,
} from '@aws-sdk/client-transcribe';
import { router, activeProcedure } from '../trpc';
import { awsConfig, s3Config, cloudfrontConfig } from '../lib/aws-config';
import { assertMediaItemInOrg, assertCollectionInOrg } from '../lib/tenant-guard';

// Transcription job name storage (in production, store in DB)
const transcriptionJobs = new Map<string, string>(); // mediaItemId -> jobName

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

const transcribeClient = new TranscribeClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
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
  getUploadUrl: activeProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Nettoyer le nom de fichier pour éviter les problèmes d'encodage URL
      // Remplacer les espaces et caractères spéciaux par des underscores
      const sanitizedFilename = input.filename
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')
        .replace(/_+/g, '_');

      const key = `${ctx.organizationId}/media/${Date.now()}-${sanitizedFilename}`;

      const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        ContentType: input.contentType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
        // Exclure les headers de checksum de la signature
        unsignableHeaders: new Set(['x-amz-checksum-crc32', 'x-amz-sdk-checksum-algorithm']),
      });

      const publicUrl = cloudfrontConfig.domain
        ? `https://${cloudfrontConfig.domain}/${key}`
        : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;

      return {
        uploadUrl,
        key,
        publicUrl,
      };
    }),
  // List media items
  list: activeProcedure
    .input(
      z.object({
        type: z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT']).optional(),
        collectionId: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const mediaItems = await ctx.db.mediaItem.findMany({
        where: {
          organizationId: ctx.organizationId!,
          // Les médias archivés sont cachés des listes par défaut ; on les
          // inclut uniquement lors d'une recherche (et via l'IA). cf. archivage.
          ...(input.search ? {} : { archived: false }),
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

      // Generer des URLs signees pour chaque media item
      const bucket = s3Config.bucket;
      const itemsWithPresignedUrls = await Promise.all(
        mediaItems.map(async (item) => {
          try {
            const presignedUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: bucket,
                Key: item.s3Key,
              }),
              { expiresIn: 3600 }
            );
            return {
              ...item,
              s3Url: presignedUrl, // Remplacer s3Url par l'URL signee
            };
          } catch (error) {
            console.error(`Error generating presigned URL for ${item.id}:`, error);
            return item; // Retourner l'item original en cas d'erreur
          }
        })
      );

      return itemsWithPresignedUrls;
    }),

  // Get multiple media items by IDs
  getMany: activeProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const mediaItems = await ctx.db.mediaItem.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId!,
        },
        include: {
          uploadedBy: true,
        },
      });

      // Generate presigned URLs for each item
      const bucket = s3Config.bucket;
      const itemsWithUrls = await Promise.all(
        mediaItems.map(async (item) => {
          const presignedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: bucket,
              Key: item.s3Key,
            }),
            { expiresIn: 3600 }
          );
          return {
            ...item,
            presignedUrl,
          };
        })
      );

      return itemsWithUrls;
    }),

  // Get single media item
  get: activeProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.id, ctx.organizationId);
      const mediaItem = await ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          uploadedBy: true,
          collections: {
            include: { collection: true },
          },
        },
      });

      // Generate presigned URL for accessing the file
      const bucket = s3Config.bucket;
      const presignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: mediaItem.s3Key,
        }),
        { expiresIn: 3600 } // 1 hour
      );

      return {
        ...mediaItem,
        presignedUrl,
      };
    }),

  // Get presigned URL for a media item (useful for refresh)
  getPresignedUrl: activeProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.id, ctx.organizationId);
      const mediaItem = await ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.id },
      });

      const presignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: s3Config.bucket,
          Key: mediaItem.s3Key,
        }),
        { expiresIn: 3600 } // 1 hour
      );

      return { presignedUrl };
    }),

  // Create media item
  create: activeProcedure
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

  // Sauvegarde d'un audio monté depuis le nouvel éditeur audio (port Tanguy).
  // mode 'new'     → crée un nouveau MediaItem (l'original est conservé).
  // mode 'replace' → écrase l'audio d'un MediaItem existant (re-montage).
  // Les repères de montage sont persistés dans waveformData.markers.
  // (distinct de l'ancienne saveEditedAudio base64 de l'éditeur AudioMass.)
  saveMontage: activeProcedure
    .input(
      z.object({
        mode: z.enum(['new', 'replace']),
        mediaId: z.string().optional(),
        title: z.string(),
        s3Key: z.string(),
        s3Url: z.string(),
        fileSize: z.number(),
        duration: z.number(),
        mimeType: z.string().default('audio/mpeg'),
        markers: z.array(z.number()).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newWaveform =
        input.markers && input.markers.length > 0 ? { markers: input.markers } : undefined;

      if (input.mode === 'replace') {
        if (!input.mediaId) {
          throw new Error('mediaId requis pour remplacer un média existant');
        }
        // Contrôle d'appartenance à l'organisation avant tout écrasement.
        const existing = await ctx.db.mediaItem.findFirst({
          where: { id: input.mediaId, organizationId: ctx.organizationId! },
        });
        if (!existing) {
          throw new Error('Média introuvable');
        }
        // Conserve les repères existants si aucun nouveau n'est fourni.
        const existingWaveform = existing.waveformData as { markers?: number[] } | null;
        const mergedWaveform =
          newWaveform ??
          (existingWaveform?.markers ? { markers: existingWaveform.markers } : undefined);
        return ctx.db.mediaItem.update({
          where: { id: input.mediaId },
          data: {
            title: input.title,
            type: 'AUDIO',
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            duration: Math.round(input.duration),
            s3Key: input.s3Key,
            s3Url: input.s3Url,
            ...(mergedWaveform ? { waveformData: mergedWaveform } : {}),
          },
        });
      }

      // mode 'new'
      return ctx.db.mediaItem.create({
        data: {
          title: input.title,
          type: 'AUDIO',
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          duration: Math.round(input.duration),
          s3Key: input.s3Key,
          s3Url: input.s3Url,
          tags: input.tags ?? ['montage'],
          uploadedById: ctx.userId!,
          organizationId: ctx.organizationId!,
          ...(newWaveform ? { waveformData: newWaveform } : {}),
        },
      });
    }),

  // Archiver / désarchiver un média.
  // Les archivés disparaissent des listes par défaut mais restent trouvables
  // via la recherche et l'assistant IA.
  setArchived: activeProcedure
    .input(z.object({ id: z.string(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.mediaItem.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!existing) throw new Error('Média introuvable');
      return ctx.db.mediaItem.update({
        where: { id: input.id },
        data: {
          archived: input.archived,
          archivedAt: input.archived ? new Date() : null,
        },
      });
    }),

  // Update media item
  update: activeProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        duration: z.number().optional(), // Permet de mettre a jour la duree
        tags: z.array(z.string()).optional(),
        transcription: z.string().optional(),
        transcriptionStatus: z
          .enum(['NONE', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'])
          .optional(),
        waveformData: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.id, ctx.organizationId);
      const { id, ...data } = input;
      return ctx.db.mediaItem.update({
        where: { id },
        data,
      });
    }),

  // Delete media item
  delete: activeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.id, ctx.organizationId);
      return ctx.db.mediaItem.delete({
        where: { id: input.id },
      });
    }),

  // List collections
  listCollections: activeProcedure.query(async ({ ctx }) => {
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
  createCollection: activeProcedure
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
  addToCollection: activeProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        collectionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCollectionInOrg(ctx.db, input.collectionId, ctx.organizationId);
      await assertMediaItemInOrg(ctx.db, input.mediaItemId, ctx.organizationId);
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
  removeFromCollection: activeProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        collectionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCollectionInOrg(ctx.db, input.collectionId, ctx.organizationId);
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
  startTranscription: activeProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        languageCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.mediaItemId, ctx.organizationId);
      const mediaItem = await ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.mediaItemId },
      });

      // Check if mime type is supported
      if (!TRANSCRIBABLE_MIME_TYPES.includes(mediaItem.mimeType.toLowerCase())) {
        throw new Error(
          `File type ${mediaItem.mimeType} is not supported for transcription`
        );
      }

      const jobName = `redacnews-${input.mediaItemId}-${Date.now()}`;

      // Start transcription job
      await transcribeClient.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: jobName,
          LanguageCode: (input.languageCode as LanguageCode) || LanguageCode.FR_FR,
          Media: {
            MediaFileUri: `s3://${s3Config.bucket}/${mediaItem.s3Key}`,
          },
          OutputBucketName: s3Config.bucket,
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
  getTranscriptionStatus: activeProcedure
    .input(z.object({ mediaItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.mediaItemId, ctx.organizationId);
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
          const outputKey = `transcriptions/${input.mediaItemId}.json`;

          const s3Response = await s3Client.send(
            new GetObjectCommand({
              Bucket: s3Config.bucket,
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
  isTranscribable: activeProcedure
    .input(z.object({ mimeType: z.string() }))
    .query(({ input }) => {
      return {
        isTranscribable: TRANSCRIBABLE_MIME_TYPES.includes(
          input.mimeType.toLowerCase()
        ),
      };
    }),

  // Save edited audio file
  saveEditedAudio: activeProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        audioData: z.string(), // base64 encoded audio
        format: z.enum(['wav', 'mp3']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertMediaItemInOrg(ctx.db, input.mediaItemId, ctx.organizationId);
      const mediaItem = await ctx.db.mediaItem.findUniqueOrThrow({
        where: { id: input.mediaItemId },
      });

      // Decode base64 audio data
      const audioBuffer = Buffer.from(input.audioData, 'base64');

      // Generate new key for the edited file
      const timestamp = Date.now();
      const extension = input.format === 'wav' ? 'wav' : 'mp3';
      const newKey = `${ctx.organizationId}/media/${timestamp}-edited-${mediaItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;

      const contentType = input.format === 'wav' ? 'audio/wav' : 'audio/mpeg';

      // Upload new file to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Config.bucket,
          Key: newKey,
          Body: audioBuffer,
          ContentType: contentType,
        })
      );

      // Generate public URL
      const publicUrl = cloudfrontConfig.domain
        ? `https://${cloudfrontConfig.domain}/${newKey}`
        : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${newKey}`;

      // Update media item with new file
      const updatedMedia = await ctx.db.mediaItem.update({
        where: { id: input.mediaItemId },
        data: {
          s3Key: newKey,
          s3Url: publicUrl,
          fileSize: audioBuffer.length,
          mimeType: contentType,
          // Reset transcription since content changed
          transcription: null,
          transcriptionStatus: 'NONE',
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        mediaItem: updatedMedia,
      };
    }),
});
