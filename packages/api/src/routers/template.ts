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

      // 4. Créer le conducteur
      const rundown = await ctx.db.rundown.create({
        data: {
          showId: template.showId,
          date: input.date,
          status: 'DRAFT',
        },
      });

      // 5. Créer tous les items en remplaçant les variables
      const itemsData = template.items.map((item) => ({
        rundownId: rundown.id,
        type: item.type,
        title: replaceVariables(item.title, variableValues) || item.title,
        duration: item.duration,
        position: item.position,
        notes: replaceVariables(item.notes, variableValues),
        script: replaceVariables(item.script, variableValues),
        status: 'PENDING' as const,
      }));

      await ctx.db.rundownItem.createMany({
        data: itemsData,
      });

      // 6. Récupérer les items créés
      const createdItems = await ctx.db.rundownItem.findMany({
        where: { rundownId: rundown.id },
        orderBy: { position: 'asc' },
      });

      // 7. Créer les Google Docs pour les éléments qui ont du script
      if (input.createGoogleDocs) {
        const itemsWithScript = createdItems.filter((item) => item.script);

        for (const item of itemsWithScript) {
          try {
            const { createStoryDoc, insertTextInDoc } = await import(
              '../lib/google/docs'
            );

            const docTitle = `${template.show.name} - ${item.title}`;
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
            const doc = await createStoryDoc(docTitle, folderId);

            if (item.script) {
              await insertTextInDoc(doc.id, item.script);
            }

            await ctx.db.rundownItem.update({
              where: { id: item.id },
              data: {
                googleDocId: doc.id,
                googleDocUrl: doc.url,
              },
            });
          } catch (error) {
            console.error(`Failed to create doc for item ${item.id}:`, error);
            // Continuer même si un doc échoue
          }
        }
      }

      // 8. Retourner le conducteur créé avec ses items
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
