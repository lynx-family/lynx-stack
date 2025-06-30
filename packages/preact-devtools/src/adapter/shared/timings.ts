import { ID } from '../../view/store/types';

/**
 * Store timings in a Map instead of mutating the vnode for
 * performance.
 */
export interface VNodeTimings<T = ID> {
  start: Map<T, number>;
  end: Map<T, number>;
}

export function storeTime(timings: Map<ID, number>, id: ID, time: number) {
  timings.set(id, time);
}

export function getTime(timings: Map<ID, number>, id: ID): number {
  return timings.get(id) || 0;
}

export function removeTime(timings: VNodeTimings, id: ID) {
  timings.start.delete(id);
  timings.end.delete(id);
}

export function createVNodeTimings<T = ID>(): VNodeTimings<T> {
  return {
    start: new Map(),
    end: new Map(),
  };
}
