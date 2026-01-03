import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  replaceVariables,
  prepareVariableValues,
  validateVariables,
  type TemplateVariable,
} from '../lib/template-utils';

// Schema pour les variables de template
const templateVariableSchema = z.object({
  name: z.string(),
  label: z.string(),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
});

export const templateRouter = router({
  // Lister les templates de l'organisation
  list: protectedProcedure
    .input(
      z.object({
        showId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.rundownTemplate.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.showId && { showId: input.showId }),
        },
        include: {
          show: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    }),

  // Récupérer un template avec ses items
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.rundownTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
          },
        },
      });

      // Calculer la durée totale
      const totalDuration = template.items.reduce(
        (sum, item) => sum + item.duration,
        0
      );

      return {
        ...template,
        totalDuration,
      };
    }),

  // Créer un template
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Le nom est requis'),
        description: z.string().optional(),
        showId: z.string(),
        isDefault: z.boolean().optional().default(false),
        variables: z.array(templateVariableSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Si ce template est défini comme default, retirer le flag des autres templates de cette émission
      if (input.isDefault) {
        await ctx.db.rundownTemplate.updateMany({
          where: {
            showId: input.showId,
            organizationId: ctx.organizationId!,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      return ctx.db.rundownTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          showId: input.showId,
          isDefault: input.isDefault,
          variables: input.variables ?? [],
          organizationId: ctx.organizationId!,
        },
        include: {
          show: true,
        },
      });
    }),

  // Mettre à jour un template
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        isDefault: z.boolean().optional(),
        variables: z.array(templateVariableSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Récupérer le template pour vérifier l'appartenance
      const template = await ctx.db.rundownTemplate.findUniqueOrThrow({
        where: { id },
      });

      // Si ce template devient default, retirer le flag des autres
      if (data.isDefault) {
        await ctx.db.rundownTemplate.updateMany({
          where: {
            showId: template.showId,
            organizationId: ctx.organizationId!,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      return ctx.db.rundownTemplate.update({
        where: { id },
        data,
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
          },
        },
      });
    }),

  // Ajouter un item au template
  addItem: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
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
        duration: z.number().min(0),
        position: z.number().optional(),
        notes: z.string().optional(),
        script: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { templateId, position, ...data } = input;

      // Si pas de position, ajouter à la fin
      const lastItem = await ctx.db.rundownTemplateItem.findFirst({
        where: { templateId },
        orderBy: { position: 'desc' },
      });

      return ctx.db.rundownTemplateItem.create({
        data: {
          ...data,
          templateId,
          position: position ?? (lastItem?.position ?? -1) + 1,
        },
      });
    }),

  // Mettre à jour un item du template
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        type: z
          .enum([
            'STORY',
            'INTERVIEW',
            'JINGLE',
            'MUSIC',
            'LIVE',
            'BREAK',
            'OTHER',
          ])
          .optional(),
        title: z.string().optional(),
        duration: z.number().min(0).optional(),
        position: z.number().optional(),
        notes: z.string().nullable().optional(),
        script: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.rundownTemplateItem.update({
        where: { id },
        data,
      });
    }),

  // Supprimer un item du template
  deleteItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.rundownTemplateItem.delete({
        where: { id: input.id },
      });
    }),

  // Réordonner les items du template
  reorderItems: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        itemIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = input.itemIds.map((id, index) =>
        ctx.db.rundownTemplateItem.update({
          where: { id },
          data: { position: index },
        })
      );
      await ctx.db.$transaction(updates);
      return { success: true };
    }),

  // Créer un conducteur depuis un template
  createRundownFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        date: z.date(),
        variables: z.record(z.string()).optional(),
        createGoogleDocs: z.boolean().optional().default(true), // Creer les Google Docs pour les elements avec script
        // Map des templateItemId -> storyId pour les sujets existants à lier
        existingStories: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Récupérer le template avec ses items et l'emission associée
      const template = await ctx.db.rundownTemplate.findUniqueOrThrow({
        where: { id: input.templateId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
          },
        },
      });

      // 2. Valider les variables si le template en définit
      const templateVariables = (template.variables as unknown as TemplateVariable[]) || [];
      const providedVariables = input.variables || {};

      if (templateVariables.length > 0) {
        const validation = validateVariables(templateVariables, providedVariables);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }
      }

      // 3. Préparer les valeurs des variables (avec defaults)
      const variableValues = prepareVariableValues(
        templateVariables,
        providedVariables
      );

      // 4. Créer le conducteur avec le startTime du show
      const rundown = await ctx.db.rundown.create({
        data: {
          showId: template.showId,
          date: input.date,
          status: 'DRAFT',
          startTime: template.show.startTime, // Hériter du startTime du show
        },
      });

      // 5. Créer les items - d'abord préparer les données sans appels API externes
      const existingStories = input.existingStories || {};
      const itemsToCreate: Array<{
        templateItem: typeof template.items[0];
        itemTitle: string;
        itemScript: string | null;
        itemNotes: string | null;
        storyId: string | null;
        googleDocId: string | null;
        googleDocUrl: string | null;
        finalTitle: string;
        finalDuration: number;
        needsNewStory: boolean;
        storyCategory?: string;
      }> = [];

      // Préparer tous les items
      for (const templateItem of template.items) {
        const itemTitle = replaceVariables(templateItem.title, variableValues) || templateItem.title;
        const itemScript = replaceVariables(templateItem.script, variableValues);
        const itemNotes = replaceVariables(templateItem.notes, variableValues);

        let storyId: string | null = null;
        let googleDocId: string | null = null;
        let googleDocUrl: string | null = null;
        let finalTitle = itemTitle;
        let finalDuration = templateItem.duration;
        let needsNewStory = false;
        let storyCategory: string | undefined;

        // Pour les éléments de type STORY
        if (templateItem.type === 'STORY') {
          const existingStoryId = existingStories[templateItem.id];

          if (existingStoryId) {
            // Utiliser le sujet existant
            const existingStory = await ctx.db.story.findUnique({
              where: { id: existingStoryId },
            });
            if (existingStory) {
              storyId = existingStory.id;
              googleDocId = existingStory.googleDocId;
              googleDocUrl = existingStory.googleDocUrl;
              finalTitle = existingStory.title;
              if (existingStory.estimatedDuration) {
                finalDuration = existingStory.estimatedDuration;
              }
            }
          } else {
            // Marquer qu'on devra créer une Story
            needsNewStory = true;
            const showName = template.show.name.toLowerCase();
            if (itemTitle.toLowerCase().includes('sommaire')) {
              if (showName.includes('07h') || showName.includes('7h')) {
                storyCategory = 'Sommaire 07h';
              } else if (showName.includes('08h') || showName.includes('8h')) {
                storyCategory = 'Sommaire 08h';
              }
            }
          }
        }

        itemsToCreate.push({
          templateItem,
          itemTitle,
          itemScript,
          itemNotes,
          storyId,
          googleDocId,
          googleDocUrl,
          finalTitle,
          finalDuration,
          needsNewStory,
          storyCategory,
        });
      }

      // 6. Créer les Stories nécessaires (sans Google Docs pour l'instant - ils seront créés à la demande)
      for (const item of itemsToCreate) {
        if (item.needsNewStory) {
          const slug = item.itemTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

          const story = await ctx.db.story.create({
            data: {
              title: item.itemTitle,
              slug: `${slug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              authorId: ctx.userId!,
              organizationId: ctx.organizationId!,
              category: item.storyCategory,
              content: item.itemScript || undefined,
              estimatedDuration: item.templateItem.duration,
              tags: [],
            },
          });

          item.storyId = story.id;
          item.finalTitle = item.itemTitle;
        }
      }

      // 7. Créer tous les RundownItems en batch
      const rundownItemsData = itemsToCreate.map((item) => ({
        rundownId: rundown.id,
        type: item.templateItem.type,
        title: item.finalTitle,
        duration: item.finalDuration,
        position: item.templateItem.position,
        notes: item.itemNotes,
        script: item.itemScript,
        status: 'PENDING' as const,
        storyId: item.storyId,
        googleDocId: item.googleDocId,
        googleDocUrl: item.googleDocUrl,
      }));

      await ctx.db.rundownItem.createMany({
        data: rundownItemsData,
      });

      // Note: Les Google Docs pour les Stories seront créés à la demande
      // via story.createWithGoogleDoc ou rundown.createItemDoc pour éviter les timeouts

      // 6. Retourner le conducteur créé avec ses items
      return ctx.db.rundown.findUniqueOrThrow({
        where: { id: rundown.id },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
          },
        },
      });
    }),

  // Créer un template depuis un conducteur existant
  createFromRundown: protectedProcedure
    .input(
      z.object({
        rundownId: z.string(),
        name: z.string().min(1, 'Le nom est requis'),
        description: z.string().optional(),
        variables: z.array(templateVariableSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Récupérer le conducteur avec ses items
      const rundown = await ctx.db.rundown.findUniqueOrThrow({
        where: { id: input.rundownId },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
          },
        },
      });

      // 2. Créer le template
      const template = await ctx.db.rundownTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          showId: rundown.showId,
          variables: input.variables ?? [],
          organizationId: ctx.organizationId!,
        },
      });

      // 3. Copier les items
      const itemsData = rundown.items.map((item) => ({
        templateId: template.id,
        type: item.type,
        title: item.title,
        duration: item.duration,
        position: item.position,
        notes: item.notes,
        script: item.script,
      }));

      await ctx.db.rundownTemplateItem.createMany({
        data: itemsData,
      });

      // 4. Retourner le template créé avec ses items
      return ctx.db.rundownTemplate.findUniqueOrThrow({
        where: { id: template.id },
        include: {
          show: true,
          items: {
            orderBy: { position: 'asc' },
          },
        },
      });
    }),

  // Supprimer un template
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Les items seront supprimés en cascade grâce à onDelete: Cascade
      return ctx.db.rundownTemplate.delete({
        where: { id: input.id },
      });
    }),
});
