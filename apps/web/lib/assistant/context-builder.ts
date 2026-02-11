// Constructeur de contexte métier automatique pour l'assistant

/**
 * Construit un contexte métier automatique à injecter dans la conversation.
 * Appelé quand l'utilisateur ouvre l'assistant depuis une page spécifique.
 */

interface MetierContext {
  currentStory?: {
    title: string;
    content: string;
    duration?: number;
    status: string;
  };
  currentRundown?: {
    showName: string;
    date: string;
    items: { title: string; duration: number; type: string }[];
  };
  recentStories?: { title: string; status: string }[];
}

export function buildContextMessage(context: MetierContext): string {
  const parts: string[] = [];

  if (context.currentStory) {
    parts.push(
      `📝 SUJET EN COURS D'ÉDITION :`,
      `Titre : ${context.currentStory.title}`,
      `Statut : ${context.currentStory.status}`,
      context.currentStory.duration
        ? `Durée estimée : ${Math.floor(context.currentStory.duration / 60)}:${String(context.currentStory.duration % 60).padStart(2, '0')}`
        : '',
      `Contenu actuel :`,
      `---`,
      context.currentStory.content.substring(0, 2000), // Limiter la taille
      `---`
    );
  }

  if (context.currentRundown) {
    parts.push(
      `\n📋 CONDUCTEUR ACTIF :`,
      `Émission : ${context.currentRundown.showName}`,
      `Date : ${context.currentRundown.date}`,
      `Éléments :`,
      ...context.currentRundown.items.map(
        (item, i) =>
          `  ${i + 1}. [${item.type}] ${item.title} (${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')})`
      )
    );
  }

  if (context.recentStories && context.recentStories.length > 0) {
    parts.push(
      `\n📰 DERNIERS SUJETS :`,
      ...context.recentStories.map((s) => `  - ${s.title} (${s.status})`)
    );
  }

  if (parts.length === 0) return '';

  return (
    `[Contexte RédacNews automatique — ces informations proviennent de ta session de travail actuelle]\n\n` +
    parts.filter(Boolean).join('\n')
  );
}
