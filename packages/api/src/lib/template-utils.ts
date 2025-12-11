/**
 * Utilitaires pour les templates de conducteur
 */

/**
 * Remplace les variables {{NOM}} dans un texte par leurs valeurs
 * @param text - Le texte contenant des variables {{NOM}}
 * @param variables - Un objet clé/valeur des variables à remplacer
 * @returns Le texte avec les variables remplacées, ou null si le texte est null/undefined
 */
export function replaceVariables(
  text: string | null | undefined,
  variables: Record<string, string>
): string | null {
  if (!text) return null;

  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    // Remplace {{KEY}} par la valeur, en échappant les caractères spéciaux regex
    const regex = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Échappe les caractères spéciaux pour une utilisation dans une regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extrait les noms de variables depuis un texte
 * @param text - Le texte contenant des variables {{NOM}}
 * @returns Un tableau des noms de variables uniques trouvés
 */
export function extractVariables(text: string | null | undefined): string[] {
  if (!text) return [];

  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = regex.exec(text)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Type pour la définition d'une variable de template
 */
export interface TemplateVariable {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}

/**
 * Valide que toutes les variables requises sont fournies
 * @param variables - Les définitions de variables du template
 * @param values - Les valeurs fournies
 * @returns Un objet avec le résultat de validation et les erreurs éventuelles
 */
export function validateVariables(
  variables: TemplateVariable[],
  values: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const variable of variables) {
    if (variable.required && !values[variable.name]?.trim()) {
      errors.push(`La variable "${variable.label}" est requise`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prépare les valeurs des variables en appliquant les valeurs par défaut
 * @param variables - Les définitions de variables du template
 * @param values - Les valeurs fournies
 * @returns Un objet avec toutes les valeurs (fournies ou par défaut)
 */
export function prepareVariableValues(
  variables: TemplateVariable[],
  values: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const variable of variables) {
    result[variable.name] =
      values[variable.name]?.trim() || variable.defaultValue || '';
  }

  return result;
}

/**
 * Applique un template à un conducteur existant
 * Crée les items du conducteur basés sur le template
 */
export async function applyTemplate(
  db: any,
  rundownId: string,
  template: {
    items: Array<{
      type: string;
      title: string;
      duration: number;
      position: number;
      notes: string | null;
      script: string | null;
    }>;
  },
  variables: Record<string, string>
): Promise<void> {
  // Créer les items du conducteur depuis le template
  for (const templateItem of template.items) {
    await db.rundownItem.create({
      data: {
        rundownId,
        type: templateItem.type,
        title: replaceVariables(templateItem.title, variables) || templateItem.title,
        duration: templateItem.duration,
        position: templateItem.position,
        notes: replaceVariables(templateItem.notes, variables),
        script: replaceVariables(templateItem.script, variables),
        status: 'PENDING',
      },
    });
  }
}
