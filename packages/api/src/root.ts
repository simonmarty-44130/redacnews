import { router } from './trpc';
import { rundownRouter } from './routers/rundown';
import { storyRouter } from './routers/story';
import { mediaRouter } from './routers/media';
import { storyMediaRouter } from './routers/storyMedia';
import { montageRouter } from './routers/montage';
import { scriptRouter } from './routers/script';
import { templateRouter } from './routers/template';

export const appRouter = router({
  rundown: rundownRouter,
  story: storyRouter,
  media: mediaRouter,
  storyMedia: storyMediaRouter,
  montage: montageRouter,
  script: scriptRouter,
  template: templateRouter,
});

export type AppRouter = typeof appRouter;
