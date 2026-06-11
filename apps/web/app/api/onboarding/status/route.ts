// GET /api/onboarding/status
// Indique si l'organisation de l'utilisateur a bien été provisionnée après le
// paiement Stripe. Le webhook Stripe crée l'organisation + le User applicatif
// de manière asynchrone : la page /welcome interroge cette route en boucle
// jusqu'à ce que le User existe, puis entre dans l'app.

import { NextResponse } from 'next/server';
import { prisma } from '@redacnews/db';
import { verifyAccessToken } from '@/lib/auth/verify-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAccessToken(req);
  if (!auth) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { cognitoId: auth.sub },
    select: { id: true },
  });

  return NextResponse.json({ provisioned: !!user });
}
