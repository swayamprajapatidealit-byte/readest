// Width of the draggable gutter reserved between the two panes of a
// landscape 2-pane split — see SplitDivider.tsx.
export const SPLIT_DIVIDER_WIDTH_PX = 6;

// `mainPaneFraction`, when set, overrides the default even 2-pane split with
// a custom ratio for the FIRST pane — used by the split-view divider
// (SplitDivider.tsx) to give either pane a bigger share (defaults to 0.5,
// and Ctrl/Cmd+Click seeds SPLIT_MAIN_PANE_FRACTION, utils/config.ts).
// Only applies to the 2-book, landscape case; every other layout (portrait
// stack, 3+ panes) is untouched. `paneCols`/`paneRows` report the true pane
// topology (ignoring the divider's own gutter track) for getInsetEdges below.
export const getGridTemplate = (
  count: number,
  aspectRatio: number,
  mainPaneFraction?: number | null,
) => {
  if (count <= 1) {
    return { columns: '1fr', rows: '1fr', paneCols: 1, paneRows: 1 };
  } else if (count === 2) {
    if (aspectRatio < 1) {
      return { columns: '1fr', rows: '1fr 1fr', paneCols: 1, paneRows: 2 };
    }
    const frac = mainPaneFraction ?? 0.5;
    return {
      columns: `${frac}fr ${SPLIT_DIVIDER_WIDTH_PX}px ${1 - frac}fr`,
      rows: '1fr',
      paneCols: 2,
      paneRows: 1,
    };
  } else if (count === 3 || count === 4) {
    return { columns: '1fr 1fr', rows: '1fr 1fr', paneCols: 2, paneRows: 2 };
  } else {
    return { columns: '1fr 1fr 1fr', rows: '1fr 1fr 1fr', paneCols: 3, paneRows: 3 };
  }
};

export const getInsetEdges = (index: number, count: number, aspectRatio: number) => {
  const { paneCols, paneRows } = getGridTemplate(count, aspectRatio);

  const row = Math.floor(index / paneCols);
  const col = index % paneCols;

  return {
    top: row === 0,
    right: col === paneCols - 1,
    bottom: row === paneRows - 1,
    left: col === 0,
  };
};
