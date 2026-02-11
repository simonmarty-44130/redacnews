// Système de gestion des quotas de tokens pour l'assistant IA

import { prisma } from '@redacnews/db';

export async function checkQuota(organizationId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}> {
  const settings = await prisma.aISettings.findUnique({
    where: { organizationId },
  });

  const limit = settings?.monthlyTokenLimit || 2_000_000;

  // Calculer l'usage du mois en cours
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usage = await prisma.aIUsage.aggregate({
    where: {
      organizationId,
      date: { gte: startOfMonth },
    },
    _sum: {
      tokensIn: true,
      tokensOut: true,
    },
  });

  const used = (usage._sum.tokensIn || 0) + (usage._sum.tokensOut || 0);

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exceeded: used >= limit,
  };
}

export async function recordUsage(
  organizationId: string,
  userId: string,
  model: string,
  tokensIn: number,
  tokensOut: number
) {
  await prisma.aIUsage.create({
    data: {
      organizationId,
      userId,
      model,
      tokensIn,
      tokensOut,
    },
  });
}

export async function getOrCreateSettings(organizationId: string) {
  let settings = await prisma.aISettings.findUnique({
    where: { organizationId },
  });

  if (!settings) {
    settings = await prisma.aISettings.create({
      data: {
        organizationId,
        defaultSystemPrompt: null,
        defaultModel: 'claude-sonnet-4-5-20250929',
        monthlyTokenLimit: 2_000_000,
        enabled: true,
      },
    });
  }

  return settings;
}
