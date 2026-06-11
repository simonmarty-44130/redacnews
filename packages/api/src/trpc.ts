import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@redacnews/db';
import { getAuthContext } from './auth';

export interface Context {
  db: typeof prisma;
  userId: string | null;
  organizationId: string | null;
  cognitoId: string | null;
  subscriptionActive: boolean;
}

export const createTRPCContext = async (opts: {
  headers: Headers;
}): Promise<Context> => {
  // SECURITE : l'identite est derivee d'un token Cognito VERIFIE cote serveur
  // (en-tete `Authorization: Bearer <accessToken>`, repli cookie). On ne fait
  // plus confiance a un en-tete `x-cognito-id` pose par le client, qui
  // permettait d'usurper n'importe quel utilisateur / organisation.
  const auth = await getAuthContext(opts.headers);

  return {
    db: prisma,
    userId: auth?.userId ?? null,
    organizationId: auth?.organizationId ?? null,
    cognitoId: auth?.cognitoId ?? null,
    subscriptionActive: auth?.subscriptionActive ?? false,
  };
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

// Procédure exigeant un abonnement actif (essai ou payant). Les fonctionnalités
// produit l'utilisent ; billing/settings restent en protectedProcedure pour que
// l'utilisateur puisse toujours gérer/payer son abonnement.
const enforceActiveSubscription = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.subscriptionActive) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'SUBSCRIPTION_INACTIVE',
    });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    },
  });
});

export const activeProcedure = t.procedure.use(enforceActiveSubscription);
