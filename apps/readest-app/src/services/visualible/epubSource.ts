import { fetchWithTimeout } from '@/utils/fetch';
import { getAwsHost, getFileHost } from './hosts';
import { buildAuthHeaders } from './session';
import type { BookDetail } from './types';

const hexToBuffer = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
};

const fetchSignedUrl = async (objectKey: string, token: string): Promise<string> => {
  const res = await fetchWithTimeout(
    `${getAwsHost()}signed-url?key=${encodeURIComponent(objectKey)}&expires=3600`,
    { headers: buildAuthHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to get signed URL for "${objectKey}": ${res.status}`);
  const { signedUrl } = (await res.json()) as { signedUrl: string };
  return signedUrl;
};

const fetchAccessKey = async (
  objectKey: string,
  token: string,
): Promise<{ key: string; iv: string }> => {
  const res = await fetchWithTimeout(
    `${getAwsHost()}access-key?key=${encodeURIComponent(objectKey)}`,
    { headers: buildAuthHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to get access key for "${objectKey}": ${res.status}`);
  return (await res.json()) as { key: string; iv: string };
};

const decryptAesCbc = async (
  buffer: ArrayBuffer,
  keyHex: string,
  ivHex: string,
): Promise<ArrayBuffer> => {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(keyHex),
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );
  return crypto.subtle.decrypt({ name: 'AES-CBC', iv: hexToBuffer(ivHex) }, key, buffer);
};

/**
 * Resolves a book's EPUB content per the isSecure contract: a plain CDN URL for
 * unsecured books (lazily range-fetched by the reader, no auth needed), or a
 * decrypted File for secured books (signed-url + access-key + AES-CBC).
 */
export const resolveEpubSource = async (
  detail: BookDetail,
  token: string,
): Promise<string | File> => {
  if (!detail.isSecure) {
    return `${getFileHost()}${detail.fileUrl}`;
  }

  const objectKey = `${detail.fileUrl}.enc`;
  const signedUrl = await fetchSignedUrl(objectKey, token);
  const [encryptedRes, { key, iv }] = await Promise.all([
    fetchWithTimeout(signedUrl),
    fetchAccessKey(objectKey, token),
  ]);
  if (!encryptedRes.ok) {
    throw new Error(`Failed to fetch encrypted book "${objectKey}": ${encryptedRes.status}`);
  }
  const encryptedBuffer = await encryptedRes.arrayBuffer();
  const decrypted = await decryptAesCbc(encryptedBuffer, key, iv);
  const filename = detail.fileUrl.split('/').pop() || `${detail.slug}.epub`;
  return new File([decrypted], filename, { type: 'application/epub+zip' });
};
