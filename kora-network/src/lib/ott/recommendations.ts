export type KoraRecommendationReason = 'continue_watching' | 'genre_match' | 'language_match' | 'new_release';

export interface KoraRecommendationItem {
  id: string;
  title: string;
  score: number;
  reason: KoraRecommendationReason;
}

export interface KoraRecommendationInput {
  productions: Array<{
    id: string;
    title: string;
    genre?: string | null;
    primary_language?: string | null;
    created_at?: string | null;
  }>;
  continueWatching: Array<{ productionId: string }>;
  preferredGenres?: string[];
  preferredLanguages?: string[];
  now?: Date;
}

export function rankRecommendations(input: KoraRecommendationInput): KoraRecommendationItem[] {
  const watched = new Set(input.continueWatching.map((item) => item.productionId));
  const genres = new Set((input.preferredGenres ?? []).map((item) => item.toLowerCase()));
  const languages = new Set((input.preferredLanguages ?? []).map((item) => item.toLowerCase()));
  const now = input.now ?? new Date();

  return input.productions
    .filter((item) => !watched.has(item.id))
    .map((item): KoraRecommendationItem => {
      const genreMatch = Boolean(item.genre && genres.has(item.genre.toLowerCase()));
      const languageMatch = Boolean(item.primary_language && languages.has(item.primary_language.toLowerCase()));
      const ageDays = item.created_at
        ? Math.max(0, (now.getTime() - new Date(item.created_at).getTime()) / 86400000)
        : 999;
      const score = (genreMatch ? 50 : 0) + (languageMatch ? 30 : 0) + Math.max(0, 20 - Math.min(20, ageDays));
      const reason: KoraRecommendationReason = genreMatch
        ? 'genre_match'
        : languageMatch
          ? 'language_match'
          : 'new_release';
      return { id: item.id, title: item.title, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
