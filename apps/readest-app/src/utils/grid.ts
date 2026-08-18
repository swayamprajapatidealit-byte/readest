// `mainPaneFraction`, when set, overrides the default even 2-pane split with
// a custom ratio for the FIRST pane — used by the Ctrl/Cmd+Click split-view
// feature to keep the main pane's reflowable column from shrinking (see
// getSplitMainPaneFraction, utils/config.ts). Only applies to the 2-book,
// landscape case; every other layout (portrait stack, 3+ panes) is untouched.
export const getGridTemplate = (
  count: number,
  aspectRatio: number,
  mainPaneFraction?: number | null,
) => {
  if (count <= 1) {
    return { columns: '1fr', rows: '1fr' };
  } else if (count === 2) {
    if (aspectRatio < 1) {
      return { columns: '1fr', rows: '1fr 1fr' };
    }
    if (mainPaneFraction) {
      return { columns: `${mainPaneFraction}fr ${1 - mainPaneFraction}fr`, rows: '1fr' };
    }
    return { columns: '1fr 1fr', rows: '1fr' };
  } else if (count === 3 || count === 4) {
    return { columns: '1fr 1fr', rows: '1fr 1fr' };
  } else {
    return { columns: '1fr 1fr 1fr', rows: '1fr 1fr 1fr' };
  }
};

export const getInsetEdges = (index: number, count: number, aspectRatio: number) => {
  const gridTemplate = getGridTemplate(count, aspectRatio);
  const cols = gridTemplate.columns.split(' ').length;
  const rows = gridTemplate.rows.split(' ').length;

  const row = Math.floor(index / cols);
  const col = index % cols;

  return {
    top: row === 0,
    right: col === cols - 1,
    bottom: row === rows - 1,
    left: col === 0,
  };
};
