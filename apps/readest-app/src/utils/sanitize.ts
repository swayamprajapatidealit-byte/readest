import DOMPurify from 'dompurify';

export const sanitizeString = (str?: string) => {
  if (!str) return str;
  return str.replace(/\u0000/g, '');
};

/**
 * Strip scripts and event handlers from an untrusted *document* before it is
 * handed to `DOMParser`. Unlike `sanitizeHtml`, this keeps the document
 * structure (`<head>`, `<title>`, sectioning elements) so title extraction and
 * Readability still work — it only removes anything executable.
 */
export function sanitizeForParsing(html: string): string {
  return DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true });
}
