import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@redacnews/db';

export interface Context {
  db: typeof prisma;
  userId: string | null;
  organizationId: string | null;
}

export const createTRPCContext = async (opts: {
  headers: Headers;
}): Promise<Context> => {
  // Extract user info from headers (set by middleware/auth)
  const userId = opts.headers.get('x-user-id');
  const organizationId = opts.headers.get('x-organization-id');

  return {
    db: prisma,
    userId,
    organizationId,
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
