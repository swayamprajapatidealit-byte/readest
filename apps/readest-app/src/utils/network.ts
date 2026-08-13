/**
 * Network Information API surface we care about. It's non-standard and absent
 * on iOS Safari / Tauri webviews, so everything is optional and `isMetered`
 * falls through to `false` (treat as unmetered) when it can't tell.
 */
type NavWithConnection = Navigator & {
  connection?: { type?: string; saveData?: boolean };
};

/**
 * Best-effort metered-connection detection. Returns `true` only when the
 * Network Information API positively reports a cellular connection or the
 * user's data-saver preference; returns `false` when the API is unavailable or
 * inconclusive. Used to gate silent Word Lens pack auto-downloads.
 */
export const isMetered = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as NavWithConnection).connection;
  if (!connection) return false;
  return connection.type === 'cellular' || connection.saveData === true;
};
