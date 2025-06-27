// This is extracted to avoid signals to be bundled with react-lynx

import { Commit, MsgTypes } from './events-types';
import { flushTable } from './string-table';
import { stats2ops } from '../shared/stats';

/**
 * Collect all relevant data from a commit and convert it to a message
 * the detools can understand
 */
export function flush(commit: Commit) {
  const { rootId, unmountIds, operations, strings, stats } = commit;
  if (unmountIds.length === 0 && operations.length === 0) return;

  const msg = [rootId, ...flushTable(strings)];
  if (unmountIds.length > 0) {
    msg.push(MsgTypes.REMOVE_VNODE, unmountIds.length, ...unmountIds);
  }

  for (let i = 0; i < operations.length; i++) {
    msg.push(operations[i]);
  }
  if (stats !== null) {
    stats2ops(stats, msg);
  }

  return { type: 'operation_v2', data: msg };
}
