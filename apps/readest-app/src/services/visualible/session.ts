import type { VisualibleSession } from './types';

export const getSessionFromSearchParams = (params: URLSearchParams): VisualibleSession | null => {
  const slug = params.get('slug');
  const token = params.get('token');
  if (!slug || !token) return null;
  const pipelineId = params.get('pipelineId');
  return { slug, token, ...(pipelineId ? { pipelineId } : {}) };
};

export const buildAuthHeaders = (token: string): HeadersInit =>
  token ? { Authorization: `Bearer ${token}` } : {};
