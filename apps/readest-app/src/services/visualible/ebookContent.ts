import { fetchWithTimeout } from '@/utils/fetch';
import { getMarketplaceHost } from './hosts';
import { buildAuthHeaders } from './session';
import { decryptAesCbc, fetchAccessKey, fetchSignedUrl } from './epubSource';
import type { CharacterEntity, FootnoteEntity, GlossaryEntity, PlaceEntity } from './entityTypes';

interface PipelinePrompt {
  code: string;
  title: string;
  contentType: string;
}

interface PipelineResult {
  id: number;
  outputUrl: string;
  prompt: PipelinePrompt;
}

interface PipelineResponse {
  pipelineVersion?: string;
  footNoteUrl?: string;
  results: PipelineResult[];
  error?: boolean;
}

export interface EbookContent {
  characters: CharacterEntity[];
  places: PlaceEntity[];
  glossary: GlossaryEntity[];
  footnotes: FootnoteEntity[];
  // Populated by openBook.ts (a separate fetch, gated on BookDetail.excludeVersion),
  // not by getEbookContent — absent/empty means nothing is excluded.
  excludedWords?: string[];
  pipelineVersion?: string;
}

const getPipeline = async (pipelineId: number, token: string): Promise<PipelineResponse> => {
  const res = await fetchWithTimeout(`${getMarketplaceHost()}pipeline/${pipelineId}`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to load pipeline for "${pipelineId}": ${res.status}`);
  }
  return res.json();
};

// Fetches a `.enc` object via signed-url + access-key and decrypts it in one step.
const fetchDecryptedJson = async (objectKey: string, token: string): Promise<unknown> => {
  const [signedUrl, { key, iv }] = await Promise.all([
    fetchSignedUrl(objectKey, token),
    fetchAccessKey(objectKey, token),
  ]);
  const res = await fetchWithTimeout(signedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch encrypted file "${objectKey}": ${res.status}`);
  }
  const encryptedBuffer = await res.arrayBuffer();
  const decrypted = await decryptAesCbc(encryptedBuffer, key, iv);
  return JSON.parse(new TextDecoder().decode(decrypted));
};

const fetchOutput = async (
  outputUrl: string,
  token: string,
  isSecure: boolean,
): Promise<{ answer?: unknown[] } | null> => {
  if (!outputUrl) return null;

  if (!isSecure) {
    const res = await fetchWithTimeout(outputUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim() ? JSON.parse(text) : null;
  }

  return (await fetchDecryptedJson(`${outputUrl}.enc`, token)) as { answer?: unknown[] };
};

// Keeps only the latest (highest id) result per prompt code.
const filterLatestByPromptCode = (results: PipelineResult[]): PipelineResult[] => {
  const byCode = new Map<string, PipelineResult>();
  for (const item of results) {
    const existing = byCode.get(item.prompt.code);
    if (!existing || item.id > existing.id) byCode.set(item.prompt.code, item);
  }
  return [...byCode.values()];
};

export const getEbookContent = async (
  pipelineId: number,
  token: string,
  isSecure: boolean,
): Promise<EbookContent> => {
  const pipeline = await getPipeline(pipelineId, token);
  if (pipeline.error) {
    return { characters: [], places: [], glossary: [], footnotes: [] };
  }

  const filtered = filterLatestByPromptCode(pipeline.results);
  const fetchFootnotes = async (): Promise<FootnoteEntity[]> => {
    if (!pipeline.footNoteUrl) return [];
    const footnoteData = isSecure
      ? await fetchDecryptedJson(`${pipeline.footNoteUrl}.enc`, token)
      : await fetchWithTimeout(pipeline.footNoteUrl).then((r) => r.json());
    const result = (footnoteData as { result?: unknown } | null)?.result;
    return Array.isArray(result) ? (result as FootnoteEntity[]) : [];
  };

  // Footnotes join the same batch as the other pipeline items instead of a
  // separate `await` after them, so a book with footnotes doesn't pay an
  // extra serial signed-url/access-key/fetch/decrypt round trip.
  const [resolved, footnotes] = await Promise.all([
    Promise.all(
      filtered.map(async (item) => {
        const data = await fetchOutput(item.outputUrl, token, isSecure);
        if (!data) return null;
        return { contentType: item.prompt.contentType, answer: data.answer ?? [] };
      }),
    ),
    fetchFootnotes(),
  ]);
  const valid = resolved.filter((x): x is { contentType: string; answer: unknown[] } => x !== null);

  // `prompt.contentType` values ('person'/'place'/'glossary'), confirmed against the
  // live API — not `prompt.title` (e.g. "person_reference_paragraph").
  const characters = (valid.find((x) => x.contentType === 'person')?.answer ??
    []) as CharacterEntity[];
  const places = (valid.find((x) => x.contentType === 'place')?.answer ?? []) as PlaceEntity[];
  const glossary = (valid.find((x) => x.contentType === 'glossary')?.answer ??
    []) as GlossaryEntity[];

  return { characters, places, glossary, footnotes, pipelineVersion: pipeline.pipelineVersion };
};
