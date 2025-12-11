/**
 * Utilitaires pour l'extraction de texte de script
 * Utilises notamment pour les conducteurs imbriques (reperes de fin)
 */

/**
 * Extrait les N dernieres phrases d'un texte
 * @param text Le texte source
 * @param count Nombre de phrases a extraire (par defaut 2)
 * @returns Un tableau des dernieres phrases
 */
export function extractLastSentences(text: string, count: number = 2): string[] {
  if (!text || text.trim().length === 0) return [];

  // Nettoyer le texte
  const cleanedText = text
    .replace(/\n+/g, ' ') // Remplacer les retours a la ligne par des espaces
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();

  // Decouper en phrases (points, points d'exclamation, points d'interrogation)
  // On garde le delimiteur avec la phrase precedente
  const sentences = cleanedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Ignorer les phrases trop courtes

  // Retourner les N dernieres phrases
  return sentences.slice(-count);
}

/**
 * Recupere les phrases de fin d'un conducteur (pour le repere dans le conducteur parent)
 * Parcourt les items en ordre inverse pour trouver du texte significatif
 * @param items Les items du conducteur avec leur script
 * @returns Les 2 dernieres phrases significatives
 */
export function getRundownEndCues(
  items: Array<{ script: string | null; position: number }>
): string[] {
  // Trier par position decroissante pour avoir les derniers items en premier
  const sortedItems = [...items].sort((a, b) => b.position - a.position);

  // Parcourir les items en ordre inverse pour trouver du texte
  for (const item of sortedItems) {
    const script = item.script;
    if (script && script.trim().length > 0) {
      const sentences = extractLastSentences(script, 2);
      if (sentences.length > 0) {
        return sentences;
      }
    }
  }

  return [];
}

/**
 * Formate une duree en secondes en format lisible (MM'SS")
 * @param seconds Duree en secondes
 * @returns Duree formatee
 */
export function formatDurationScript(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}'${sec.toString().padStart(2, '0')}"` : `${min}'00"`;
}

/**
 * Etat d'un conducteur imbrique pour l'indicateur visuel
 */
export type LinkedRundownState = 'empty' | 'draft' | 'ready';

/**
 * Calcule l'etat d'un conducteur imbrique pour l'indicateur visuel
 * - 'ready': Conducteur marque READY ou ON_AIR (vert)
 * - 'draft': Conducteur en cours avec >30% de contenu (orange)
 * - 'empty': Conducteur vide ou < 30% rempli (rouge)
 *
 * @param linkedRundown Le conducteur lie avec son statut et ses items
 * @returns L'etat du conducteur
 */
export function getLinkedRundownState(linkedRundown: {
  status: string;
  items: Array<{ script: string | null; googleDocId: string | null }>;
}): LinkedRundownState {
  // Si marque READY ou ON_AIR → vert
  if (linkedRundown.status === 'READY' || linkedRundown.status === 'ON_AIR') {
    return 'ready';
  }

  // Calculer le taux de remplissage
  const total = linkedRundown.items.length;
  if (total === 0) return 'empty';

  const filled = linkedRundown.items.filter(
    (item) => item.script || item.googleDocId
  ).length;

  const fillRate = filled / total;

  // < 30% rempli → rouge
  if (fillRate < 0.3) return 'empty';

  // Sinon → orange (en cours)
  return 'draft';
}
