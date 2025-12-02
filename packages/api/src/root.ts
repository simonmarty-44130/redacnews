import { router } from './trpc';
import { rundownRouter } from './routers/rundown';
import { storyRouter } from './routers/story';
import { mediaRouter } from './routers/media';
import { storyMediaRouter } from './routers/storyMedia';

export const appRouter = router({
  rundown: rundownRouter,
  story: storyRouter,
  media: mediaRouter,
  storyMedia: storyMediaRouter,
});

export type AppRouter = typeof appRouter;
