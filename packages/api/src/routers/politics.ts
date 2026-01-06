import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Enums Zod pour validation
const ElectionTypeEnum = z.enum([
  'MUNICIPALES',
  'LEGISLATIVES',
  'PRESIDENTIELLE',
  'EUROPEENNES',
  'REGIONALES',
  'DEPARTEMENTALES',
  'SENATORIALES',
  'OTHER',
]);

const PoliticalFamilyEnum = z.enum([
  'EXG',
  'GAU',
  'ECO',
  'CEN',
  'DRO',
  'EXD',
  'DIV',
  'AUT',
]);

// Seuils pour les alertes
const THRESHOLDS = {
  WARNING_MAX: 30,
  WARNING_MIN: 5,
  DANGER_MAX: 40,
  DANGER_MIN: 0,
};

export const politicsRouter = router({
  // ============ GESTION DES TAGS POLITIQUES ============

  // Créer un nouveau tag politique
  createTag: protectedProcedure
    .input(
      z.object({
        family: PoliticalFamilyEnum,
        partyName: z.string().optional(),
        candidateName: z.string().optional(),
        electionType: ElectionTypeEnum.optional(),
        electionYear: z.number().int().min(2000).max(2100).optional(),
        constituency: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return ctx.db.politicalTag.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
        },
      });
    }),

  // Lister les tags politiques de l'organisation
  listTags: protectedProcedure
    .input(
      z.object({
        electionType: ElectionTypeEnum.optional(),
        electionYear: z.number().optional(),
        family: PoliticalFamilyEnum.optional(),
        constituency: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return ctx.db.politicalTag.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.electionType && { electionType: input.electionType }),
          ...(input?.electionYear && { electionYear: input.electionYear }),
          ...(input?.family && { family: input.family }),
          ...(input?.constituency && { constituency: input.constituency }),
        },
        orderBy: [
          { family: 'asc' },
          { partyName: 'asc' },
        ],
        include: {
          _count: {
            select: { stories: true },
          },
        },
      });
    }),

  // Obtenir un tag politique par ID
  getTag: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tag = await ctx.db.politicalTag.findUnique({
        where: { id: input.id },
        include: {
          stories: {
            include: {
              story: {
                select: {
                  id: true,
                  title: true,
                  createdAt: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!tag || tag.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return tag;
    }),

  // Mettre à jour un tag politique
  updateTag: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        family: PoliticalFamilyEnum.optional(),
        partyName: z.string().optional(),
        candidateName: z.string().optional(),
        electionType: ElectionTypeEnum.optional(),
        electionYear: z.number().int().min(2000).max(2100).optional(),
        constituency: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const tag = await ctx.db.politicalTag.findUnique({
        where: { id },
      });

      if (!tag || tag.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return ctx.db.politicalTag.update({
        where: { id },
        data,
      });
    }),

  // Supprimer un tag politique
  deleteTag: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.db.politicalTag.findUnique({
        where: { id: input.id },
      });

      if (!tag || tag.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Supprimer les associations puis le tag
      await ctx.db.storyPoliticalTag.deleteMany({
        where: { politicalTagId: input.id },
      });

      return ctx.db.politicalTag.delete({
        where: { id: input.id },
      });
    }),

  // ============ ASSOCIATION SUJETS <-> TAGS ============

  // Taguer un sujet avec une étiquette politique
  tagStory: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        politicalTagId: z.string(),
        speakingTime: z.number().int().min(0).optional(),
        isMainSubject: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que le sujet appartient à l'organisation
      const story = await ctx.db.story.findUnique({
        where: { id: input.storyId },
      });

      if (!story || story.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sujet introuvable' });
      }

      // Vérifier que le tag appartient à l'organisation
      const tag = await ctx.db.politicalTag.findUnique({
        where: { id: input.politicalTagId },
      });

      if (!tag || tag.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag politique introuvable' });
      }

      return ctx.db.storyPoliticalTag.upsert({
        where: {
          storyId_politicalTagId: {
            storyId: input.storyId,
            politicalTagId: input.politicalTagId,
          },
        },
        create: {
          storyId: input.storyId,
          politicalTagId: input.politicalTagId,
          speakingTime: input.speakingTime,
          isMainSubject: input.isMainSubject,
        },
        update: {
          speakingTime: input.speakingTime,
          isMainSubject: input.isMainSubject,
        },
        include: {
          politicalTag: true,
        },
      });
    }),

  // Retirer un tag d'un sujet
  untagStory: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        politicalTagId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que le sujet appartient à l'organisation
      const story = await ctx.db.story.findUnique({
        where: { id: input.storyId },
      });

      if (!story || story.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return ctx.db.storyPoliticalTag.delete({
        where: {
          storyId_politicalTagId: {
            storyId: input.storyId,
            politicalTagId: input.politicalTagId,
          },
        },
      });
    }),

  // Obtenir les tags politiques d'un sujet
  getStoryTags: protectedProcedure
    .input(z.object({ storyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const story = await ctx.db.story.findUnique({
        where: { id: input.storyId },
      });

      if (!story || story.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return ctx.db.storyPoliticalTag.findMany({
        where: { storyId: input.storyId },
        include: {
          politicalTag: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }),

  // Mettre à jour le type d'élection d'un sujet
  setStoryElectionType: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
        electionType: ElectionTypeEnum.nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.db.story.findUnique({
        where: { id: input.storyId },
      });

      if (!story || story.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return ctx.db.story.update({
        where: { id: input.storyId },
        data: { electionType: input.electionType },
      });
    }),

  // ============ STATISTIQUES D'ÉQUILIBRE ============

  // Obtenir les statistiques de répartition politique
  getBalance: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        electionType: ElectionTypeEnum.optional(),
        constituency: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Récupérer tous les sujets avec leurs tags dans la période
      // Inclure les médias audio pour calculer automatiquement le temps de parole
      const stories = await ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {},
          },
        },
        include: {
          politicalTags: {
            include: {
              politicalTag: true,
            },
          },
          // Inclure les médias audio pour calculer la durée automatiquement
          media: {
            include: {
              mediaItem: {
                select: {
                  type: true,
                  duration: true,
                },
              },
            },
          },
        },
      });

      // Calculer les statistiques par famille politique
      const familyStats: Record<string, {
        storyCount: number;
        speakingTimeSeconds: number;
        storyIds: string[];
      }> = {};

      // Initialiser toutes les familles
      const families = ['EXG', 'GAU', 'ECO', 'CEN', 'DRO', 'EXD', 'DIV', 'AUT'];
      families.forEach(f => {
        familyStats[f] = { storyCount: 0, speakingTimeSeconds: 0, storyIds: [] };
      });

      // Filtrer par constituency si spécifié
      let filteredStories = stories;
      if (input.constituency) {
        filteredStories = stories.filter(story =>
          story.politicalTags.some(
            pt => pt.politicalTag.constituency === input.constituency
          )
        );
      }

      // Agréger les données
      let totalSpeakingTime = 0;
      const uniqueStoryIds = new Set<string>();

      for (const story of filteredStories) {
        // Calculer la durée totale des médias audio du sujet
        const storyAudioDuration = story.media
          ?.filter((m) => m.mediaItem.type === 'AUDIO' && m.mediaItem.duration)
          .reduce((sum, m) => sum + (m.mediaItem.duration || 0), 0) || 0;

        for (const storyTag of story.politicalTags) {
          const family = storyTag.politicalTag.family;
          // Utiliser la durée des médias audio si présents, sinon speakingTime manuel
          const speakingTime = storyAudioDuration > 0 ? storyAudioDuration : (storyTag.speakingTime || 0);

          // Filtrer par constituency
          if (input.constituency && storyTag.politicalTag.constituency !== input.constituency) {
            continue;
          }

          familyStats[family].speakingTimeSeconds += speakingTime;
          totalSpeakingTime += speakingTime;

          if (!familyStats[family].storyIds.includes(story.id)) {
            familyStats[family].storyIds.push(story.id);
            familyStats[family].storyCount++;
          }

          uniqueStoryIds.add(story.id);
        }
      }

      const totalStories = uniqueStoryIds.size;

      // Calculer les pourcentages et statuts
      const representedFamilies = families.filter(f => familyStats[f].storyCount > 0);
      const familyCount = representedFamilies.length;

      const result = families.map(family => {
        const stats = familyStats[family];
        const percentage = totalSpeakingTime > 0
          ? (stats.speakingTimeSeconds / totalSpeakingTime) * 100
          : (totalStories > 0 ? (stats.storyCount / totalStories) * 100 : 0);

        let status: 'ok' | 'warning' | 'danger' = 'ok';

        if (stats.storyCount === 0 && familyCount > 0) {
          status = 'danger';
        } else if (percentage >= THRESHOLDS.DANGER_MAX) {
          status = 'danger';
        } else if (percentage >= THRESHOLDS.WARNING_MAX || percentage <= THRESHOLDS.WARNING_MIN) {
          status = 'warning';
        }

        return {
          family,
          storyCount: stats.storyCount,
          speakingTimeSeconds: stats.speakingTimeSeconds,
          percentage: Math.round(percentage * 10) / 10,
          status,
        };
      });

      // Générer les alertes
      const alerts: { type: 'warning' | 'danger'; message: string; family: string }[] = [];

      for (const stat of result) {
        if (stat.status === 'danger') {
          if (stat.storyCount === 0) {
            alerts.push({
              type: 'danger',
              message: `${stat.family} n'est pas représenté(e)`,
              family: stat.family,
            });
          } else if (stat.percentage >= THRESHOLDS.DANGER_MAX) {
            alerts.push({
              type: 'danger',
              message: `${stat.family} est surreprésenté(e) (${stat.percentage}%)`,
              family: stat.family,
            });
          }
        } else if (stat.status === 'warning') {
          if (stat.percentage >= THRESHOLDS.WARNING_MAX) {
            alerts.push({
              type: 'warning',
              message: `${stat.family} dépasse le seuil recommandé (${stat.percentage}%)`,
              family: stat.family,
            });
          } else if (stat.percentage <= THRESHOLDS.WARNING_MIN && stat.storyCount > 0) {
            alerts.push({
              type: 'warning',
              message: `${stat.family} est sous-représenté(e) (${stat.percentage}%)`,
              family: stat.family,
            });
          }
        }
      }

      const hasAlerts = alerts.some(a => a.type === 'danger') || alerts.length > 2;

      return {
        startDate: input.startDate,
        endDate: input.endDate,
        electionType: input.electionType,
        totalStories,
        totalSpeakingTime,
        familyStats: result,
        alerts,
        isBalanced: !hasAlerts,
      };
    }),

  // Obtenir les sujets par famille politique pour une période
  getStoriesByFamily: protectedProcedure
    .input(
      z.object({
        family: PoliticalFamilyEnum,
        startDate: z.date(),
        endDate: z.date(),
        electionType: ElectionTypeEnum.optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const stories = await ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {
              politicalTag: {
                family: input.family,
              },
            },
          },
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          politicalTags: {
            where: {
              politicalTag: {
                family: input.family,
              },
            },
            include: {
              politicalTag: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
        skip: input.offset,
      });

      const total = await ctx.db.story.count({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {
              politicalTag: {
                family: input.family,
              },
            },
          },
        },
      });

      return {
        stories,
        total,
        hasMore: input.offset + stories.length < total,
      };
    }),

  // Widget : Résumé rapide du pluralisme (pour sidebar)
  getQuickSummary: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
        electionType: ElectionTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Récupérer les stats agrégées
      const storyTags = await ctx.db.storyPoliticalTag.findMany({
        where: {
          story: {
            organizationId: ctx.organizationId,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            ...(input.electionType && { electionType: input.electionType }),
          },
        },
        include: {
          politicalTag: {
            select: {
              family: true,
            },
          },
        },
      });

      // Agréger par famille
      const familyCounts: Record<string, number> = {};
      const families = ['EXG', 'GAU', 'ECO', 'CEN', 'DRO', 'EXD', 'DIV', 'AUT'];
      families.forEach(f => { familyCounts[f] = 0; });

      const uniqueStories = new Set<string>();
      for (const st of storyTags) {
        familyCounts[st.politicalTag.family]++;
        uniqueStories.add(st.storyId);
      }

      const totalTags = storyTags.length;
      const totalStories = uniqueStories.size;

      // Calculer les alertes principales
      const hasEmptyFamily = families.some(f => familyCounts[f] === 0);
      const maxPercent = totalTags > 0
        ? Math.max(...families.map(f => (familyCounts[f] / totalTags) * 100))
        : 0;
      const hasDangerPercent = maxPercent >= THRESHOLDS.DANGER_MAX;
      const hasWarningPercent = maxPercent >= THRESHOLDS.WARNING_MAX;

      let status: 'balanced' | 'warning' | 'danger' = 'balanced';
      if (hasEmptyFamily || hasDangerPercent) {
        status = 'danger';
      } else if (hasWarningPercent) {
        status = 'warning';
      }

      return {
        period: {
          startDate,
          endDate,
          days: input.days,
        },
        totalStories,
        totalTags,
        familyCounts,
        status,
        alertCount: families.filter(
          f => familyCounts[f] === 0 || (totalTags > 0 && (familyCounts[f] / totalTags) * 100 >= THRESHOLDS.WARNING_MAX)
        ).length,
      };
    }),

  // Export des données pour rapport ARCOM (CSV/JSON)
  exportReport: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        electionType: ElectionTypeEnum.optional(),
        format: z.enum(['json', 'csv']).default('json'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Récupérer toutes les données
      const stories = await ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {},
          },
        },
        include: {
          author: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          politicalTags: {
            include: {
              politicalTag: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (input.format === 'csv') {
        // Générer CSV
        const headers = [
          'Date',
          'Titre',
          'Auteur',
          'Type Election',
          'Famille Politique',
          'Parti',
          'Candidat',
          'Temps de Parole (s)',
          'Sujet Principal',
        ];

        const rows = stories.flatMap(story =>
          story.politicalTags.map(st => [
            story.createdAt.toISOString().split('T')[0],
            `"${story.title.replace(/"/g, '""')}"`,
            `"${[story.author.firstName, story.author.lastName].filter(Boolean).join(' ')}"`,
            story.electionType || '',
            st.politicalTag.family,
            st.politicalTag.partyName || '',
            st.politicalTag.candidateName || '',
            st.speakingTime?.toString() || '',
            st.isMainSubject ? 'Oui' : 'Non',
          ])
        );

        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

        return {
          format: 'csv',
          filename: `rapport-pluralisme-${input.startDate.toISOString().split('T')[0]}-${input.endDate.toISOString().split('T')[0]}.csv`,
          content: csv,
          mimeType: 'text/csv',
        };
      }

      // Format JSON par défaut
      return {
        format: 'json',
        filename: `rapport-pluralisme-${input.startDate.toISOString().split('T')[0]}-${input.endDate.toISOString().split('T')[0]}.json`,
        content: JSON.stringify({
          metadata: {
            generatedAt: new Date().toISOString(),
            period: {
              start: input.startDate.toISOString(),
              end: input.endDate.toISOString(),
            },
            electionType: input.electionType,
          },
          stories: stories.map(s => ({
            id: s.id,
            date: s.createdAt.toISOString(),
            title: s.title,
            author: [s.author.firstName, s.author.lastName].filter(Boolean).join(' '),
            electionType: s.electionType,
            politicalTags: s.politicalTags.map(pt => ({
              family: pt.politicalTag.family,
              party: pt.politicalTag.partyName,
              candidate: pt.politicalTag.candidateName,
              speakingTime: pt.speakingTime,
              isMainSubject: pt.isMainSubject,
            })),
          })),
        }, null, 2),
        mimeType: 'application/json',
      };
    }),

  // ============ GESTION DES CIRCONSCRIPTIONS (VILLES) ============

  // Lister les circonscriptions de l'organisation
  listConstituencies: protectedProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return ctx.db.constituency.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.activeOnly !== false && { isActive: true }),
        },
        orderBy: { name: 'asc' },
      });
    }),

  // Créer une nouvelle circonscription
  createConstituency: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        department: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Vérifier si la ville existe déjà
      const existing = await ctx.db.constituency.findUnique({
        where: {
          organizationId_name: {
            organizationId: ctx.organizationId,
            name: input.name,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `La ville "${input.name}" existe déjà`,
        });
      }

      return ctx.db.constituency.create({
        data: {
          name: input.name,
          department: input.department,
          organizationId: ctx.organizationId,
        },
      });
    }),

  // Mettre à jour une circonscription
  updateConstituency: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        department: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const constituency = await ctx.db.constituency.findUnique({
        where: { id },
      });

      if (!constituency || constituency.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return ctx.db.constituency.update({
        where: { id },
        data,
      });
    }),

  // Supprimer une circonscription (soft delete = isActive = false)
  deleteConstituency: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const constituency = await ctx.db.constituency.findUnique({
        where: { id: input.id },
      });

      if (!constituency || constituency.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Soft delete
      return ctx.db.constituency.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // Obtenir les statistiques d'équilibre par ville
  getBalanceByConstituency: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        electionType: ElectionTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Récupérer toutes les villes actives
      const constituencies = await ctx.db.constituency.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      // Récupérer tous les sujets avec leurs tags dans la période
      // Inclure les médias audio pour calculer la durée automatiquement
      const stories = await ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {},
          },
        },
        include: {
          politicalTags: {
            include: {
              politicalTag: true,
            },
          },
          media: {
            include: {
              mediaItem: {
                select: {
                  type: true,
                  duration: true,
                },
              },
            },
          },
        },
      });

      const families = ['EXG', 'GAU', 'ECO', 'CEN', 'DRO', 'EXD', 'DIV', 'AUT'];

      // Calculer les stats par ville
      const results = constituencies.map(constituency => {
        const familyStats: Record<string, { storyCount: number; speakingTimeSeconds: number }> = {};
        families.forEach(f => {
          familyStats[f] = { storyCount: 0, speakingTimeSeconds: 0 };
        });

        let totalSpeakingTime = 0;
        let totalStories = 0;
        const uniqueStoryIds = new Set<string>();

        for (const story of stories) {
          // Calculer la durée totale des médias audio du sujet
          const storyAudioDuration = story.media
            ?.filter((m) => m.mediaItem.type === 'AUDIO' && m.mediaItem.duration)
            .reduce((sum, m) => sum + (m.mediaItem.duration || 0), 0) || 0;

          for (const storyTag of story.politicalTags) {
            if (storyTag.politicalTag.constituency !== constituency.name) {
              continue;
            }

            const family = storyTag.politicalTag.family;
            // Utiliser la durée des médias audio si présents, sinon speakingTime manuel
            const speakingTime = storyAudioDuration > 0 ? storyAudioDuration : (storyTag.speakingTime || 0);

            familyStats[family].speakingTimeSeconds += speakingTime;
            totalSpeakingTime += speakingTime;

            if (!uniqueStoryIds.has(story.id)) {
              uniqueStoryIds.add(story.id);
              familyStats[family].storyCount++;
            }
          }
        }

        totalStories = uniqueStoryIds.size;

        // Calculer le statut global pour cette ville
        const representedFamilies = families.filter(f => familyStats[f].storyCount > 0);
        const familyCount = representedFamilies.length;

        let alertCount = 0;
        let status: 'balanced' | 'warning' | 'danger' = 'balanced';

        for (const family of families) {
          const stats = familyStats[family];
          const percentage = totalSpeakingTime > 0
            ? (stats.speakingTimeSeconds / totalSpeakingTime) * 100
            : (totalStories > 0 ? (stats.storyCount / totalStories) * 100 : 0);

          if (stats.storyCount === 0 && familyCount > 0) {
            alertCount++;
            status = 'danger';
          } else if (percentage >= THRESHOLDS.DANGER_MAX) {
            alertCount++;
            status = 'danger';
          } else if (percentage >= THRESHOLDS.WARNING_MAX || (percentage <= THRESHOLDS.WARNING_MIN && stats.storyCount > 0)) {
            alertCount++;
            if (status !== 'danger') status = 'warning';
          }
        }

        return {
          constituency: {
            id: constituency.id,
            name: constituency.name,
            department: constituency.department,
          },
          totalStories,
          totalSpeakingTime,
          familyStats: families.map(f => ({
            family: f,
            storyCount: familyStats[f].storyCount,
            speakingTimeSeconds: familyStats[f].speakingTimeSeconds,
            percentage: totalSpeakingTime > 0
              ? Math.round((familyStats[f].speakingTimeSeconds / totalSpeakingTime) * 1000) / 10
              : 0,
          })),
          alertCount,
          status,
        };
      });

      // Calculer le résumé global
      const globalStatus = results.some(r => r.status === 'danger')
        ? 'danger'
        : results.some(r => r.status === 'warning')
          ? 'warning'
          : 'balanced';

      return {
        startDate: input.startDate,
        endDate: input.endDate,
        electionType: input.electionType,
        constituencies: results,
        summary: {
          totalConstituencies: constituencies.length,
          balancedCount: results.filter(r => r.status === 'balanced').length,
          warningCount: results.filter(r => r.status === 'warning').length,
          dangerCount: results.filter(r => r.status === 'danger').length,
          globalStatus,
        },
      };
    }),

  // ============ LISTING DÉTAILLÉ POUR JUSTIFICATION ARCOM ============

  // Obtenir tous les sujets d'une famille avec le script complet pour justification
  getDetailedStoriesByFamily: protectedProcedure
    .input(
      z.object({
        family: PoliticalFamilyEnum,
        startDate: z.date(),
        endDate: z.date(),
        electionType: ElectionTypeEnum.optional(),
        constituency: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const stories = await ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {
              politicalTag: {
                family: input.family,
                ...(input.constituency && { constituency: input.constituency }),
              },
            },
          },
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          politicalTags: {
            where: {
              politicalTag: {
                family: input.family,
                ...(input.constituency && { constituency: input.constituency }),
              },
            },
            include: {
              politicalTag: true,
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
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculer le temps de parole total pour cette famille
      let totalSpeakingTime = 0;
      const detailedStories = stories.map((story) => {
        // Calculer durée audio
        const audioDuration = story.media
          ?.filter((m) => m.mediaItem.type === 'AUDIO' && m.mediaItem.duration)
          .reduce((sum, m) => sum + (m.mediaItem.duration || 0), 0) || 0;

        const speakingTime = audioDuration > 0
          ? audioDuration
          : (story.politicalTags[0]?.speakingTime || 0);

        totalSpeakingTime += speakingTime;

        return {
          id: story.id,
          title: story.title,
          content: story.content, // Le script complet
          summary: story.summary,
          createdAt: story.createdAt,
          status: story.status,
          electionType: story.electionType,
          googleDocUrl: story.googleDocUrl,
          estimatedDuration: story.estimatedDuration,
          author: {
            name: [story.author.firstName, story.author.lastName].filter(Boolean).join(' '),
          },
          politicalTags: story.politicalTags.map((pt) => ({
            family: pt.politicalTag.family,
            partyName: pt.politicalTag.partyName,
            candidateName: pt.politicalTag.candidateName,
            constituency: pt.politicalTag.constituency,
            speakingTime: pt.speakingTime,
            isMainSubject: pt.isMainSubject,
          })),
          media: story.media?.map((m) => ({
            title: m.mediaItem.title,
            type: m.mediaItem.type,
            duration: m.mediaItem.duration,
          })),
          calculatedSpeakingTime: speakingTime,
        };
      });

      return {
        family: input.family,
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        electionType: input.electionType,
        constituency: input.constituency,
        totalStories: stories.length,
        totalSpeakingTime,
        stories: detailedStories,
      };
    }),

  // Export détaillé avec scripts pour rapport ARCOM (format texte lisible)
  exportDetailedReport: protectedProcedure
    .input(
      z.object({
        family: PoliticalFamilyEnum.optional(),
        startDate: z.date(),
        endDate: z.date(),
        electionType: ElectionTypeEnum.optional(),
        constituency: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Récupérer tous les sujets politiques de la période
      const stories = await ctx.db.story.findMany({
        where: {
          organizationId: ctx.organizationId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          ...(input.electionType && { electionType: input.electionType }),
          politicalTags: {
            some: {
              ...(input.family && {
                politicalTag: {
                  family: input.family,
                  ...(input.constituency && { constituency: input.constituency }),
                },
              }),
            },
          },
        },
        include: {
          author: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          politicalTags: {
            include: {
              politicalTag: true,
            },
            ...(input.family && {
              where: {
                politicalTag: {
                  family: input.family,
                },
              },
            }),
          },
          media: {
            include: {
              mediaItem: {
                select: {
                  title: true,
                  type: true,
                  duration: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Mapper les noms de famille politique
      const familyNames: Record<string, string> = {
        EXG: 'Extrême Gauche',
        GAU: 'Gauche',
        ECO: 'Écologistes',
        CEN: 'Centre',
        DRO: 'Droite',
        EXD: 'Extrême Droite',
        DIV: 'Divers',
        AUT: 'Autres',
      };

      // Fonction de formatage de durée
      const formatDuration = (seconds: number): string => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
      };

      // Générer le rapport texte détaillé
      let report = `RAPPORT PLURALISME POLITIQUE - JUSTIFICATION ARCOM\n`;
      report += `${'='.repeat(60)}\n\n`;
      report += `Période: du ${input.startDate.toLocaleDateString('fr-FR')} au ${input.endDate.toLocaleDateString('fr-FR')}\n`;
      if (input.electionType) {
        report += `Type d'élection: ${input.electionType}\n`;
      }
      if (input.family) {
        report += `Famille politique: ${familyNames[input.family] || input.family}\n`;
      }
      if (input.constituency) {
        report += `Circonscription: ${input.constituency}\n`;
      }
      report += `Nombre de sujets: ${stories.length}\n`;
      report += `Date de génération: ${new Date().toLocaleString('fr-FR')}\n`;
      report += `\n${'='.repeat(60)}\n\n`;

      // Détail de chaque sujet
      for (const story of stories) {
        const authorName = [story.author.firstName, story.author.lastName].filter(Boolean).join(' ');

        // Calculer durée audio
        const audioDuration = story.media
          ?.filter((m) => m.mediaItem.type === 'AUDIO' && m.mediaItem.duration)
          .reduce((sum, m) => sum + (m.mediaItem.duration || 0), 0) || 0;
        const speakingTime = audioDuration > 0
          ? audioDuration
          : (story.politicalTags[0]?.speakingTime || 0);

        report += `${'─'.repeat(60)}\n`;
        report += `SUJET: ${story.title}\n`;
        report += `${'─'.repeat(60)}\n`;
        report += `Date: ${story.createdAt.toLocaleDateString('fr-FR')} à ${story.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n`;
        report += `Auteur: ${authorName}\n`;
        report += `Statut: ${story.status}\n`;
        if (story.electionType) {
          report += `Type d'élection: ${story.electionType}\n`;
        }
        report += `Temps de parole: ${formatDuration(speakingTime)}\n`;
        report += `\n`;

        // Tags politiques
        report += `ÉTIQUETTES POLITIQUES:\n`;
        for (const pt of story.politicalTags) {
          report += `  • ${familyNames[pt.politicalTag.family] || pt.politicalTag.family}`;
          if (pt.politicalTag.partyName) {
            report += ` - ${pt.politicalTag.partyName}`;
          }
          if (pt.politicalTag.candidateName) {
            report += ` (${pt.politicalTag.candidateName})`;
          }
          if (pt.politicalTag.constituency) {
            report += ` [${pt.politicalTag.constituency}]`;
          }
          if (pt.isMainSubject) {
            report += ` ★ Sujet principal`;
          }
          report += `\n`;
        }
        report += `\n`;

        // Médias attachés
        if (story.media && story.media.length > 0) {
          report += `MÉDIAS ATTACHÉS:\n`;
          for (const m of story.media) {
            const durationStr = m.mediaItem.duration ? ` (${formatDuration(m.mediaItem.duration)})` : '';
            report += `  • [${m.mediaItem.type}] ${m.mediaItem.title}${durationStr}\n`;
          }
          report += `\n`;
        }

        // Script/Contenu
        report += `SCRIPT / CONTENU:\n`;
        report += `${'·'.repeat(40)}\n`;
        if (story.content) {
          report += `${story.content}\n`;
        } else {
          report += `(Pas de contenu textuel - voir Google Docs si lié)\n`;
          if (story.googleDocUrl) {
            report += `Lien Google Docs: ${story.googleDocUrl}\n`;
          }
        }
        report += `${'·'.repeat(40)}\n`;
        report += `\n\n`;
      }

      // Résumé final
      report += `${'='.repeat(60)}\n`;
      report += `FIN DU RAPPORT\n`;
      report += `${'='.repeat(60)}\n`;

      const familySuffix = input.family ? `-${input.family}` : '';
      const filename = `rapport-pluralisme-detaille${familySuffix}-${input.startDate.toISOString().split('T')[0]}-${input.endDate.toISOString().split('T')[0]}.txt`;

      return {
        format: 'txt',
        filename,
        content: report,
        mimeType: 'text/plain',
        storyCount: stories.length,
      };
    }),
});
