import { router } from './trpc';
import { rundownRouter } from './routers/rundown';
import { storyRouter } from './routers/story';
import { mediaRouter } from './routers/media';
import { storyMediaRouter } from './routers/storyMedia';
import { montageRouter } from './routers/montage';
import { scriptRouter } from './routers/script';
import { templateRouter } from './routers/template';
import { rundownGuestRouter } from './routers/rundown-guest';
import { politicsRouter } from './routers/politics';
import { teamRouter } from './routers/team';
import { settingsRouter } from './routers/settings';

export const appRouter = router({
  rundown: rundownRouter,
  story: storyRouter,
  media: mediaRouter,
  storyMedia: storyMediaRouter,
  montage: montageRouter,
  script: scriptRouter,
  template: templateRouter,
  rundownGuest: rundownGuestRouter,
  politics: politicsRouter,
  team: teamRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
