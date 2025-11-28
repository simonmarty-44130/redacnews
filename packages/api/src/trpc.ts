import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@redacnews/db';

export interface Context {
  db: typeof prisma;
  userId: string | null;
  organizationId: string | null;
  cognitoId: string | null;
}

export const createTRPCContext = async (opts: {
  headers: Headers;
}): Promise<Context> => {
  // Extract cognitoId from headers (set by auth middleware on frontend)
  const cognitoId = opts.headers.get('x-cognito-id');

  let userId: string | null = null;
  let organizationId: string | null = null;

  // Lookup user in database by cognitoId
  if (cognitoId) {
    const user = await prisma.user.findUnique({
      where: { cognitoId },
      select: { id: true, organizationId: true },
    });
    if (user) {
      userId = user.id;
      organizationId = user.organizationId;
    }
  }

  return {
    db: prisma,
    userId,
    organizationId,
    cognitoId,
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
