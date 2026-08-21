export interface BookEditionHistoryItem {
  version: string;
}

export interface BookDetail {
  id: string;
  slug: string;
  fileUrl: string;
  isSecure: boolean;
  isPurchased: boolean;
  latestPipelineId: number;
  // Versions the book's exclude-word list — fetching it (services/visualible/
  // excludeWords.ts) is skipped entirely when this is 0, per the API contract.
  excludeVersion: number;
  // Newest edition first. The major version component (before the first '.')
  // is the edition number shown to readers (e.g. "2.1" -> 2nd Edition).
  editionHistory?: BookEditionHistoryItem[];
}

export interface VisualibleSession {
  slug: string;
  token: string;
  pipelineId?: string;
}

export interface RecentPurchaseImage {
  name: string;
}

export interface RecentPurchaseReadingData {
  pageNumber: number;
  updatedAt: string;
}

export interface RecentPurchaseItemData {
  id: string;
  slug: string;
  title: string;
  author: string;
  image: RecentPurchaseImage[];
  isGreatBook?: boolean;
  releaseVersionInfo?: { pipelineVersion: string };
  readingData?: RecentPurchaseReadingData;
}

export interface RecentPurchaseItem {
  itemData: RecentPurchaseItemData;
}

export interface RecentPurchaseResponse {
  results: RecentPurchaseItem[];
  count: number;
}
