/**
 * Script de correction rapide : met à jour startTime de "Tour des Clochers" à 07:00
 * 
 * Usage: cd packages/db && npx tsx fix-starttime.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStartTime() {
  console.log('🔧 Correction du startTime pour Tour des Clochers...\n');

  // Trouver toutes les émissions "Tour des Clochers"
  const shows = await prisma.show.findMany({
    where: {
      name: { contains: 'Tour des Clochers', mode: 'insensitive' },
    },
  });

  if (shows.length === 0) {
    console.log('❌ Aucune émission "Tour des Clochers" trouvée');
    return;
  }

  for (const show of shows) {
    console.log(`📺 ${show.name} - startTime actuel: ${show.startTime}`);
    
    if (show.startTime !== '07:00') {
      await prisma.show.update({
        where: { id: show.id },
        data: { startTime: '07:00' },
      });
      console.log(`   ✅ Mis à jour à 07:00`);
    } else {
      console.log(`   ✓ Déjà correct`);
    }
  }

  console.log('\n✨ Terminé !');
}

fixStartTime()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
