import { fetchWithTimeout } from '@/utils/fetch';
import { getFileHost, getMarketplaceHost } from './hosts';
import { buildAuthHeaders } from './session';
import type { RecentPurchaseItemData, RecentPurchaseResponse } from './types';

export interface RecentPurchaseParams {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderType?: string;
  isCompleted?: 0 | 1;
  inProgress?: 0 | 1;
  notStarted?: 0 | 1;
  search?: string;
}

export const getRecentPurchases = async (
  token: string,
  params: RecentPurchaseParams = {},
): Promise<RecentPurchaseResponse> => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const qs = query.toString();
  const res = await fetchWithTimeout(
    `${getMarketplaceHost()}recent-purchase${qs ? `?${qs}` : ''}`,
    {
      headers: buildAuthHeaders(token),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to load recent purchases: ${res.status}`);
  }
  return (await res.json()) as RecentPurchaseResponse;
};

export const getRecentPurchaseCoverUrl = (item: RecentPurchaseItemData): string | undefined =>
  item.image[0] ? `${getFileHost()}${item.image[0].name}` : undefined;
