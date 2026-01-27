/**
 * Configuration des catégories de sujets
 */

export const STORY_CATEGORIES = [
  'Actualite',
  'Politique',
  'Economie',
  'Societe',
  'Culture',
  'Sport',
  'Meteo',
  'International',
  'Environnement',
  'Local',
  'Sommaire 07h',
  'Sommaire 08h',
] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];

/**
 * Catégories pour les filtres (avec option "Toutes")
 */
export const STORY_CATEGORIES_WITH_ALL = [
  { value: 'all', label: 'Toutes les categories' },
  ...STORY_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
];

/**
 * Statuts des sujets
 */
export const STORY_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'IN_REVIEW', label: 'En revision' },
  { value: 'APPROVED', label: 'Valide' },
  { value: 'PUBLISHED', label: 'Publie' },
  { value: 'ARCHIVED', label: 'Archive' },
] as const;

export type StoryStatus = (typeof STORY_STATUS_OPTIONS)[number]['value'];
