// Configuration du pluralisme politique pour radios françaises (ARCOM)

export const POLITICAL_FAMILIES = {
  EXG: {
    code: 'EXG' as const,
    label: 'Extrême gauche',
    shortLabel: 'Ext. gauche',
    color: '#E53935',
    bgColor: 'bg-red-600',
    textColor: 'text-red-600',
    borderColor: 'border-red-600',
    bgLight: 'bg-red-100',
    parties: ['LFI', 'NPA', 'LO', 'POI'],
  },
  GAU: {
    code: 'GAU' as const,
    label: 'Gauche',
    shortLabel: 'Gauche',
    color: '#EC407A',
    bgColor: 'bg-pink-500',
    textColor: 'text-pink-500',
    borderColor: 'border-pink-500',
    bgLight: 'bg-pink-100',
    parties: ['PS', 'PCF', 'PRG', 'Génération.s'],
  },
  ECO: {
    code: 'ECO' as const,
    label: 'Écologistes',
    shortLabel: 'Écolo',
    color: '#43A047',
    bgColor: 'bg-green-600',
    textColor: 'text-green-600',
    borderColor: 'border-green-600',
    bgLight: 'bg-green-100',
    parties: ['EELV', 'Les Écologistes', 'Cap Écologie'],
  },
  CEN: {
    code: 'CEN' as const,
    label: 'Centre',
    shortLabel: 'Centre',
    color: '#FB8C00',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500',
    bgLight: 'bg-orange-100',
    parties: ['Renaissance', 'MoDem', 'Horizons', 'UDI', 'Agir'],
  },
  DRO: {
    code: 'DRO' as const,
    label: 'Droite',
    shortLabel: 'Droite',
    color: '#1E88E5',
    bgColor: 'bg-blue-600',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-600',
    bgLight: 'bg-blue-100',
    parties: ['LR', 'Les Républicains'],
  },
  EXD: {
    code: 'EXD' as const,
    label: 'Extrême droite',
    shortLabel: 'Ext. droite',
    color: '#283593',
    bgColor: 'bg-indigo-900',
    textColor: 'text-indigo-900',
    borderColor: 'border-indigo-900',
    bgLight: 'bg-indigo-100',
    parties: ['RN', 'Reconquête'],
  },
  DIV: {
    code: 'DIV' as const,
    label: 'Divers / Sans étiquette',
    shortLabel: 'Divers',
    color: '#757575',
    bgColor: 'bg-gray-500',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-500',
    bgLight: 'bg-gray-100',
    parties: ['DVG', 'DVD', 'SE'],
  },
  AUT: {
    code: 'AUT' as const,
    label: 'Autres',
    shortLabel: 'Autres',
    color: '#8E24AA',
    bgColor: 'bg-purple-600',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-600',
    bgLight: 'bg-purple-100',
    parties: ['Régionalistes', 'Indépendants'],
  },
} as const;

export type PoliticalFamilyCode = keyof typeof POLITICAL_FAMILIES;

export const ELECTION_TYPES = {
  MUNICIPALES: {
    code: 'MUNICIPALES' as const,
    label: 'Municipales',
    icon: '🏛️',
    description: 'Élections municipales',
  },
  LEGISLATIVES: {
    code: 'LEGISLATIVES' as const,
    label: 'Législatives',
    icon: '🏛️',
    description: 'Élections législatives',
  },
  PRESIDENTIELLE: {
    code: 'PRESIDENTIELLE' as const,
    label: 'Présidentielle',
    icon: '🇫🇷',
    description: 'Élection présidentielle',
  },
  EUROPEENNES: {
    code: 'EUROPEENNES' as const,
    label: 'Européennes',
    icon: '🇪🇺',
    description: 'Élections européennes',
  },
  REGIONALES: {
    code: 'REGIONALES' as const,
    label: 'Régionales',
    icon: '🗺️',
    description: 'Élections régionales',
  },
  DEPARTEMENTALES: {
    code: 'DEPARTEMENTALES' as const,
    label: 'Départementales',
    icon: '📍',
    description: 'Élections départementales',
  },
  SENATORIALES: {
    code: 'SENATORIALES' as const,
    label: 'Sénatoriales',
    icon: '🏛️',
    description: 'Élections sénatoriales',
  },
  OTHER: {
    code: 'OTHER' as const,
    label: 'Autre',
    icon: '📋',
    description: 'Autre type de scrutin',
  },
} as const;

export type ElectionTypeCode = keyof typeof ELECTION_TYPES;

// Seuils d'alerte pour le déséquilibre (règles ARCOM)
export const BALANCE_THRESHOLDS = {
  // Alerte jaune : un parti dépasse ce % ou est en dessous du minimum
  WARNING_MAX_PERCENT: 30,
  WARNING_MIN_PERCENT: 5,
  // Alerte rouge : un parti dépasse ce % ou est absent
  DANGER_MAX_PERCENT: 40,
  DANGER_MIN_PERCENT: 0,
  // Écart acceptable par rapport à la moyenne (±20%)
  ACCEPTABLE_DEVIATION: 20,
} as const;

// Fonction utilitaire pour formater la durée en MM:SS
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Fonction utilitaire pour formater la durée en HH:MM:SS
export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Type pour les statistiques de balance
export interface PoliticalBalanceStats {
  family: PoliticalFamilyCode;
  storyCount: number;
  speakingTimeSeconds: number;
  percentage: number;
  status: 'ok' | 'warning' | 'danger';
}

export interface PluralismReport {
  startDate: Date;
  endDate: Date;
  electionType?: ElectionTypeCode;
  totalStories: number;
  totalSpeakingTime: number;
  familyStats: PoliticalBalanceStats[];
  alerts: {
    type: 'warning' | 'danger';
    message: string;
    family: PoliticalFamilyCode;
  }[];
  isBalanced: boolean;
}

// Calculer le statut d'équilibre pour une famille politique
export function calculateBalanceStatus(
  percentage: number,
  familyCount: number
): 'ok' | 'warning' | 'danger' {
  // Si aucune famille représentée, c'est danger
  if (familyCount === 0) return 'danger';

  const avgPercent = 100 / familyCount;

  // Vérifier les seuils de danger
  if (percentage >= BALANCE_THRESHOLDS.DANGER_MAX_PERCENT) return 'danger';
  if (percentage <= BALANCE_THRESHOLDS.DANGER_MIN_PERCENT) return 'danger';

  // Vérifier les seuils d'avertissement
  if (percentage >= BALANCE_THRESHOLDS.WARNING_MAX_PERCENT) return 'warning';
  if (percentage <= BALANCE_THRESHOLDS.WARNING_MIN_PERCENT) return 'warning';

  // Vérifier l'écart par rapport à la moyenne
  const deviation = Math.abs(percentage - avgPercent);
  if (deviation > BALANCE_THRESHOLDS.ACCEPTABLE_DEVIATION) return 'warning';

  return 'ok';
}
