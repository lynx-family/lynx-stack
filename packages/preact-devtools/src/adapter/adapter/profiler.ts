import { UpdateRects } from './highlightUpdates';

export interface RawTimelineFilterState {
  filterCommitsUnder: number | false;
}
export type ProfilerState = {
  isProfiling: boolean;
  highlightUpdates: boolean;
  pendingHighlightUpdates: Set<HTMLElement>;
  updateRects: UpdateRects;
  captureRenderReasons: boolean;
  recordStats: boolean;
} & RawTimelineFilterState;

export function newProfiler(): ProfilerState {
  return {
    highlightUpdates: false,
    updateRects: new Map(),
    pendingHighlightUpdates: new Set(),
    captureRenderReasons: false,
    isProfiling: false,
    recordStats: false,
    filterCommitsUnder: false,
  };
}
