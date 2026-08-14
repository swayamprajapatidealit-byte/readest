export interface BookDetail {
  id: string;
  slug: string;
  fileUrl: string;
  isSecure: boolean;
  isPurchased: boolean;
}

export interface VisualibleSession {
  slug: string;
  token: string;
  pipelineId?: string;
}
