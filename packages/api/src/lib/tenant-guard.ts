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

/** Verifie qu'une emission (show) appartient a l'organisation. */
export async function assertShowInOrg(
  db: Db,
  showId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const show = await db.show.findUnique({
    where: { id: showId },
    select: { organizationId: true },
  });
  if (!show || show.organizationId !== organizationId) denyNotFound();
}

/** Verifie qu'un item de conducteur appartient a l'organisation (via rundown->show). */
export async function assertRundownItemInOrg(
  db: Db,
  rundownItemId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const item = await db.rundownItem.findUnique({
    where: { id: rundownItemId },
    select: { rundown: { select: { show: { select: { organizationId: true } } } } },
  });
  if (!item || item.rundown.show.organizationId !== organizationId) denyNotFound();
}

/** Verifie qu'un modele de conducteur (template) appartient a l'organisation. */
export async function assertTemplateInOrg(
  db: Db,
  templateId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const template = await db.rundownTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  });
  if (!template || template.organizationId !== organizationId) denyNotFound();
}

/** Verifie qu'un item de template appartient a l'organisation (via template). */
export async function assertTemplateItemInOrg(
  db: Db,
  templateItemId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const item = await db.rundownTemplateItem.findUnique({
    where: { id: templateItemId },
    select: { template: { select: { organizationId: true } } },
  });
  if (!item || item.template.organizationId !== organizationId) denyNotFound();
}

/** Verifie qu'une collection appartient a l'organisation. */
export async function assertCollectionInOrg(
  db: Db,
  collectionId: string,
  organizationId: string | null
): Promise<void> {
  if (!organizationId) denyNotFound();
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: { organizationId: true },
  });
  if (!collection || collection.organizationId !== organizationId) denyNotFound();
}
