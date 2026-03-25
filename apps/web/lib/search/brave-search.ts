// Helper pour la recherche web avec Brave Search API
// https://brave.com/search/api/

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
    }>;
  };
}

/**
 * Effectue une recherche web avec l'API Brave Search
 */
export async function searchWeb(
  query: string,
  count: number = 5,
  apiKey?: string
): Promise<BraveSearchResult[]> {
  // Utiliser la clé fournie ou fallback sur l'env var (pour développement local)
  const searchApiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY;

  if (!searchApiKey) {
    console.warn('BRAVE_SEARCH_API_KEY not set, web search disabled');
    return [];
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.append('q', query);
    url.searchParams.append('count', count.toString());
    url.searchParams.append('text_decorations', 'false');
    url.searchParams.append('search_lang', 'fr');
    url.searchParams.append('country', 'FR');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': searchApiKey,
      },
    });

    if (!response.ok) {
      console.error(`Brave Search API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: BraveSearchResponse = await response.json();

    return data.web?.results?.slice(0, count) || [];
  } catch (error: any) {
    console.error('Brave Search error:', error.message);
    return [];
  }
}

/**
 * Formate les résultats de recherche pour Claude
 */
export function formatSearchResults(results: BraveSearchResult[]): string {
  if (results.length === 0) {
    return 'Aucun résultat trouvé.';
  }

  return results
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.description}${result.age ? ` (${result.age})` : ''}`
    )
    .join('\n\n');
}
