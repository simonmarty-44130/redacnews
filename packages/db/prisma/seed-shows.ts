import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RADIO_FIDELITE_SHOWS = [
  {
    name: 'Flash 7h',
    description: 'Flash info du matin - 7h',
    startTime: '07:00',
    defaultDuration: 2, // minutes
    category: 'FLASH' as const,
    color: '#EF4444', // rouge
  },
  {
    name: 'Flash 8h',
    description: 'Flash info du matin - 8h',
    startTime: '08:00',
    defaultDuration: 2,
    category: 'FLASH' as const,
    color: '#EF4444',
  },
  {
    name: 'Journal 7h',
    description: 'Journal complet du matin - 7h',
    startTime: '07:00',
    defaultDuration: 6,
    category: 'JOURNAL' as const,
    color: '#F59E0B', // orange
  },
  {
    name: 'Journal 8h',
    description: 'Journal complet du matin - 8h',
    startTime: '08:00',
    defaultDuration: 6,
    category: 'JOURNAL' as const,
    color: '#F59E0B',
  },
  {
    name: 'Matinale semaine',
    description: 'Matinale en semaine de 7h a 9h',
    startTime: '07:00',
    defaultDuration: 120,
    category: 'MAGAZINE' as const,
    color: '#3B82F6', // bleu
  },
  {
    name: 'Tour des Clochers',
    description: 'Emission dominicale - decouverte des paroisses',
    startTime: '07:00',
    defaultDuration: 120,
    category: 'MAGAZINE' as const,
    color: '#8B5CF6', // violet
  },
];

export async function seedShows(organizationId: string) {
  console.log('Seeding shows for Radio Fidelite...');

  for (const show of RADIO_FIDELITE_SHOWS) {
    const showId = `${organizationId}-${show.name.toLowerCase().replace(/\s+/g, '-')}`;

    await prisma.show.upsert({
      where: { id: showId },
      update: {
        name: show.name,
        description: show.description,
        startTime: show.startTime,
        defaultDuration: show.defaultDuration,
        category: show.category,
        color: show.color,
      },
      create: {
        id: showId,
        name: show.name,
        description: show.description,
        startTime: show.startTime,
        defaultDuration: show.defaultDuration,
        category: show.category,
        color: show.color,
        organizationId,
      },
    });
    console.log(`  ✓ ${show.name} (${show.startTime}, ${show.defaultDuration} min)`);
  }

  console.log('Shows seeded successfully!');
}

// Execution directe si appele en standalone
async function main() {
  // Recuperer la premiere organisation (ou en creer une)
  let org = await prisma.organization.findFirst();

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Radio Fidelite',
        slug: 'radio-fidelite',
      },
    });
    console.log('Created organization: Radio Fidelite');
  }

  await seedShows(org.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
