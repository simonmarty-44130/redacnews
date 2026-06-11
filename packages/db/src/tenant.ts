// Helper d'execution multi-tenant pour la Row-Level Security.
//
// Statut : fourni pour le futur cablage de la RLS (voir packages/db/rls/).
// TANT QUE la RLS n'est pas activee, ce helper est inoffensif : il pose une
// variable de session ignoree par PostgreSQL, et execute le callback dans une
// transaction normale.
//
// Une fois la RLS activee, TOUTES les requetes protegees doivent passer par
// `withTenant(orgId, (tx) => ...)` pour que les policies recoivent
// l'organisation courante.

import { prisma, Prisma } from './index';

type TenantClient = Prisma.TransactionClient;

/**
 * Execute `fn` dans une transaction ou `app.current_org` est positionne a
 * `organizationId` (portee LOCAL = la transaction). Les requetes faites sur le
 * client `tx` fourni sont alors filtrees par les policies RLS.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(..., true) => portee LOCAL a la transaction courante.
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
    return fn(tx);
  });
}
