import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { router, protectedProcedure } from '../trpc';
import { awsConfig, s3Config } from '../lib/aws-config';

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

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
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
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
              // Conducteur lie (imbrique) avec infos pour l'indicateur de statut
              linkedRundown: {
                select: {
                  id: true,
                  status: true,
                  show: {
                    select: {
                      id: true,
                      name: true,
                      color: true,
                    },
                  },
                  items: {
                    select: {
                      id: true,
                      script: true,
                      googleDocId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Synchroniser le titre, la durée et le statut depuis la Story liée si présente
      // ET synchroniser la durée depuis le conducteur lié (imbriqué) si présent
      // Cela garantit que le conducteur reflète toujours les données actuelles

      // Mapping des statuts Story -> ItemStatus
      const storyStatusToItemStatus: Record<string, 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE'> = {
        DRAFT: 'PENDING',
        IN_REVIEW: 'IN_PROGRESS',
        APPROVED: 'READY',
        PUBLISHED: 'READY',
        ARCHIVED: 'DONE',
      };

      const itemsToUpdate: { id: string; title: string; duration: number; status?: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE' }[] = [];

      for (const item of rundown.items) {
        let needsUpdate = false;
        let newTitle = item.title;
        let newDuration = item.duration;
        let newStatus: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ON_AIR' | 'DONE' | undefined;

        // 1. Synchroniser depuis la Story liée
        if (item.story) {
          const storyTitle = item.story.title;
          // Calculer la durée totale = temps de lecture + durée des médias audio
          const readingDuration = item.story.estimatedDuration || 0;
          const mediaDuration = item.story.media
            ?.filter((m) => m.mediaItem.type === 'AUDIO' && m.mediaItem.duration)
            .reduce((sum, m) => sum + (m.mediaItem.duration || 0), 0) || 0;
          const storyDuration = readingDuration + mediaDuration;
          const mappedStatus = storyStatusToItemStatus[item.story.status];

          // Vérifier si une mise à jour est nécessaire
          if (storyTitle && item.title !== storyTitle) {
            newTitle = storyTitle;
            needsUpdate = true;
          }
          if (storyDuration > 0 && item.duration !== storyDuration) {
            newDuration = storyDuration;
            needsUpdate = true;
          }
          // Ne mettre à jour le statut que si l'item n'est pas déjà ON_AIR ou DONE (statuts manuels)
          if (mappedStatus &&
            item.status !== 'ON_AIR' &&
            item.status !== 'DONE' &&
            item.status !== mappedStatus) {
            newStatus = mappedStatus;
            needsUpdate = true;
          }
        }

        // 2. Synchroniser la durée depuis le conducteur lié (imbriqué)
        // La durée réelle du conducteur lié prévaut sur la durée théorique du template
        if (item.linkedRundown) {
          // Récupérer la durée totale des items du conducteur lié
          const linkedRundownWithDurations = await ctx.db.rundown.findUnique({
            where: { id: item.linkedRundown.id },
            include: {
              items: {
                select: { duration: true },
              },
            },
          });

          if (linkedRundownWithDurations) {
            const linkedTotalDuration = linkedRundownWithDurations.items.reduce(
              (sum, linkedItem) => sum + linkedItem.duration,
              0
            );

            // Mettre à jour si la durée diffère
            if (item.duration !== linkedTotalDuration) {
              newDuration = linkedTotalDuration;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          itemsToUpdate.push({
            id: item.id,
            title: newTitle,
            duration: newDuration,
            ...(newStatus && { status: newStatus }),
          });
        }
      }

      // Appliquer les mises à jour en batch si nécessaire
      if (itemsToUpdate.length > 0) {
        await ctx.db.$transaction(
          itemsToUpdate.map((update) =>
            ctx.db.rundownItem.update({
              where: { id: update.id },
              data: {
                title: update.title,
                duration: update.duration,
                ...(update.status && { status: update.status }),
              },
            })
          )
        );

        // Mettre à jour les items en mémoire pour refléter les changements
        for (const update of itemsToUpdate) {
          const item = rundown.items.find((i) => i.id === update.id);
          if (item) {
            item.title = update.title;
            item.duration = update.duration;
            if (update.status) {
              item.status = update.status;
            }
          }
        }
      }

      return rundown;
    }),

  // Get single rundown item with script
  getItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.id },
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
                  s3Url: true,
                },
              },
            },
            orderBy: { position: 'asc' },
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

  // Update rundown info (extended fields)
  updateInfo: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        location: z.string().optional(),
        locationAddress: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
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

  // Add team member to rundown
  addTeamMember: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        role: z.enum([
          'PRESENTER',
          'CO_PRESENTER',
          'STUDIO_HOST',
          'TECHNICIAN',
          'JOURNALIST',
          'MAIN_GUEST',
          'OTHER',
        ]),
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { rundownId, ...memberData } = input;

      // Get the highest position
      const lastMember = await ctx.db.rundownTeamMember.findFirst({
        where: { rundownId },
        orderBy: { position: 'desc' },
      });

      return ctx.db.rundownTeamMember.create({
        data: {
          rundownId,
          ...memberData,
          position: (lastMember?.position ?? -1) + 1,
        },
      });
    }),

  // Delete rundown
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier que le conducteur appartient à l'organisation
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.id },
        include: { show: true },
      });

      if (rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Supprimer le conducteur (cascade supprime les items)
      await ctx.db.rundown.delete({
        where: { id: input.id },
      });

      return { success: true };
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

      // Creer l'item
      const item = await ctx.db.rundownItem.create({
        data: {
          ...data,
          rundownId,
          position: position ?? (lastItem?.position ?? 0) + 1,
        },
        include: { rundown: { include: { show: true } } },
      });

      // Si c'est un type avec texte, creer automatiquement un Google Doc
      const typesWithScript = ['STORY', 'INTERVIEW', 'LIVE', 'OTHER'];
      if (typesWithScript.includes(input.type)) {
        try {
          const { createStoryDoc } = await import('../lib/google/docs');
          const docTitle = `${item.rundown.show.name} - ${item.title}`;
          const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
          const doc = await createStoryDoc(docTitle, folderId);

          const updatedItem = await ctx.db.rundownItem.update({
            where: { id: item.id },
            data: {
              googleDocId: doc.id,
              googleDocUrl: doc.url,
            },
          });

          return updatedItem;
        } catch (error) {
          console.error('Failed to create Google Doc for new item:', error);
          // Continuer meme si la creation echoue - l'utilisateur pourra creer le doc plus tard
        }
      }

      return item;
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
        script: z.string().nullable().optional(),
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
        category: z.enum(['FLASH', 'JOURNAL', 'MAGAZINE', 'CHRONIQUE', 'AUTRE']).optional(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), // Format HH:mm
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

  // Update show
  updateShow: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        defaultDuration: z.number().optional(),
        color: z.string().optional(),
        category: z.enum(['FLASH', 'JOURNAL', 'MAGAZINE', 'CHRONIQUE', 'AUTRE']).optional(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), // Format HH:mm
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.show.update({
        where: { id },
        data,
      });
    }),

  // Generate script Google Doc
  generateScript: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        regenerate: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Recuperer le conducteur complet avec tous les details
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
                  estimatedDuration: true,
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
                      transcription: true,
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
              // Conducteur lié (imbriqué) avec ses items pour le script
              linkedRundown: {
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
                              id: true,
                              title: true,
                              type: true,
                              duration: true,
                              transcription: true,
                            },
                          },
                        },
                        orderBy: { position: 'asc' },
                      },
                    },
                  },
                },
              },
              // Assignee pour afficher le présentateur du conducteur lié
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

      // 2. Si un script existe deja et qu'on ne force pas la regeneration, retourner l'existant
      if (rundown.scriptDocId && !input.regenerate) {
        return {
          id: rundown.id,
          scriptDocId: rundown.scriptDocId,
          scriptDocUrl: rundown.scriptDocUrl,
          scriptGeneratedAt: rundown.scriptGeneratedAt,
          isNew: false,
        };
      }

      // 3. Generer le nouveau script
      try {
        const { createRundownScript } = await import('../lib/google/rundown-script');

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const doc = await createRundownScript(rundown, folderId);

        // 4. Sauvegarder la reference
        const updated = await ctx.db.rundown.update({
          where: { id: input.rundownId },
          data: {
            scriptDocId: doc.id,
            scriptDocUrl: doc.url,
            scriptGeneratedAt: new Date(),
          },
        });

        return {
          id: updated.id,
          scriptDocId: updated.scriptDocId,
          scriptDocUrl: updated.scriptDocUrl,
          scriptGeneratedAt: updated.scriptGeneratedAt,
          isNew: true,
        };
      } catch (error) {
        console.error('Failed to generate script:', error);
        throw new Error('Impossible de generer le script. Verifiez la configuration Google.');
      }
    }),

  // Get script info for a rundown
  getScript: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        select: {
          scriptDocId: true,
          scriptDocUrl: true,
          scriptGeneratedAt: true,
        },
      });

      return rundown;
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

  // Create/link a Google Doc for a rundown item script
  createItemDoc: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        initialContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.itemId },
        include: { rundown: { include: { show: true } } },
      });

      // If a doc already exists, return it
      if (item.googleDocId) {
        return {
          googleDocId: item.googleDocId,
          googleDocUrl: item.googleDocUrl,
          isNew: false,
        };
      }

      // Create the Google Doc
      const { createStoryDoc, insertTextInDoc } = await import('../lib/google/docs');

      const docTitle = `${item.rundown.show.name} - ${item.title}`;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      const doc = await createStoryDoc(docTitle, folderId);

      // If initial content provided (from template), insert it into the doc
      if (input.initialContent) {
        await insertTextInDoc(doc.id, input.initialContent);
      }

      // Save the reference
      const updated = await ctx.db.rundownItem.update({
        where: { id: input.itemId },
        data: {
          googleDocId: doc.id,
          googleDocUrl: doc.url,
        },
      });

      return {
        googleDocId: updated.googleDocId,
        googleDocUrl: updated.googleDocUrl,
        isNew: true,
      };
    }),

  // Sync Google Doc content to script field (for backup/prompter)
  syncItemDoc: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.itemId },
      });

      if (!item.googleDocId) {
        throw new Error('Pas de Google Doc associe');
      }

      const { getDocContent } = await import('../lib/google/docs');
      const content = await getDocContent(item.googleDocId);

      return ctx.db.rundownItem.update({
        where: { id: input.itemId },
        data: { script: content },
      });
    }),

  // === CONDUCTEURS IMBRIQUES ===

  // Lier un conducteur existant a un element
  linkRundownToItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        linkedRundownId: z.string().nullable(), // null pour supprimer le lien
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Recuperer l'item pour avoir le rundownId parent
      const item = await ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.itemId },
        include: {
          rundown: {
            select: { id: true, scriptDocId: true },
          },
        },
      });

      // Si on lie un conducteur, verifier qu'il existe et appartient a la meme organisation
      if (input.linkedRundownId) {
        const linkedRundown = await ctx.db.rundown.findUniqueOrThrow({
          where: { id: input.linkedRundownId },
          include: { show: true },
        });

        // Verifier que le conducteur lie est dans la meme organisation
        if (linkedRundown.show.organizationId !== ctx.organizationId) {
          throw new Error('Le conducteur doit appartenir a la meme organisation');
        }

        // Verifier qu'on ne cree pas de boucle (l'element ne peut pas pointer vers son propre conducteur)
        if (item.rundownId === input.linkedRundownId) {
          throw new Error('Un element ne peut pas pointer vers son propre conducteur');
        }
      }

      // Mettre a jour l'element
      const updatedItem = await ctx.db.rundownItem.update({
        where: { id: input.itemId },
        data: { linkedRundownId: input.linkedRundownId },
        include: {
          linkedRundown: {
            include: {
              show: true,
            },
          },
        },
      });

      // Si le conducteur parent a un Google Doc script, le mettre a jour
      if (item.rundown.scriptDocId) {
        try {
          const { updateRundownScript } = await import('../lib/google/rundown-script');

          // Recuperer les donnees completes du conducteur parent
          const parentRundown = await ctx.db.rundown.findUniqueOrThrow({
            where: { id: item.rundownId },
            include: {
              show: true,
              items: {
                orderBy: { position: 'asc' },
                include: {
                  story: true,
                  assignee: true,
                  media: {
                    include: { mediaItem: true },
                  },
                  linkedRundown: {
                    include: {
                      show: true,
                      items: {
                        orderBy: { position: 'asc' },
                        include: {
                          story: true,
                          media: {
                            include: { mediaItem: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          // Mettre a jour le Google Doc
          await updateRundownScript(item.rundown.scriptDocId, parentRundown);
        } catch (error) {
          // Ne pas bloquer si la mise a jour du Google Doc echoue
          console.error('Erreur lors de la mise a jour du Google Doc script:', error);
        }
      }

      return updatedItem;
    }),

  // Creer un conducteur enfant et le lier automatiquement a un element
  createLinkedRundown: protectedProcedure
    .input(
      z.object({
        parentItemId: z.string(), // L'element parent qui contiendra le lien
        showId: z.string(), // L'emission du conducteur enfant (ex: Flash Info)
        date: z.date(),
        templateId: z.string().optional(), // Optionnel: creer depuis un template
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verifier que l'emission existe et appartient a l'organisation
      const show = await ctx.db.show.findUniqueOrThrow({
        where: { id: input.showId },
      });

      if (show.organizationId !== ctx.organizationId) {
        throw new Error("L'emission doit appartenir a votre organisation");
      }

      // Creer le conducteur enfant
      let childRundown;

      if (input.templateId) {
        // Importer les utils de template
        const { applyTemplate } = await import('../lib/template-utils');

        // Recuperer le template
        const template = await ctx.db.rundownTemplate.findUniqueOrThrow({
          where: { id: input.templateId },
          include: { items: { orderBy: { position: 'asc' } } },
        });

        // Creer le conducteur
        childRundown = await ctx.db.rundown.create({
          data: {
            showId: input.showId,
            date: input.date,
          },
        });

        // Appliquer le template
        const variables: Record<string, string> = {};
        await applyTemplate(ctx.db, childRundown.id, template, variables);
      } else {
        // Creer un conducteur vide
        childRundown = await ctx.db.rundown.create({
          data: {
            showId: input.showId,
            date: input.date,
          },
        });
      }

      // Recuperer l'item parent avec son conducteur
      const parentItem = await ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.parentItemId },
        include: {
          rundown: {
            select: { id: true, scriptDocId: true },
          },
        },
      });

      // Lier au parent
      await ctx.db.rundownItem.update({
        where: { id: input.parentItemId },
        data: { linkedRundownId: childRundown.id },
      });

      // Si le conducteur parent a un Google Doc script, le mettre a jour
      if (parentItem.rundown.scriptDocId) {
        try {
          const { updateRundownScript } = await import('../lib/google/rundown-script');

          // Recuperer les donnees completes du conducteur parent
          const parentRundown = await ctx.db.rundown.findUniqueOrThrow({
            where: { id: parentItem.rundownId },
            include: {
              show: true,
              items: {
                orderBy: { position: 'asc' },
                include: {
                  story: true,
                  assignee: true,
                  media: {
                    include: { mediaItem: true },
                  },
                  linkedRundown: {
                    include: {
                      show: true,
                      items: {
                        orderBy: { position: 'asc' },
                        include: {
                          story: true,
                          media: {
                            include: { mediaItem: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          // Mettre a jour le Google Doc
          await updateRundownScript(parentItem.rundown.scriptDocId, parentRundown);
        } catch (error) {
          console.error('Erreur lors de la mise a jour du Google Doc script:', error);
        }
      }

      return ctx.db.rundown.findUniqueOrThrow({
        where: { id: childRundown.id },
        include: { show: true },
      });
    }),

  // Liste des conducteurs disponibles pour liaison (meme date +/- 1 jour)
  listAvailableForLinking: protectedProcedure
    .input(
      z.object({
        currentRundownId: z.string(), // Pour exclure le conducteur actuel
        date: z.date(), // Date de reference
      })
    )
    .query(async ({ ctx, input }) => {
      // Calculer la plage de dates (+/- 1 jour)
      const dateFrom = new Date(input.date);
      dateFrom.setDate(dateFrom.getDate() - 1);
      const dateTo = new Date(input.date);
      dateTo.setDate(dateTo.getDate() + 1);

      return ctx.db.rundown.findMany({
        where: {
          show: { organizationId: ctx.organizationId! },
          id: { not: input.currentRundownId },
          date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        include: {
          show: true,
        },
        orderBy: [{ date: 'asc' }, { show: { name: 'asc' } }],
      });
    }),

  // Get all media files from a rundown (for download)
  getRundownMedia: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
            include: {
              // Media directement sur l'item
              media: {
                include: {
                  mediaItem: {
                    select: {
                      id: true,
                      title: true,
                      type: true,
                      duration: true,
                      s3Key: true,
                      mimeType: true,
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
              // Media lies au sujet
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
                          s3Key: true,
                          mimeType: true,
                        },
                      },
                    },
                    orderBy: { position: 'asc' },
                  },
                },
              },
              // Conducteur lie (imbrique) avec ses medias
              linkedRundown: {
                include: {
                  items: {
                    orderBy: { position: 'asc' },
                    include: {
                      media: {
                        include: {
                          mediaItem: {
                            select: {
                              id: true,
                              title: true,
                              type: true,
                              duration: true,
                              s3Key: true,
                              mimeType: true,
                            },
                          },
                        },
                        orderBy: { position: 'asc' },
                      },
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
                                  s3Key: true,
                                  mimeType: true,
                                },
                              },
                            },
                            orderBy: { position: 'asc' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Collecter tous les medias audio
      const mediaMap = new Map<string, {
        id: string;
        title: string;
        duration: number | null;
        s3Key: string;
        mimeType: string;
        itemTitle: string;
        position: number;
      }>();

      let position = 0;

      const collectMedia = (items: typeof rundown.items, prefix = '') => {
        for (const item of items) {
          const itemTitle = prefix ? `${prefix} - ${item.title}` : item.title;

          // Media directement sur l'item
          for (const m of item.media) {
            if (m.mediaItem.type === 'AUDIO' && !mediaMap.has(m.mediaItem.id)) {
              mediaMap.set(m.mediaItem.id, {
                id: m.mediaItem.id,
                title: m.mediaItem.title,
                duration: m.mediaItem.duration,
                s3Key: m.mediaItem.s3Key,
                mimeType: m.mediaItem.mimeType,
                itemTitle,
                position: position++,
              });
            }
          }

          // Media lies au sujet
          if (item.story) {
            for (const m of item.story.media) {
              if (m.mediaItem.type === 'AUDIO' && !mediaMap.has(m.mediaItem.id)) {
                mediaMap.set(m.mediaItem.id, {
                  id: m.mediaItem.id,
                  title: m.mediaItem.title,
                  duration: m.mediaItem.duration,
                  s3Key: m.mediaItem.s3Key,
                  mimeType: m.mediaItem.mimeType,
                  itemTitle,
                  position: position++,
                });
              }
            }
          }

          // Conducteur lie (imbrique)
          if (item.linkedRundown) {
            collectMedia(item.linkedRundown.items as typeof rundown.items, itemTitle);
          }
        }
      };

      collectMedia(rundown.items);

      // Generer des URLs presignees pour chaque media (pour download)
      const mediaList = Array.from(mediaMap.values()).sort((a, b) => a.position - b.position);

      const mediaWithPresignedUrls = await Promise.all(
        mediaList.map(async (media) => {
          const presignedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: s3Config.bucket,
              Key: media.s3Key,
            }),
            { expiresIn: 3600 } // 1 heure
          );
          return {
            id: media.id,
            title: media.title,
            duration: media.duration,
            s3Url: presignedUrl, // URL presignee pour le telechargement
            mimeType: media.mimeType,
            itemTitle: media.itemTitle,
            position: media.position,
          };
        })
      );

      return {
        rundownTitle: rundown.show.name,
        rundownDate: rundown.date,
        media: mediaWithPresignedUrls,
      };
    }),

  // Create complete rundown with team and items
  createComplete: protectedProcedure
    .input(
      z.object({
        showId: z.string(),
        date: z.date(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        location: z.string().optional(),
        locationAddress: z.string().optional(),
        notes: z.string().optional(),
        team: z.array(
          z.object({
            role: z.enum([
              'PRESENTER',
              'CO_PRESENTER',
              'STUDIO_HOST',
              'TECHNICIAN',
              'JOURNALIST',
              'MAIN_GUEST',
              'OTHER',
            ]),
            name: z.string(),
            phone: z.string().optional(),
            email: z.string().optional(),
            location: z.string().optional(),
          })
        ),
        items: z.array(
          z.object({
            type: z.enum(['STORY', 'INTERVIEW', 'JINGLE', 'MUSIC', 'LIVE', 'BREAK', 'OTHER']),
            title: z.string(),
            duration: z.number(),
            startTime: z.string().optional(),
            notes: z.string().optional(),
            guests: z
              .array(
                z.object({
                  name: z.string(),
                  phone: z.string().optional(),
                  email: z.string().optional(),
                  title: z.string().optional(),
                  organization: z.string().optional(),
                  description: z.string().optional(),
                })
              )
              .optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { team, items, ...rundownData } = input;

      // Create the rundown
      const rundown = await ctx.db.rundown.create({
        data: rundownData,
      });

      // Create team members
      if (team && team.length > 0) {
        await ctx.db.rundownTeamMember.createMany({
          data: team
            .filter((m) => m.name.trim())
            .map((member, index) => ({
              rundownId: rundown.id,
              role: member.role,
              name: member.name,
              phone: member.phone || null,
              email: member.email || null,
              location: member.location || null,
              position: index,
            })),
        });
      }

      // Create items with guests
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const createdItem = await ctx.db.rundownItem.create({
          data: {
            rundownId: rundown.id,
            type: item.type,
            title: item.title,
            duration: item.duration,
            position: i,
            notes: item.notes || null,
          },
        });

        // Create guests for this item
        if (item.guests && item.guests.length > 0) {
          await ctx.db.rundownItemGuest.createMany({
            data: item.guests
              .filter((g) => g.name.trim())
              .map((guest, gIndex) => ({
                rundownItemId: createdItem.id,
                name: guest.name,
                phone: guest.phone || null,
                email: guest.email || null,
                title: guest.title || null,
                organization: guest.organization || null,
                description: guest.description || null,
                position: gIndex,
              })),
          });
        }
      }

      return rundown;
    }),

  // === SYNCHRONISATION GOOGLE DOCS ===

  // Synchroniser les durees depuis les Google Docs des sujets lies
  // Met a jour les durees des items en fonction du contenu des Google Docs
  // - Pour les FLASH/JOURNAL: seul le texte en gras compte (lancement/pied)
  // - Pour les MAGAZINE/CHRONIQUE/AUTRE: tout le texte compte sauf marqueurs techniques [...]
  syncFromGoogleDocs: protectedProcedure
    .input(z.object({ rundownId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { estimateDocReadingDurationByMode, getDurationModeFromCategory } = await import('../lib/google/docs');

      // Recuperer le conducteur avec ses items et sujets lies
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            include: {
              story: {
                select: {
                  id: true,
                  googleDocId: true,
                  estimatedDuration: true,
                },
              },
            },
          },
        },
      });

      // Verifier les droits
      if (rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Determiner le mode de calcul en fonction de la categorie du Show
      const durationMode = getDurationModeFromCategory(rundown.show.category);

      const updates: Array<{ itemId: string; storyId: string; duration: number; wordCount: number; mode: string }> = [];

      // Pour chaque item avec un sujet lie ayant un Google Doc
      for (const item of rundown.items) {
        if (item.story?.googleDocId) {
          try {
            const { duration, wordCount, mode } = await estimateDocReadingDurationByMode(
              item.story.googleDocId,
              durationMode
            );

            // Mettre a jour la duree estimee du sujet
            await ctx.db.story.update({
              where: { id: item.story.id },
              data: { estimatedDuration: duration },
            });

            // Mettre a jour la duree de l'item du conducteur
            await ctx.db.rundownItem.update({
              where: { id: item.id },
              data: { duration },
            });

            updates.push({
              itemId: item.id,
              storyId: item.story.id,
              duration,
              wordCount,
              mode,
            });
          } catch (error) {
            console.error(`Erreur sync Google Doc pour item ${item.id}:`, error);
            // Continuer avec les autres items
          }
        }
      }

      return {
        rundownId: input.rundownId,
        updatedItems: updates.length,
        updates,
        durationMode, // Indiquer le mode utilise pour le feedback
      };
    }),

  // Synchroniser un seul item depuis son Google Doc
  // Utilise le mode de calcul en fonction de la categorie du Show parent
  syncItemFromGoogleDoc: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { estimateDocReadingDurationByMode, getDurationModeFromCategory } = await import('../lib/google/docs');

      // Recuperer l'item avec son sujet
      const item = await ctx.db.rundownItem.findUniqueOrThrow({
        where: { id: input.itemId },
        include: {
          rundown: {
            include: { show: true },
          },
          story: {
            select: {
              id: true,
              googleDocId: true,
            },
          },
        },
      });

      // Verifier les droits
      if (item.rundown.show.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (!item.story?.googleDocId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "Cet element n'a pas de Google Doc lie",
        });
      }

      // Determiner le mode de calcul en fonction de la categorie du Show
      const durationMode = getDurationModeFromCategory(item.rundown.show.category);

      const { duration, wordCount, usedBoldOnly, mode } = await estimateDocReadingDurationByMode(
        item.story.googleDocId,
        durationMode
      );

      // Mettre a jour la duree estimee du sujet
      await ctx.db.story.update({
        where: { id: item.story.id },
        data: { estimatedDuration: duration },
      });

      // Mettre a jour la duree de l'item
      const updatedItem = await ctx.db.rundownItem.update({
        where: { id: item.id },
        data: { duration },
        include: {
          story: true,
        },
      });

      return {
        item: updatedItem,
        duration,
        wordCount,
        usedBoldOnly,
        durationMode: mode,
      };
    }),
});
