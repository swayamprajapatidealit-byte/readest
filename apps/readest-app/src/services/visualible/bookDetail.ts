import { fetchWithTimeout } from '@/utils/fetch';
import { getMarketplaceHost } from './hosts';
import { buildAuthHeaders } from './session';
import type { BookDetail } from './types';

export const getBookDetail = async (slug: string, token: string): Promise<BookDetail> => {
  const res = await fetchWithTimeout(`${getMarketplaceHost()}detail-ebook/${slug}`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to load book detail for "${slug}": ${res.status}`);
  }
  const { result } = (await res.json()) as { result: BookDetail };
  return result;
};
