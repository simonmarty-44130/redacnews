import { router } from './trpc';
import { rundownRouter } from './routers/rundown';
import { storyRouter } from './routers/story';
import { mediaRouter } from './routers/media';

export const appRouter = router({
  rundown: rundownRouter,
  story: storyRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
