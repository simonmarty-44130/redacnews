import { router } from './trpc';
import { rundownRouter } from './routers/rundown';
import { storyRouter } from './routers/story';
import { mediaRouter } from './routers/media';
import { storyMediaRouter } from './routers/storyMedia';
import { montageRouter } from './routers/montage';

export const appRouter = router({
  rundown: rundownRouter,
  story: storyRouter,
  media: mediaRouter,
  storyMedia: storyMediaRouter,
  montage: montageRouter,
});

export type AppRouter = typeof appRouter;
