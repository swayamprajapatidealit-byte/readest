import { writeTextToClipboard } from '@/utils/clipboard';

export interface SharePosition {
  x: number;
  y: number;
  preferredEdge?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Whether the selected text can be shared by ANY method on this platform —
 * the Web Share API. Used to gate the Share tool's visibility in the
 * selection toolbar and its customizer. Kept next to `shareSelectedText` so
 * the two stay in sync.
 */
export const canShareText = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Open the OS share sheet for `text`, with graceful fallbacks.
 *
 * Ladder:
 *  1. `navigator.share` (web / PWA). A rejection means the user dismissed the
 *     sheet — respect it, don't silently copy.
 *  2. Clipboard, as a last resort when no share method exists.
 */
export const shareSelectedText = async (text: string, _position?: SharePosition): Promise<void> => {
  if (!text) return;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      // Only respect a user cancel (AbortError). Other failures — e.g.
      // NotAllowedError when a quick action fires without a user gesture —
      // fall through to the clipboard so the user still gets the text.
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }

  await writeTextToClipboard(text);
};
