import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { addDays } from 'date-fns';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Configuration Cognito
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

// Labels français pour les rôles
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  EDITOR_IN_CHIEF: 'Rédacteur en chef',
  JOURNALIST: 'Journaliste',
  TECHNICIAN: 'Technicien',
  FREELANCER: 'Pigiste',
};

export const teamRouter = router({
  // Lister les membres de l'organisation
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.user.findMany({
      where: {
        organizationId: ctx.organizationId!,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });

    return members.map((m) => ({
      ...m,
      roleLabel: ROLE_LABELS[m.role] || m.role,
    }));
  }),

  // Lister les invitations en attente
  listInvitations: protectedProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.db.invitation.findMany({
      where: {
        organizationId: ctx.organizationId!,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      ...inv,
      roleLabel: ROLE_LABELS[inv.role] || inv.role,
    }));
  }),

  // Inviter un nouveau membre
  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email('Adresse email invalide'),
        role: z.enum([
          'ADMIN',
          'EDITOR_IN_CHIEF',
          'JOURNALIST',
          'TECHNICIAN',
          'FREELANCER',
        ]),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'utilisateur actuel est admin ou rédac chef
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!currentUser || !['ADMIN', 'EDITOR_IN_CHIEF'].includes(currentUser.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent inviter des membres',
        });
      }

      // Vérifier si l'email existe déjà dans l'organisation
      const existingUser = await ctx.db.user.findFirst({
        where: {
          email: input.email.toLowerCase(),
          organizationId: ctx.organizationId!,
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cet email est déjà membre de l\'organisation',
        });
      }

      // Vérifier s'il y a déjà une invitation en attente
      const existingInvitation = await ctx.db.invitation.findFirst({
        where: {
          email: input.email.toLowerCase(),
          organizationId: ctx.organizationId!,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Une invitation est déjà en attente pour cet email',
        });
      }

      // Créer le token d'invitation
      const token = nanoid(32);
      const expiresAt = addDays(new Date(), 7);

      // Créer l'invitation
      const invitation = await ctx.db.invitation.create({
        data: {
          email: input.email.toLowerCase(),
          role: input.role,
          token,
          organizationId: ctx.organizationId!,
          invitedById: ctx.userId!,
          expiresAt,
        },
        include: {
          organization: true,
        },
      });

      // Construire l'URL d'invitation
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/${token}`;

      // Préparer le contenu de l'email pour Gmail
      const subject = `Invitation à rejoindre ${invitation.organization.name} sur RédacNews`;
      const body = `Bonjour${input.firstName ? ` ${input.firstName}` : ''},

${currentUser.firstName} ${currentUser.lastName} vous invite à rejoindre ${invitation.organization.name} sur RédacNews.

Votre rôle : ${ROLE_LABELS[input.role]}

Cliquez sur le lien ci-dessous pour créer votre compte :
${inviteUrl}

Ce lien expire dans 7 jours.

---
RédacNews - Le NRCS nouvelle génération pour les radios`;

      // Construire l'URL Gmail Compose
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(input.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        roleLabel: ROLE_LABELS[invitation.role],
        expiresAt: invitation.expiresAt,
        inviteUrl,
        gmailUrl,
      };
    }),

  // Annuler une invitation
  cancelInvitation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier les droits
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!currentUser || !['ADMIN', 'EDITOR_IN_CHIEF'].includes(currentUser.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent annuler des invitations',
        });
      }

      await ctx.db.invitation.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      });

      return { success: true };
    }),

  // Renvoyer une invitation
  resendInvitation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!currentUser || !['ADMIN', 'EDITOR_IN_CHIEF'].includes(currentUser.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent renvoyer des invitations',
        });
      }

      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.id },
        include: { organization: true },
      });

      if (!invitation || invitation.status !== 'PENDING') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvée ou déjà utilisée',
        });
      }

      // Générer un nouveau token et prolonger l'expiration
      const newToken = nanoid(32);
      const newExpiresAt = addDays(new Date(), 7);

      await ctx.db.invitation.update({
        where: { id: input.id },
        data: {
          token: newToken,
          expiresAt: newExpiresAt,
        },
      });

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/${newToken}`;

      // Préparer le contenu de l'email pour Gmail
      const subject = `Rappel : Invitation à rejoindre ${invitation.organization.name}`;
      const body = `Bonjour,

Vous avez reçu une invitation à rejoindre ${invitation.organization.name} sur RédacNews.

Votre rôle : ${ROLE_LABELS[invitation.role]}

Cliquez sur le lien ci-dessous pour créer votre compte :
${inviteUrl}

Ce lien expire dans 7 jours.

---
RédacNews - Le NRCS nouvelle génération pour les radios`;

      // Construire l'URL Gmail Compose
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitation.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      return { success: true, inviteUrl, gmailUrl };
    }),

  // Mettre à jour le rôle d'un membre
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum([
          'ADMIN',
          'EDITOR_IN_CHIEF',
          'JOURNALIST',
          'TECHNICIAN',
          'FREELANCER',
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier les droits
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!currentUser || currentUser.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent modifier les rôles',
        });
      }

      // Ne pas permettre de modifier son propre rôle
      if (input.userId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vous ne pouvez pas modifier votre propre rôle',
        });
      }

      const updatedUser = await ctx.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      return {
        ...updatedUser,
        roleLabel: ROLE_LABELS[updatedUser.role],
      };
    }),

  // Supprimer un membre
  removeMember: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier les droits
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId! },
      });

      if (!currentUser || currentUser.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent supprimer des membres',
        });
      }

      // Ne pas permettre de se supprimer soi-même
      if (input.userId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vous ne pouvez pas vous supprimer vous-même',
        });
      }

      // Vérifier que le membre existe dans l'organisation
      const memberToRemove = await ctx.db.user.findFirst({
        where: {
          id: input.userId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!memberToRemove) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Membre non trouvé',
        });
      }

      // Supprimer l'utilisateur de la base (les cascades gèrent le reste)
      await ctx.db.user.delete({
        where: { id: input.userId },
      });

      // TODO: Optionnel - Supprimer l'utilisateur de Cognito aussi
      // Pour l'instant on le garde dans Cognito au cas où

      return { success: true };
    }),

  // ========== ENDPOINTS PUBLICS POUR L'ACCEPTATION ==========

  // Vérifier une invitation (public)
  getInvitation: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvée',
        });
      }

      if (invitation.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            invitation.status === 'ACCEPTED'
              ? 'Cette invitation a déjà été acceptée'
              : 'Cette invitation a été annulée',
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation a expiré',
        });
      }

      return {
        email: invitation.email,
        role: invitation.role,
        roleLabel: ROLE_LABELS[invitation.role],
        organization: invitation.organization,
      };
    }),

  // Accepter une invitation (créer le compte)
  acceptInvitation: publicProcedure
    .input(
      z.object({
        token: z.string(),
        firstName: z.string().min(1, 'Prénom requis'),
        lastName: z.string().min(1, 'Nom requis'),
        password: z
          .string()
          .min(8, 'Le mot de passe doit faire au moins 8 caractères')
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier l'invitation
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvée',
        });
      }

      if (invitation.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation n\'est plus valide',
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation a expiré',
        });
      }

      // Créer l'utilisateur dans Cognito
      if (!USER_POOL_ID) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Configuration Cognito manquante',
        });
      }

      let cognitoUserId: string;

      try {
        // Créer l'utilisateur dans Cognito
        const createUserResult = await cognitoClient.send(
          new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: invitation.email,
            UserAttributes: [
              { Name: 'email', Value: invitation.email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'given_name', Value: input.firstName },
              { Name: 'family_name', Value: input.lastName },
            ],
            MessageAction: 'SUPPRESS', // Ne pas envoyer d'email Cognito
          })
        );

        cognitoUserId = createUserResult.User?.Username || invitation.email;

        // Définir le mot de passe permanent
        await cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: invitation.email,
            Password: input.password,
            Permanent: true,
          })
        );
      } catch (error: any) {
        if (error.name === 'UsernameExistsException') {
          // L'utilisateur existe déjà dans Cognito, récupérer son ID
          try {
            const existingUser = await cognitoClient.send(
              new AdminGetUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: invitation.email,
              })
            );
            cognitoUserId = existingUser.Username || invitation.email;
          } catch {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Un compte existe déjà avec cet email',
            });
          }
        } else {
          console.error('Erreur Cognito:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création du compte',
          });
        }
      }

      // Créer l'utilisateur dans notre base
      const user = await ctx.db.user.create({
        data: {
          cognitoId: cognitoUserId,
          email: invitation.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: invitation.role,
          organizationId: invitation.organizationId,
        },
      });

      // Marquer l'invitation comme acceptée
      await ctx.db.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      return {
        success: true,
        email: invitation.email,
        organization: invitation.organization.name,
      };
    }),
});
