/**
 * Seed pour le template complet "Tour des Clochers"
 *
 * Ce fichier crée le template avec la structure EXACTE de l'émission,
 * basé sur les conducteurs réels de Tiphaine (Riaillé, Orvault, etc.)
 *
 * Usage: npx tsx prisma/seed-tour-des-clochers.ts
 */

import { PrismaClient, RundownItemType } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// STRUCTURE COMPLÈTE DU TOUR DES CLOCHERS (7h00 - 9h00)
// ============================================================================

const tourDesClocherItems: Array<{
  type: RundownItemType;
  title: string;
  duration: number;
  startTime: string;
  script: string | null;
  notes: string | null;
  isFixed: boolean;
}> = [
  // ============================================================================
  // PREMIÈRE HEURE (7h00 - 8h00)
  // ============================================================================

  // --- 7h00-7h04 : OUVERTURE ---
  {
    type: 'STORY',
    title: 'Ouverture Clara',
    startTime: '7h00',
    duration: 60,
    script: `Bonjour, bonjour à toutes et à tous ! Très heureuse de vous retrouver, et j'espère que vous allez bien, en ce vendredi {{DATE_TEXTE}}.

Qui dit vendredi dit bientôt le week-end mais aussi le Tour des Clochers et oui ce matin on partage notre matinale avec Tiphaine Sellier, en direct de la paroisse {{PAROISSE}}.

Vous allez pouvoir découvrir ses clochers, son histoire et ceux qui la font vivre au quotidien. Ensemble sur Radio Fidélité.

Mais avant l'essentiel de votre actualité aujourd'hui.
Votre journal du jour présenté par Alex Gauthier`,
    notes: 'Clara en studio - Lancement de la matinale',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Flash national',
    startTime: '7h01',
    duration: 60,
    script: null,
    notes: 'Flash info national - 1 min',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Flash local',
    startTime: '7h02',
    duration: 60,
    script: null,
    notes: 'Flash info local Loire-Atlantique - 1 min',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Météo',
    startTime: '7h03',
    duration: 60,
    script: null,
    notes: 'Météo Loire-Atlantique - 1 min max',
    isFixed: true,
  },
  {
    type: 'BREAK',
    title: 'Publicité',
    startTime: '7h04',
    duration: 60,
    script: null,
    notes: 'Bloc pub 1',
    isFixed: true,
  },

  // --- 7h05-7h06 : PRÉSENTATION ---
  {
    type: 'STORY',
    title: 'Présentation de la matinale',
    startTime: '7h05',
    duration: 60,
    script: `C (Clara) : 7h06 sur Radio Fidélité, comme chaque vendredi matin, Tiphaine Sellier part à la rencontre des communautés chrétiennes de notre territoire avec le Tour des clochers.
Aujourd'hui, Tiphaine nous emmène {{DIRECTION_GEOGRAPHIQUE}}, à {{COMMUNE}} plus précisément.
Bonjour Tiphaine !

T (Tiphaine) : Bonjour Clara, bonjour à tous !
C'est au sein de la paroisse {{PAROISSE}} que nous avons installé nos micros ce matin.

C : Paroisse et commune que l'on va découvrir tout au long de cette matinée avec votre invité fil rouge…

T : Oui ! Je suis accueillie ce matin par {{INVITE_FIL_ROUGE}}.
Et nous recevrons aussi au cours de cette émission {{INVITES_VIE_PAROISSIALE}} pour parler de la vie de la paroisse,
{{INVITE_ELUS}} pour les élus,
{{INVITE_PATRIMOINE}} pour l'histoire et le patrimoine,
et {{INVITE_ASSOCIATION}} pour une association locale.

C : Et qui commence maintenant sur Radio Fidélité !`,
    notes: 'Dialogue Clara/Tiphaine - Présentation des invités',
    isFixed: false,
  },
  {
    type: 'JINGLE',
    title: 'Sponso + Générique Tour des Clochers',
    startTime: '7h06',
    duration: 30,
    script: null,
    notes: 'Sponsor + Générique TDC',
    isFixed: true,
  },

  // --- 7h07-7h14 : ACCUEIL DU PÈRE ---
  {
    type: 'INTERVIEW',
    title: 'Accueil du Père - Parcours',
    startTime: '7h07',
    duration: 420,
    script: `Merci Père de nous accueillir ce matin sur la paroisse {{PAROISSE}}.
Avant de parler de votre paroisse, j'aimerais qu'on parle un peu de vous.

• Comment est arrivé pour vous cet appel au sacerdoce ?
• Vous avez été ordonné prêtre en quelle année ?
• Quelles ont été vos affectations précédentes ?
• Quand êtes-vous arrivé sur cette paroisse ?`,
    notes: 'Interview parcours personnel du Père - 7 min',
    isFixed: false,
  },

  // --- 7h14-7h19 : ÉVANGILE ---
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    startTime: '7h14',
    duration: 10,
    script: null,
    notes: 'Virgule TDC',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Évangile du jour',
    startTime: '7h14',
    duration: 240,
    script: `L'évangile de ce jour est tiré de l'évangile selon Saint {{EVANGILE_LIVRE}}, chapitre {{EVANGILE_CHAPITRE}}, versets {{EVANGILE_VERSETS}}.

[Lecture de l'évangile]

Commentaire par {{COMMENTATEUR_EVANGILE}}.`,
    notes: 'Évangile + Commentaire - ~4 min',
    isFixed: false,
  },
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    startTime: '7h19',
    duration: 10,
    script: null,
    notes: 'Virgule TDC',
    isFixed: true,
  },

  // --- 7h20-7h28 : RETOUR PÈRE ---
  {
    type: 'INTERVIEW',
    title: 'Retour Père - Vie de la paroisse',
    startTime: '7h20',
    duration: 480,
    script: `On continue notre découverte de la paroisse {{PAROISSE}} avec {{INVITE_FIL_ROUGE}}.

• Pouvez-vous nous présenter votre paroisse ? (combien de clochers, de communes...)
• Quels sont les temps forts de votre paroisse ?
• Comment se vit la foi au quotidien ici ?
• Quels sont vos projets pour cette année pastorale ?`,
    notes: 'Interview vie paroissiale avec le Père - 8 min',
    isFixed: false,
  },

  // --- 7h28-7h31 : TRANSITION ---
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    startTime: '7h28',
    duration: 10,
    script: null,
    notes: 'Virgule TDC',
    isFixed: true,
  },
  {
    type: 'BREAK',
    title: 'Publicité',
    startTime: '7h28',
    duration: 120,
    script: null,
    notes: 'Bloc pub 2',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Météo',
    startTime: '7h30',
    duration: 60,
    script: null,
    notes: 'Météo flash',
    isFixed: true,
  },

  // --- 7h31-7h58 : VIE PAROISSIALE ---
  {
    type: 'JINGLE',
    title: 'Jingle retour antenne',
    startTime: '7h31',
    duration: 10,
    script: null,
    notes: 'Jingle retour après pub',
    isFixed: true,
  },
  {
    type: 'INTERVIEW',
    title: 'Vie paroissiale',
    startTime: '7h31',
    duration: 1620,
    script: `Nous allons maintenant à la rencontre de paroissiens engagés.

Pour ce premier créneau consacré à la vie paroissiale, je reçois {{INVITES_VIE_PAROISSIALE}}.

Questions pour les invités :
• Pouvez-vous vous présenter ?
• Comment en êtes-vous venu(e) à vous engager dans la paroisse ?
• En quoi consiste votre engagement ?
• Qu'est-ce que cet engagement vous apporte ?
• Comment les gens peuvent-ils rejoindre votre groupe/mouvement ?`,
    notes: 'Invités vie paroissiale - 27 min (7h31-7h58)',
    isFixed: false,
  },

  // --- 7h58-8h00 : TRANSITION ---
  {
    type: 'JINGLE',
    title: 'Jingle Tour des Clochers',
    startTime: '7h58',
    duration: 10,
    script: null,
    notes: 'Jingle TDC avant pub',
    isFixed: true,
  },
  {
    type: 'BREAK',
    title: 'Publicité',
    startTime: '7h58',
    duration: 110,
    script: null,
    notes: 'Bloc pub 3 - Fin première heure',
    isFixed: true,
  },

  // ============================================================================
  // DEUXIÈME HEURE (8h00 - 9h00)
  // ============================================================================

  // --- 8h00-8h05 : TOP HORAIRE ---
  {
    type: 'STORY',
    title: 'Top 8h + Flash national',
    startTime: '8h00',
    duration: 120,
    script: null,
    notes: 'Top horaire + Flash national',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Flash local',
    startTime: '8h02',
    duration: 60,
    script: null,
    notes: 'Flash info local',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Météo',
    startTime: '8h03',
    duration: 60,
    script: null,
    notes: 'Météo',
    isFixed: true,
  },
  {
    type: 'JINGLE',
    title: 'Jingle + Sponso Tour des Clochers',
    startTime: '8h05',
    duration: 30,
    script: null,
    notes: 'Jingle retour + Sponsor TDC',
    isFixed: true,
  },

  // --- 8h06-8h16 : ÉLUS / MAIRIE ---
  {
    type: 'INTERVIEW',
    title: 'Élus / Institution',
    startTime: '8h06',
    duration: 600,
    script: `Nous accueillons maintenant {{INVITE_ELUS}}.

Questions pour l'élu(e) :
• Pouvez-vous vous présenter et présenter votre fonction ?
• Quelles sont les caractéristiques de votre commune ?
• Quels sont les projets en cours ou à venir ?
• Quels sont les enjeux pour les habitants ?
• Un mot sur la vie associative de la commune ?`,
    notes: 'Interview élu(e) local(e) - 10 min (8h06-8h16)',
    isFixed: false,
  },
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    startTime: '8h16',
    duration: 10,
    script: null,
    notes: 'Virgule TDC',
    isFixed: true,
  },

  // --- 8h17-8h28 : HISTOIRE / PATRIMOINE ---
  {
    type: 'INTERVIEW',
    title: 'Histoire / Patrimoine',
    startTime: '8h17',
    duration: 660,
    script: `Pour parler de l'histoire et du patrimoine de {{COMMUNE}}, je reçois {{INVITE_PATRIMOINE}}.

Questions pour l'invité(e) :
• Pouvez-vous vous présenter ?
• Quelle est l'histoire de cette commune/paroisse ?
• Quels sont les éléments patrimoniaux remarquables ?
• Y a-t-il des anecdotes historiques intéressantes ?
• Comment ce patrimoine est-il préservé aujourd'hui ?`,
    notes: 'Interview histoire/patrimoine - 11 min (8h17-8h28)',
    isFixed: false,
  },

  // --- 8h28-8h30 : TRANSITION ---
  {
    type: 'JINGLE',
    title: 'Jingle Tour des Clochers',
    startTime: '8h28',
    duration: 10,
    script: null,
    notes: 'Jingle TDC',
    isFixed: true,
  },
  {
    type: 'BREAK',
    title: 'Publicité',
    startTime: '8h28',
    duration: 110,
    script: null,
    notes: 'Bloc pub 4',
    isFixed: true,
  },

  // --- 8h30-8h45 : RADIO VATICAN ---
  {
    type: 'STORY',
    title: 'Journal Radio Vatican',
    startTime: '8h30',
    duration: 900,
    script: null,
    notes: 'Journal international Radio Vatican - 15 min',
    isFixed: true,
  },
  {
    type: 'STORY',
    title: 'Retour antenne Clara',
    startTime: '8h45',
    duration: 20,
    script: `C (Clara) : 8h45 sur Radio Fidélité, nous retrouvons Tiphaine Sellier en direct de {{COMMUNE}} pour la suite et fin du Tour des Clochers de ce matin.`,
    notes: 'Transition Clara',
    isFixed: true,
  },
  {
    type: 'JINGLE',
    title: 'Jingle "Tour des Clochers jusqu\'à 9h"',
    startTime: '8h45',
    duration: 10,
    script: null,
    notes: 'Jingle spécial dernier segment',
    isFixed: true,
  },

  // --- 8h45-8h55 : ASSOCIATION ---
  {
    type: 'INTERVIEW',
    title: 'Association',
    startTime: '8h45',
    duration: 600,
    script: `Pour terminer cette matinée, nous accueillons {{INVITE_ASSOCIATION}} pour nous parler d'une association locale.

Questions pour l'invité(e) :
• Pouvez-vous vous présenter et présenter votre association ?
• Quand et pourquoi a-t-elle été créée ?
• Quelles sont vos actions concrètes ?
• Comment peut-on vous rejoindre ou vous soutenir ?
• Quels sont vos projets à venir ?`,
    notes: 'Interview association - 10 min (8h45-8h55)',
    isFixed: false,
  },

  // --- 8h55-8h58 : CONCLUSION PÈRE ---
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers personnalisée',
    startTime: '8h55',
    duration: 10,
    script: null,
    notes: 'Virgule TDC avec nom de la paroisse',
    isFixed: true,
  },
  {
    type: 'INTERVIEW',
    title: 'Conclusion avec le Père',
    startTime: '8h55',
    duration: 180,
    script: `Nous terminons cette matinale avec {{INVITE_FIL_ROUGE}}.

• Père, un dernier mot pour les auditeurs ?
• Comment peut-on rejoindre votre communauté ?
• Les horaires des messes ce week-end ?`,
    notes: 'Conclusion avec invité fil rouge - 3 min',
    isFixed: false,
  },

  // --- 8h58-9h00 : CONCLUSION FINALE ---
  {
    type: 'STORY',
    title: 'Conclusion Tiphaine',
    startTime: '8h58',
    duration: 60,
    script: `Merci beaucoup {{INVITE_FIL_ROUGE}} de nous avoir accueillis ce matin.
Merci à tous nos invités et merci à vous, chers auditeurs, de nous avoir suivis depuis {{COMMUNE}}.

On se retrouve vendredi prochain pour un nouveau Tour des Clochers !
{{PROCHAINE_DESTINATION}}

Je repasse l'antenne à Clara, bonne fin de journée !`,
    notes: 'Conclusion Tiphaine sur place',
    isFixed: false,
  },
  {
    type: 'STORY',
    title: 'Conclusion Clara + Appel aux dons',
    startTime: '8h59',
    duration: 50,
    script: `C (Clara) : Merci beaucoup Tiphaine, on vous retrouve dès vendredi prochain !

Et si vous souhaitez que Radio Fidélité se rende dans votre paroisse, n'hésitez pas à nous contacter au 02 40 69 27 27.

Pour rappel, tous les replay du Tour des clochers sont à réécouter sur www.radio-fidelite.fr

Et comme toujours, Radio Fidélité a besoin de votre soutien. Pour nous aider, rendez-vous sur radio-fidelite.fr, rubrique "nous soutenir".`,
    notes: 'Conclusion Clara en studio + Appel aux dons',
    isFixed: true,
  },
  {
    type: 'JINGLE',
    title: 'Sponso OUT',
    startTime: '8h59',
    duration: 10,
    script: null,
    notes: 'Sponsor de sortie',
    isFixed: true,
  },
  {
    type: 'BREAK',
    title: 'Publicité fin',
    startTime: '9h00',
    duration: 60,
    script: null,
    notes: 'Bloc pub fin - Transition vers programme suivant',
    isFixed: true,
  },
];

// ============================================================================
// VARIABLES DU TEMPLATE
// ============================================================================

interface TemplateVariable {
  name: string;
  label: string;
  category: string;
  required: boolean;
  defaultValue?: string;
}

const templateVariables: TemplateVariable[] = [
  // --- GÉNÉRAL ---
  { name: 'DATE_TEXTE', label: 'Date en texte', category: 'general', required: true, defaultValue: '' },
  { name: 'COMMUNE', label: 'Nom de la commune', category: 'general', required: true },
  { name: 'PAROISSE', label: 'Nom de la paroisse', category: 'general', required: true },
  { name: 'DIRECTION_GEOGRAPHIQUE', label: 'Direction géographique', category: 'general', required: false, defaultValue: 'dans le diocèse' },
  { name: 'DESCRIPTION_PAROISSE', label: 'Description courte', category: 'general', required: false },
  { name: 'PROCHAINE_DESTINATION', label: 'Prochaine destination', category: 'general', required: false },

  // --- INVITÉ FIL ROUGE ---
  { name: 'INVITE_FIL_ROUGE', label: 'Nom du Père/curé', category: 'fil_rouge', required: true },

  // --- ÉVANGILE ---
  { name: 'EVANGILE_LIVRE', label: 'Livre de l\'évangile', category: 'evangile', required: false, defaultValue: 'Luc' },
  { name: 'EVANGILE_CHAPITRE', label: 'Chapitre', category: 'evangile', required: false },
  { name: 'EVANGILE_VERSETS', label: 'Versets', category: 'evangile', required: false },
  { name: 'COMMENTATEUR_EVANGILE', label: 'Commentateur', category: 'evangile', required: false },

  // --- VIE PAROISSIALE ---
  { name: 'INVITES_VIE_PAROISSIALE', label: 'Liste des invités vie paroissiale', category: 'vie_paroissiale', required: false },

  // --- ÉLUS ---
  { name: 'INVITE_ELUS', label: 'Nom de l\'élu(e)', category: 'elus', required: false },

  // --- PATRIMOINE ---
  { name: 'INVITE_PATRIMOINE', label: 'Nom invité patrimoine', category: 'patrimoine', required: false },

  // --- ASSOCIATION ---
  { name: 'INVITE_ASSOCIATION', label: 'Nom invité association', category: 'association', required: false },
];

// ============================================================================
// FONCTION DE SEED
// ============================================================================

async function seedTourDesClochers() {
  console.log('🏠 Seed du template Tour des Clochers...\n');

  // 1. Trouver l'organisation (Radio Fidélité ou Radio RédacNews)
  let organization = await prisma.organization.findFirst({
    where: {
      OR: [
        { name: { contains: 'Fidélité', mode: 'insensitive' } },
        { name: { contains: 'Fidelite', mode: 'insensitive' } },
        { slug: { contains: 'fidelite' } },
        { name: { contains: 'RedacNews', mode: 'insensitive' } },
        { slug: { contains: 'redacnews' } },
      ],
    },
  });

  // Si pas trouvée, prendre la première organisation disponible
  if (!organization) {
    organization = await prisma.organization.findFirst();
  }

  if (!organization) {
    console.error('❌ Aucune organisation trouvée');
    console.log('   Exécutez d\'abord: npx tsx prisma/seed.ts');
    process.exit(1);
  }

  console.log(`✅ Organisation trouvée: ${organization.name}`);

  // 2. Trouver ou créer l'émission "Tour des Clochers"
  let show = await prisma.show.findFirst({
    where: {
      organizationId: organization.id,
      name: { contains: 'Tour des Clochers', mode: 'insensitive' },
    },
  });

  if (!show) {
    show = await prisma.show.create({
      data: {
        name: 'Le Tour des Clochers',
        description: 'Émission de découverte des paroisses du diocèse de Nantes, présentée par Tiphaine Sellier. Chaque vendredi de 7h à 9h.',
        defaultDuration: 120,
        color: '#D97706', // Amber
        category: 'MAGAZINE',
        startTime: '07:00',
        organizationId: organization.id,
      },
    });
    console.log(`✅ Émission créée: ${show.name}`);
  } else {
    // Mettre à jour l'heure de début si nécessaire
    if (show.startTime !== '07:00') {
      show = await prisma.show.update({
        where: { id: show.id },
        data: { startTime: '07:00' },
      });
      console.log(`✅ Émission mise à jour: ${show.name} (startTime: 07:00)`);
    } else {
      console.log(`✅ Émission existante: ${show.name} (startTime: ${show.startTime})`);
    }
  }

  // 3. Supprimer l'ancien template s'il existe
  const existingTemplate = await prisma.rundownTemplate.findFirst({
    where: {
      showId: show.id,
      OR: [
        { name: { contains: 'Tour des Clochers', mode: 'insensitive' } },
        { name: { contains: 'Conducteur complet', mode: 'insensitive' } },
      ],
    },
    include: { items: true },
  });

  if (existingTemplate) {
    await prisma.rundownTemplateItem.deleteMany({
      where: { templateId: existingTemplate.id },
    });
    await prisma.rundownTemplate.delete({
      where: { id: existingTemplate.id },
    });
    console.log(`🗑️  Ancien template supprimé: ${existingTemplate.name}`);
  }

  // 4. Créer le nouveau template
  const template = await prisma.rundownTemplate.create({
    data: {
      name: 'Tour des Clochers - Conducteur complet',
      description: `Template complet pour l'émission Tour des Clochers (7h-9h).

Structure :
• 7h00-7h04 : Ouverture (Clara) + Flash + Météo + Pub
• 7h05-7h06 : Présentation de la matinale
• 7h07-7h14 : Accueil du Père (parcours)
• 7h14-7h19 : Évangile du jour + commentaire
• 7h20-7h28 : Suite interview Père (paroisse)
• 7h28-7h31 : Virgule + Pub + Météo
• 7h31-7h58 : VIE PAROISSIALE (invités engagés)
• 7h58-8h05 : Jingle + Pub + Top 8h + Flash
• 8h06-8h16 : ÉLUS / MAIRIE
• 8h17-8h28 : HISTOIRE / PATRIMOINE
• 8h28-8h45 : Jingle + Pub + Radio Vatican
• 8h45-8h55 : ASSOCIATION
• 8h55-8h58 : Conclusion avec le Père
• 8h58-9h00 : Conclusion + Appel dons

Présentatrice : Tiphaine Sellier
En studio : Clara Bert`,
      showId: show.id,
      organizationId: organization.id,
      isDefault: true,
      variables: templateVariables as any,
    },
  });

  console.log(`✅ Template créé: ${template.name}`);

  // 5. Créer les items du template
  const itemsData = tourDesClocherItems.map((item, index) => ({
    templateId: template.id,
    type: item.type,
    title: item.title,
    duration: item.duration,
    position: index,
    notes: item.notes ? `${item.startTime} - ${item.notes}` : item.startTime,
    script: item.script,
  }));

  await prisma.rundownTemplateItem.createMany({
    data: itemsData,
  });

  console.log(`✅ ${itemsData.length} éléments créés`);

  // 6. Afficher le résumé
  const totalDuration = itemsData.reduce((sum, item) => sum + item.duration, 0);
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  const fixedItems = tourDesClocherItems.filter((i) => i.isFixed).length;
  const variableItems = tourDesClocherItems.filter((i) => !i.isFixed).length;

  console.log('\n📋 Résumé du template:');
  console.log(`   - Nom: ${template.name}`);
  console.log(`   - Émission: ${show.name}`);
  console.log(`   - Éléments totaux: ${itemsData.length}`);
  console.log(`   - Éléments fixes: ${fixedItems}`);
  console.log(`   - Éléments variables: ${variableItems}`);
  console.log(`   - Durée totale: ${hours}h${minutes.toString().padStart(2, '0')}`);
  console.log(`   - Variables: ${templateVariables.length}`);

  console.log('\n📝 Catégories de variables:');
  const categories = [...new Set(templateVariables.map((v) => v.category))];
  categories.forEach((cat) => {
    const vars = templateVariables.filter((v) => v.category === cat);
    console.log(`   - ${cat}: ${vars.length} variables`);
  });

  console.log('\n✨ Seed terminé avec succès!');
}

seedTourDesClochers()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
