import { SIZE_PER_LOC, SIZE_PER_TIME_UNIT } from '@/services/constants';

export const convertPagesToTimeRemainingMinutes = (
  pagesLeft: number,
  medianPageDurationSecs?: number,
): number => {
  // Prefer the reader's own pace; fall back to the coarse global estimate.
  const minutesPerPage = medianPageDurationSecs
    ? medianPageDurationSecs / 60
    : SIZE_PER_LOC / SIZE_PER_TIME_UNIT;
  return Math.max(1, Math.round(pagesLeft * minutesPerPage));
};
