// This is extracted to avoid signals to be bundled with react-lynx

import type { StringTable } from './string-table';
import type { Stats } from '../shared/stats';

export enum MsgTypes {
  ADD_ROOT = 1,
  ADD_VNODE = 2, // Used by Preact 10.1.x
  REMOVE_VNODE = 3,
  UPDATE_VNODE_TIMINGS = 4, // Used by Preact 10.1.x
  REORDER_CHILDREN = 5,
  RENDER_REASON = 6,
  COMMIT_STATS = 7,
  HOC_NODES = 8,
}

// Event Examples:
//
// ADD_ROOT
//   id
//
// ADD_VNODE
//   id
//   type
//   parent
//   owner
//   name
//   key
//
// ADD_VNODE_V2
//   id
//   type
//   parent
//   owner
//   name
//   key
//   startTime
//   duration
//
// REMOVE_VNODE
//   id
//
// UPDATE_VNODE_TIMINGS
//   id
//   duration
//
// UPDATE_VNODE_TIMINGS_V2
//   id
//   startTime
//   duration
//
// REORDER_CHILDREN
//   id
//   childrenCount
//   childId
//   childId
//   ...
//
// RENDER_REASON
//   id
//   type
//   stringsCount
//   ...stringIds
//
// COMMIT_STATS -> Check `stats.ts`
//
// HOC_NODES
//  vnodeId
//  stringsCounts
//  ...stringIds
//
export interface Commit {
  rootId: number;
  strings: StringTable;
  unmountIds: number[];
  operations: number[];
  stats: Stats | null;
}
