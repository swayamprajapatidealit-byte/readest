import { fetchWithTimeout } from '@/utils/fetch';
import { getPipelineHost } from './hosts';
import { buildAuthHeaders } from './session';

// `type` is present on live responses (seen values: "global", "GeneralExclude")
// but is metadata only — not used to scope which entity category an exclusion
// applies to. An excluded word is suppressed everywhere it'd otherwise match.
export interface ExcludeWordEntry {
  word?: string;
  type?: string[];
}

const fetchExcludeWords = async (path: string, token: string): Promise<ExcludeWordEntry[]> => {
  const res = await fetchWithTimeout(`${getPipelineHost()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(token) },
  });
  if (!res.ok) {
    throw new Error(`Failed to load exclude words from "${path}": ${res.status}`);
  }
  const { results } = (await res.json()) as { results?: ExcludeWordEntry[] };
  return results ?? [];
};

export const getExcludeWords = (bookId: string, token: string): Promise<ExcludeWordEntry[]> =>
  fetchExcludeWords(`exclude-file/${bookId}`, token);

export const getGeneralExclude = (token: string): Promise<ExcludeWordEntry[]> =>
  fetchExcludeWords('global-exclude-words', token);

// Book-specific + site-wide exclusions, merged into one flat list of raw words
// (normalization happens at the matching site — entityMatching.ts — alongside
// the same normalization applied to candidate names/aliases).
export const getBlockedWords = async (bookId: string, token: string): Promise<string[]> => {
  const [bookWords, generalWords] = await Promise.all([
    getExcludeWords(bookId, token),
    getGeneralExclude(token),
  ]);
  return [...bookWords, ...generalWords]
    .map((entry) => entry.word)
    .filter((word): word is string => !!word);
};
