import { Book } from '@/types/book';
import { AppService } from '@/types/system';

/**
 * True when the URL is fetchable by external services (markdown readers),
 * i.e. not a local dev server or the Tauri asset protocol.
 */
export const isPublicImageUrl = (url?: string | null): url is string =>
  !!url && /^https?:\/\/(?!localhost|127\.|asset\.localhost)/.test(url);

/**
 * Resolve a publicly accessible cover image URL for the book, or undefined
 * when none can be provided. Only a public `coverImageUrl` already present in
 * the book metadata qualifies — there is no cloud bucket to publish a local
 * cover.png to.
 */
export const getPublicCoverUrl = async (
  book: Book,
  _appService: AppService | null,
): Promise<string | undefined> =>
  isPublicImageUrl(book.coverImageUrl) ? book.coverImageUrl : undefined;
