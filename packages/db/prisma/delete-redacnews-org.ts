/**
 * Script pour supprimer l'organisation Radio RédacNews (dev)
 * Usage: DATABASE_URL="..." npx tsx prisma/delete-redacnews-org.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const orgId = 'cmiivo8m5000011mshc8z960o';

async function deleteOrganization() {
  console.log('🗑️  Suppression de Radio RédacNews...\n');

  try {
    // 1. Supprimer RundownTemplateItem
    const templateItems = await prisma.rundownTemplateItem.deleteMany({
      where: { template: { organizationId: orgId } },
    });
    console.log(`   - ${templateItems.count} RundownTemplateItem supprimés`);

    // 2. Supprimer RundownTemplate
    const templates = await prisma.rundownTemplate.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   - ${templates.count} RundownTemplate supprimés`);

    // 3. Récupérer les shows pour avoir les rundowns
    const shows = await prisma.show.findMany({
      where: { organizationId: orgId },
      include: { rundowns: { include: { items: true } } },
    });

    // 4. Supprimer RundownItemMedia pour chaque rundown
    for (const show of shows) {
      for (const rundown of show.rundowns) {
        const rimDeleted = await prisma.rundownItemMedia.deleteMany({
          where: { rundownItem: { rundownId: rundown.id } },
        });
        if (rimDeleted.count > 0) {
          console.log(`   - ${rimDeleted.count} RundownItemMedia supprimés (rundown ${rundown.id})`);
        }
      }
    }

    // 5. Supprimer RundownItem pour chaque rundown
    for (const show of shows) {
      for (const rundown of show.rundowns) {
        const riDeleted = await prisma.rundownItem.deleteMany({
          where: { rundownId: rundown.id },
        });
        if (riDeleted.count > 0) {
          console.log(`   - ${riDeleted.count} RundownItem supprimés (rundown ${rundown.id})`);
        }
      }
    }

    // 6. Supprimer Rundown pour chaque show
    for (const show of shows) {
      const rundownsDeleted = await prisma.rundown.deleteMany({
        where: { showId: show.id },
      });
      if (rundownsDeleted.count > 0) {
        console.log(`   - ${rundownsDeleted.count} Rundown supprimés (show ${show.name})`);
      }
    }

    // 7. Supprimer Show
    const showsDeleted = await prisma.show.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   - ${showsDeleted.count} Show supprimés`);

    // 8. Supprimer StoryMedia
    const storyMedia = await prisma.storyMedia.deleteMany({
      where: { story: { organizationId: orgId } },
    });
    console.log(`   - ${storyMedia.count} StoryMedia supprimés`);

    // 9. Supprimer Comment
    const comments = await prisma.comment.deleteMany({
      where: { story: { organizationId: orgId } },
    });
    console.log(`   - ${comments.count} Comment supprimés`);

    // 10. Supprimer Story
    const stories = await prisma.story.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   - ${stories.count} Story supprimés`);

    // 11. Supprimer CollectionItem
    const collectionItems = await prisma.collectionItem.deleteMany({
      where: { collection: { organizationId: orgId } },
    });
    console.log(`   - ${collectionItems.count} CollectionItem supprimés`);

    // 12. Supprimer Collection
    const collections = await prisma.collection.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   - ${collections.count} Collection supprimés`);

    // 13. Supprimer MediaItem
    const mediaItems = await prisma.mediaItem.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   - ${mediaItems.count} MediaItem supprimés`);

    // 13.5 Supprimer MontageProject (si le modèle existe)
    try {
      const montageProjects = await (prisma as any).montageProject.deleteMany({
        where: { createdBy: { organizationId: orgId } },
      });
      console.log(`   - ${montageProjects.count} MontageProject supprimés`);
    } catch {
      // Le modèle n'existe peut-être pas, ignorer
    }

    // 14. Supprimer User
    const users = await prisma.user.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   - ${users.count} User supprimés`);

    // 15. Supprimer Organization
    await prisma.organization.delete({
      where: { id: orgId },
    });
    console.log(`   - Organization supprimée`);

    console.log('\n✅ Radio RédacNews supprimée avec succès!');
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    throw error;
  }
}

deleteOrganization()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
