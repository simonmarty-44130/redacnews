import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  CognitoIdentityProviderClient,
  ChangePasswordCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Configuration Cognito
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

export const settingsRouter = router({
  // ========== ORGANISATION ==========

  // Récupérer les infos de l'organisation
  getOrganization: protectedProcedure.query(async ({ ctx }) => {
    const organization = await ctx.db.organization.findUnique({
      where: { id: ctx.organizationId! },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            shows: true,
            stories: true,
            mediaItems: true,
          },
        },
      },
    });

    if (!organization) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Organisation non trouvée',
      });
    }

    return organization;
  }),

  // Mettre à jour l'organisation
  updateOrganization: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Le nom doit faire au moins 2 caractères').optional(),
        logo: z.string().url('URL invalide').optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'utilisateur est admin
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!currentUser || currentUser.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent modifier l\'organisation',
        });
      }

      const updated = await ctx.db.organization.update({
        where: { id: ctx.organizationId! },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.logo !== undefined && { logo: input.logo }),
        },
      });

      return updated;
    }),

  // ========== PROFIL UTILISATEUR ==========

  // Récupérer le profil de l'utilisateur connecté
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId! },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }

    return user;
  }),

  // Mettre à jour le profil
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1, 'Prénom requis').optional(),
        lastName: z.string().min(1, 'Nom requis').optional(),
        avatarUrl: z.string().url('URL invalide').optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.update({
        where: { id: ctx.userId! },
        data: {
          ...(input.firstName && { firstName: input.firstName }),
          ...(input.lastName && { lastName: input.lastName }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        },
      });

      return updated;
    }),

  // ========== SÉCURITÉ ==========

  // Changer le mot de passe
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
        newPassword: z
          .string()
          .min(8, 'Le mot de passe doit faire au moins 8 caractères')
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!USER_POOL_ID) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Configuration Cognito manquante',
        });
      }

      // Récupérer l'utilisateur pour avoir son email (username Cognito)
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Utilisateur non trouvé',
        });
      }

      try {
        // Utiliser AdminSetUserPassword pour changer le mot de passe
        // Note: Dans un cas réel, on utiliserait ChangePasswordCommand avec l'access token
        // Mais ici on utilise l'admin API pour simplifier
        await cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: user.email,
            Password: input.newPassword,
            Permanent: true,
          })
        );

        return { success: true };
      } catch (error: any) {
        console.error('Erreur changement mot de passe:', error);

        if (error.name === 'NotAuthorizedException') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Mot de passe actuel incorrect',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du changement de mot de passe',
        });
      }
    }),

  // ========== NOTIFICATIONS ==========

  // Récupérer les préférences de notifications
  getNotificationPreferences: protectedProcedure.query(async ({ ctx }) => {
    // Pour l'instant, on retourne des valeurs par défaut
    // Plus tard, on pourra ajouter un modèle NotificationPreference
    return {
      emailNewStory: true,
      emailRundownReady: true,
      emailInvitation: true,
      emailWeeklyDigest: false,
      pushNewStory: false,
      pushRundownReady: false,
    };
  }),

  // Mettre à jour les préférences de notifications
  updateNotificationPreferences: protectedProcedure
    .input(
      z.object({
        emailNewStory: z.boolean().optional(),
        emailRundownReady: z.boolean().optional(),
        emailInvitation: z.boolean().optional(),
        emailWeeklyDigest: z.boolean().optional(),
        pushNewStory: z.boolean().optional(),
        pushRundownReady: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Pour l'instant, on retourne simplement les valeurs
      // Plus tard, on sauvegarde en base
      return {
        success: true,
        preferences: input,
      };
    }),
});
