import { PrismaClient } from '@prisma/client';
import { seedShows } from './seed-shows';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Creer l'Organisation
  const organization = await prisma.organization.upsert({
    where: { slug: 'radio-redacnews' },
    update: {},
    create: {
      name: 'Radio RédacNews',
      slug: 'radio-redacnews',
    },
  });

  console.log('Organisation creee:', organization);

  // Creer l'utilisateur admin lie a l'Organisation
  const user = await prisma.user.upsert({
    where: { email: 'simon.marty@gmail.com' },
    update: {
      organizationId: organization.id,
    },
    create: {
      cognitoId: 'f159e0ce-4001-70dd-f1cc-a4590e25d9e9',
      email: 'simon.marty@gmail.com',
      firstName: 'Simon',
      lastName: 'Marty',
      role: 'ADMIN',
      organizationId: organization.id,
    },
  });

  console.log('Utilisateur cree:', user);

  // Seed des emissions Radio Fidelite
  await seedShows(organization.id);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
