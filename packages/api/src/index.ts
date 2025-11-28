export { appRouter, type AppRouter } from './root';
export { createTRPCContext, type Context } from './trpc';
import type { inferRouterOutputs, inferRouterInputs } from '@trpc/server';
import type { AppRouter } from './root';

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
