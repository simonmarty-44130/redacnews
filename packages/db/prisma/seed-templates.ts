/**
 * Seed pour les templates de conducteur
 *
 * Ce fichier crée le template "Tour des Clochers" avec sa structure complète.
 * Usage: npx tsx prisma/seed-templates.ts
 */

import { PrismaClient, RundownItemType } from '@prisma/client';

const prisma = new PrismaClient();

// Structure du Tour des Clochers - émission de 2h (~7200 secondes)
const tourDesClocherItems: Array<{
  type: RundownItemType;
  title: string;
  duration: number; // en secondes
  script: string | null;
  notes: string | null;
}> = [
  // === OUVERTURE (12:00 - 12:05) ===
  {
    type: 'JINGLE',
    title: 'Jingle Ouverture Tour des Clochers',
    duration: 15,
    script: null,
    notes: 'Lancer le jingle dès le top horaire',
  },
  {
    type: 'STORY',
    title: 'Lancement {{PAROISSE}}',
    duration: 90,
    script: `Bonjour à tous et bienvenue dans le Tour des Clochers !

Ce matin, nous posons nos valises à {{PAROISSE}}. Pendant deux heures, nous allons découvrir cette paroisse, rencontrer ses acteurs, ses bénévoles, et comprendre ce qui fait battre son cœur.

Je suis accompagné(e) aujourd'hui de toute l'équipe de Radio Fidélité, et nous avons le plaisir d'être accueillis par la communauté de {{PAROISSE}}.

Restez avec nous, c'est parti !`,
    notes: 'Sourire, enthousiasme !',
  },
  {
    type: 'STORY',
    title: 'Présentation de la paroisse {{PAROISSE}}',
    duration: 300,
    script: `{{PAROISSE}}, c'est une paroisse de... [À COMPLÉTER avec les données locales]

Quelques chiffres :
- Nombre de clochers : ...
- Population : ...
- Équipe pastorale : ...

[Historique rapide de la paroisse]`,
    notes: 'Préparer les chiffres clés en amont',
  },
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },

  // === BLOC INFO (12:05 - 12:10) ===
  {
    type: 'STORY',
    title: 'Flash Info',
    duration: 180,
    script: null,
    notes: 'Flash info national/régional pré-enregistré',
  },
  {
    type: 'STORY',
    title: 'Météo',
    duration: 60,
    script: `Et maintenant la météo pour ce dimanche...

[Prévisions du jour]

Températures prévues : ...`,
    notes: null,
  },

  // === PUBLICITÉ 1 (12:10 - 12:13) ===
  {
    type: 'BREAK',
    title: 'Publicité',
    duration: 180,
    script: null,
    notes: 'Bloc pub 1',
  },

  // === INTERVIEW 1 : LE CURÉ (12:13 - 12:25) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'INTERVIEW',
    title: 'Interview 1 - {{INVITE_1}}',
    duration: 600,
    script: `Nous recevons maintenant {{INVITE_1}}.

Questions suggérées :
1. Pouvez-vous vous présenter et nous parler de votre mission à {{PAROISSE}} ?
2. Comment décririez-vous la vie paroissiale ici ?
3. Quels sont les temps forts de l'année ?
4. Quels défis rencontrez-vous ?
5. Un message pour les auditeurs ?`,
    notes: 'Interview avec le curé ou responsable pastoral',
  },

  // === ÉVANGILE (12:25 - 12:30) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'STORY',
    title: "Évangile du jour",
    duration: 240,
    script: `L'Évangile de ce dimanche est tiré de...

[Lecture de l'Évangile]

Un court commentaire de notre invité {{INVITE_1}} :
[Laisser la parole]`,
    notes: "Préparer l'Évangile du jour",
  },

  // === PUBLICITÉ 2 (12:30 - 12:33) ===
  {
    type: 'BREAK',
    title: 'Publicité',
    duration: 180,
    script: null,
    notes: 'Bloc pub 2',
  },

  // === INTERVIEW 2 : VIE PAROISSIALE (12:33 - 12:50) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'INTERVIEW',
    title: 'Interview 2 - {{INVITE_2}}',
    duration: 600,
    script: `Place maintenant à la vie paroissiale avec {{INVITE_2}}.

Questions suggérées :
1. Quel est votre engagement dans la paroisse ?
2. Parlez-nous de votre activité/mouvement...
3. Comment les gens peuvent-ils rejoindre cette aventure ?
4. Une anecdote à partager ?`,
    notes: 'Responsable de mouvement ou bénévole actif',
  },

  // === MUSIQUE (12:50 - 12:54) ===
  {
    type: 'MUSIC',
    title: 'Pause musicale',
    duration: 240,
    script: null,
    notes: 'Chant religieux ou musique de la paroisse',
  },

  // === PUBLICITÉ 3 (12:54 - 12:57) ===
  {
    type: 'BREAK',
    title: 'Publicité',
    duration: 180,
    script: null,
    notes: 'Bloc pub 3',
  },

  // === INTERVIEW 3 : CATÉCHÈSE/JEUNES (12:57 - 13:15) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'INTERVIEW',
    title: 'Interview 3 - {{INVITE_3}}',
    duration: 600,
    script: `Nous accueillons {{INVITE_3}} pour parler de la catéchèse et de la jeunesse.

Questions suggérées :
1. Comment fonctionne la catéchèse à {{PAROISSE}} ?
2. Combien d'enfants/jeunes sont concernés ?
3. Quelles activités proposez-vous ?
4. Comment toucher les familles aujourd'hui ?`,
    notes: 'Catéchiste ou animateur jeunesse',
  },

  // === TÉMOIGNAGES PAROISSIENS (13:15 - 13:25) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'INTERVIEW',
    title: 'Micro-trottoir paroissiens',
    duration: 480,
    script: `Nous avons rencontré quelques paroissiens de {{PAROISSE}}. Écoutons leurs témoignages...

[Lancer les sons pré-enregistrés ou interviews en direct]

Merci à tous ces témoins de leur foi !`,
    notes: 'Sons pré-enregistrés ou témoignages en direct',
  },

  // === PUBLICITÉ 4 (13:25 - 13:28) ===
  {
    type: 'BREAK',
    title: 'Publicité',
    duration: 180,
    script: null,
    notes: 'Bloc pub 4',
  },

  // === INTERVIEW 4 : SOLIDARITÉ (13:28 - 13:45) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'INTERVIEW',
    title: 'Interview 4 - {{INVITE_4}}',
    duration: 600,
    script: `La solidarité est au cœur de la vie chrétienne. {{INVITE_4}} nous en parle.

Questions suggérées :
1. Quelles actions de solidarité à {{PAROISSE}} ?
2. Comment les paroissiens s'engagent-ils ?
3. Des exemples concrets d'entraide ?
4. Comment aider ?`,
    notes: 'Responsable Secours Catholique, Conférences St Vincent de Paul...',
  },

  // === AGENDA PAROISSIAL (13:45 - 13:50) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'STORY',
    title: 'Agenda paroissial',
    duration: 240,
    script: `Voici les rendez-vous à ne pas manquer à {{PAROISSE}} :

[Liste des événements à venir]
- Messes dominicales : ...
- Événements spéciaux : ...
- Permanences : ...

Toutes les infos sur le site de la paroisse ou dans le bulletin paroissial.`,
    notes: 'Préparer la liste des événements',
  },

  // === MUSIQUE (13:50 - 13:54) ===
  {
    type: 'MUSIC',
    title: 'Intermède musical',
    duration: 240,
    script: null,
    notes: 'Musique locale ou chant de la paroisse',
  },

  // === CONCLUSION (13:54 - 14:00) ===
  {
    type: 'JINGLE',
    title: 'Virgule Tour des Clochers',
    duration: 8,
    script: null,
    notes: null,
  },
  {
    type: 'STORY',
    title: 'Conclusion et remerciements',
    duration: 180,
    script: `Notre Tour des Clochers à {{PAROISSE}} touche à sa fin.

Un grand merci à tous nos invités :
- {{INVITE_1}}
- {{INVITE_2}}
- {{INVITE_3}}
- {{INVITE_4}}

Et merci à vous, chers auditeurs, pour votre fidélité !

La semaine prochaine, le Tour des Clochers fera étape à... [PROCHAINE DESTINATION]

D'ici là, bonne semaine à tous et que Dieu vous bénisse !`,
    notes: 'Annoncer la prochaine destination',
  },
  {
    type: 'JINGLE',
    title: 'Jingle Fin Tour des Clochers',
    duration: 15,
    script: null,
    notes: 'Jingle de clôture',
  },
];

// Variables du template
const templateVariables = [
  {
    name: 'PAROISSE',
    label: 'Nom de la paroisse',
    required: true,
    defaultValue: '',
  },
  {
    name: 'INVITE_1',
    label: 'Invité 1 (ex: Père Michel, curé)',
    required: false,
    defaultValue: 'Invité 1',
  },
  {
    name: 'INVITE_2',
    label: 'Invité 2 (responsable vie paroissiale)',
    required: false,
    defaultValue: 'Invité 2',
  },
  {
    name: 'INVITE_3',
    label: 'Invité 3 (catéchèse/jeunesse)',
    required: false,
    defaultValue: 'Invité 3',
  },
  {
    name: 'INVITE_4',
    label: 'Invité 4 (solidarité/action sociale)',
    required: false,
    defaultValue: 'Invité 4',
  },
];

async function seedTemplates() {
  console.log('🌱 Création du template Tour des Clochers...\n');

  // 1. Trouver ou créer l'organisation (utiliser la première existante)
  let organization = await prisma.organization.findFirst();

  if (!organization) {
    console.log("⚠️  Aucune organisation trouvée. Création d'une organisation de test...");
    organization = await prisma.organization.create({
      data: {
        name: 'Radio Fidélité',
        slug: 'radio-fidelite',
      },
    });
    console.log(`✅ Organisation créée: ${organization.name}`);
  } else {
    console.log(`📻 Organisation: ${organization.name}`);
  }

  // 2. Trouver ou créer l'émission "Tour des Clochers"
  let show = await prisma.show.findFirst({
    where: {
      name: 'Tour des Clochers',
      organizationId: organization.id,
    },
  });

  if (!show) {
    show = await prisma.show.create({
      data: {
        name: 'Tour des Clochers',
        description: "Émission dominicale de 2h à la découverte des paroisses du diocèse",
        defaultDuration: 120, // 2 heures
        color: '#8B5CF6', // violet
        category: 'MAGAZINE',
        startTime: '07:00', // Le Tour des Clochers commence à 7h
        organizationId: organization.id,
      },
    });
    console.log(`✅ Émission créée: ${show.name} (debut: 07:00)`);
  } else {
    // Mettre à jour l'heure de début si l'émission existe déjà
    show = await prisma.show.update({
      where: { id: show.id },
      data: { startTime: '07:00' },
    });
    console.log(`📺 Émission existante mise à jour: ${show.name} (debut: 07:00)`);
  }

  // 3. Vérifier si le template existe déjà
  const existingTemplate = await prisma.rundownTemplate.findFirst({
    where: {
      name: 'Tour des Clochers - Standard',
      showId: show.id,
    },
  });

  if (existingTemplate) {
    console.log(`⚠️  Le template "${existingTemplate.name}" existe déjà. Suppression et recréation...`);
    await prisma.rundownTemplate.delete({
      where: { id: existingTemplate.id },
    });
  }

  // 4. Créer le template
  const template = await prisma.rundownTemplate.create({
    data: {
      name: 'Tour des Clochers - Standard',
      description:
        "Template standard pour l'émission Tour des Clochers. Structure de 2h avec 4 interviews, pauses pub, évangile et agenda paroissial.",
      showId: show.id,
      organizationId: organization.id,
      isDefault: true,
      variables: templateVariables,
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
    notes: item.notes,
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

  console.log('\n📋 Résumé du template:');
  console.log(`   - Nom: ${template.name}`);
  console.log(`   - Émission: ${show.name}`);
  console.log(`   - Éléments: ${itemsData.length}`);
  console.log(`   - Durée totale: ${hours}h${minutes.toString().padStart(2, '0')}`);
  console.log(`   - Variables: ${templateVariables.length}`);
  console.log('\n✨ Seed terminé avec succès!');
}

seedTemplates()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
