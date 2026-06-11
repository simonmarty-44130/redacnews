// Gardes multi-tenant reutilisables.
//
// Tant que la Row-Level Security Postgres n'est pas activee (voir
// packages/db/rls/README.md), l'isolation entre organisations repose sur le
// scoping applicatif. Ces helpers verifient qu'une ressource accedee par son id
// appartient bien a l'organisation de l'appelant, et coupent l'acces sinon.
//
// On renvoie volontairement NOT_FOUND (et non FORBIDDEN) pour ne pas reveler
// l'existence d'une ressource appartenant a une autre organisation.

import { TRPCError } from '@trpc/server';
import type { prisma } from '@redacnews/db';

type Db = typeof prisma;

function denyNotFound(): never {
  throw new TRPCError({ code: 'NOT_FOUND' });
}

/** Verifie qu'un conducteur appartient a l'organisation (via son show). */
export async function assertRundownInOrg(
  db: Db,
  rundownId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const rundown = await db.rundown.findUnique({
    where: { id: rundownId },
    select: { show: { select: { organizationId: true } } },
  });
  if (!rundown || rundown.show.organizationId !== organizationId) denyNotFound();
}

/** Verifie qu'un sujet appartient a l'organisation. */
export async function assertStoryInOrg(
  db: Db,
  storyId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const story = await db.story.findUnique({
    where: { id: storyId },
    select: { organizationId: true },
  });
  if (!story || story.organizationId !== organizationId) denyNotFound();
}

/** Verifie qu'un media appartient a l'organisation. */
export async function assertMediaItemInOrg(
  db: Db,
  mediaItemId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const media = await db.mediaItem.findUnique({
    where: { id: mediaItemId },
    select: { organizationId: true },
  });
  if (!media || media.organizationId !== organizationId) denyNotFound();
}
