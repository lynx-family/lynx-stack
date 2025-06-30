import { MsgTypes } from './protocol/events-types';
import { parseTable, flushTable } from './protocol/string-table';
import { ID, DevNodeType } from '../view/store/types';
import { renderReasonToStr } from './shared/renderReasons';
import { parseStats } from './shared/stats';

export interface ParsedMsg {
  rootId: number;
  mounts: Array<{ id: ID; key: string; name: string; parentId: ID }>;
  unmounts: ID[];
  reorders: Array<{ id: ID; children: ID[] }>;
  timings: Array<{ id: ID; duration: number }>;
}

export function parseCommitMessage(data: number[]): ParsedMsg {
  const rootId = data[0] || -1;

  // String table
  let i = 1;
  const len = data[i++];
  const strings = parseTable(data.slice(1, len + 2));
  const mounts: any[] = [];
  const unmounts: any[] = [];
  const timings: any[] = [];
  const reorders: any[] = [];

  i = len > 0 ? len + 2 : i;

  for (; i < data.length; i++) {
    switch (data[i]) {
      case MsgTypes.ADD_VNODE: {
        const id = data[i + 1];
        const name = strings[data[i + 5] - 1];
        const parentId = data[i + 3];
        const key = data[i + 6] > 0 ? strings[i + 6 - 1] : '';
        mounts.push({ id, name, key, parentId });
        i += 6;
        break;
      }
      case MsgTypes.UPDATE_VNODE_TIMINGS:
        timings.push({ id: data[i + 1], duration: data[i + 2] });
        i += 2;
        break;
      case MsgTypes.REMOVE_VNODE: {
        const unmountLen = data[i + 1];
        i += 2;
        const len = i + unmountLen;
        for (; i < len; i++) {
          unmounts.push(data[i]);
        }
        break;
      }
      case MsgTypes.REORDER_CHILDREN: {
        reorders.push({
          id: data[i + 1],
          children: data.slice(i + 3, i + 3 + data[i + 2]),
        });
        i += 3 + data[i + 2];
        break;
      }
    }
  }

  return {
    rootId,
    mounts,
    unmounts,
    timings,
    reorders,
  };
}

export function formatForTest(msg: ParsedMsg) {
  const out = [];
  out.push('rootId: ' + msg.rootId);
  msg.mounts.forEach((m) => {
    const key = m.key ? '#' + m.key : '';
    out.push(`Add ${m.id} <${m.name}${key}> to parent ${m.parentId}`);
  });
  msg.timings.forEach((t) => {
    out.push(`Update timings ${t.id}`);
  });
  msg.reorders.forEach((r) => {
    out.push(`Reorder ${r.id} [${r.children.join(', ')}]`);
  });
  msg.unmounts.forEach((u) => {
    out.push(`Remove ${u}`);
  });

  return out;
}

export function toSnapshot(data: number[]) {
  const parsed = parseCommitMessage(data);
  return formatForTest(parsed);
}

export function toStringTable(...strs: string[]) {
  const init = strs.map((x, i) => [x, i]);
  return flushTable(new Map(init as any));
}
/**
 * Create operations array from human readable actions. Available
 * events:
 *
 * ```
 * rootId: 12
 * Add 3 <span> to parent 1
 * Remove 5
 * Update timings 12 duration 23
 * Reorder 1 [2, 3, 4, 5]
 * ```
 */
export function fromSnapshot(events: string[]): number[] {
  const out: number[] = [];
  const operations: number[] = [];
  const strings: string[] = [];
  const unmounts: number[] = [];

  if (/^rootId:/.test(events[0])) {
    const id = +events[0].slice(events[0].indexOf(':') + 1);
    out.push(id);
    operations.push(MsgTypes.ADD_ROOT, id);
  } else {
    throw new Error('rootId must be first event');
  }

  for (let i = 1; i < events.length; i++) {
    const ev = events[i];
    if (/^Add/.test(ev)) {
      const m = ev.match(/Add\s+(\d+)\s+<([#]?\w+)>\s+to\sparent\s([-]?\d+)/);
      if (m) {
        let idx = strings.indexOf(m[2]);
        if (idx == -1) {
          idx = strings.push(m[2]);
        }

        operations.push(
          MsgTypes.ADD_VNODE,
          +m[1],
          m[2][0] !== m[2][0].toLowerCase()
            ? DevNodeType.FunctionComponent
            : DevNodeType.Element,
          +m[3],
          9999,
          idx,
          0,
          42000,
          42000,
        );
      } else {
        throw new Error('no match: ' + ev);
      }
    } else if (/^Update\stimings/.test(ev)) {
      // V1 api
      if (/duration/.test(ev)) {
        const m = ev.match(/Update\stimings\s(\d+)\s+duration\s+(\d+)/);
        if (m) {
          const id = +m[1];
          const duration = +m[2];
          operations.push(MsgTypes.UPDATE_VNODE_TIMINGS, id, duration);
        } else {
          throw new Error('no match: ' + ev);
        }
      } else {
        const m = ev.match(/Update\stimings\s(\d+)\s+time\s+(\d+):(\d+)/);
        if (m) {
          const id = +m[1];
          const start = +m[2] * 1000;
          const end = +m[3] * 1000;
          operations.push(MsgTypes.UPDATE_VNODE_TIMINGS, id, start, end);
        } else {
          throw new Error('no match: ' + ev);
        }
      }
    } else if (/^Remove/.test(ev)) {
      const m = ev.match(/Remove\s+(\d+)/);
      if (m) {
        const id = +m[1];
        unmounts.push(id);
      } else {
        throw new Error('no match: ' + ev);
      }
    } else if (/^Reorder/.test(ev)) {
      const m = ev.match(/Reorder\s+(\d+)\s+([[].*[\]])/);
      if (m) {
        const id = +m[1];
        const children = JSON.parse(m[2]);
        operations.push(
          MsgTypes.REORDER_CHILDREN,
          id,
          children.length,
          ...children,
        );
      } else {
        throw new Error('no match: ' + ev);
      }
    }
  }

  const strs = flushTable(new Map(strings.map((x, i) => [x, i])));
  for (let i = 0; i < strs.length; i++) {
    out.push(strs[i]);
  }
  if (unmounts.length > 0) {
    out.push(MsgTypes.REMOVE_VNODE, unmounts.length, ...unmounts);
  }

  for (let i = 0; i < operations.length; i++) {
    out.push(operations[i]);
  }

  return out;
}

export function printCommit(data: number[]) {
  /* eslint-disable no-console */
  console.group('commit');
  console.groupCollapsed('raw');
  console.log(data);
  console.groupEnd();
  try {
    console.log('root id: ', data[0]);
    let i = 1;

    // String table
    const len = data[i++];
    console.log(len);
    const strings = parseTable(data.slice(i - 1));
    i += len;
    console.log('strings: ', strings);

    if (!Number.isInteger(data[i]) || data[i] < 0 || data[i] > 8) {
      throw new Error('Invalid offset ' + data[i]);
    }

    for (; i < data.length; i++) {
      switch (data[i]) {
        case MsgTypes.ADD_VNODE: {
          const id = data[i + 1];
          const name = strings[data[i + 5] - 1];
          const key = data[i + 6] > 0
            ? ` key="${strings[data[i + 6] - 1]}" `
            : '';
          const parentId = data[i + 3];
          const ownerId = data[i + 4];
          const startTime = data[i + 7];
          const endTime = data[i + 8];
          console.log(
            `Add %c${id} %c<${name}${key}>%c to parent %c${parentId}%c with owner %c${ownerId}%c, time: %c${startTime}%c - %c${endTime}`,
            'color: yellow',
            'color: violet',
            'color: inherit',
            'color: green',
            'color: inherit',
            'color: yellow',
            'color: inherit',
            'color: peachpuff',
            'color: inherit',
            'color: peachpuff',
          );
          i += 8;
          break;
        }
        case MsgTypes.REMOVE_VNODE: {
          const unmounts = data[i + 1];
          i += 2;
          console.log(`total unmounts: ${unmounts}`);
          for (let j = 0; j < unmounts; j++) {
            console.log(`  Remove: %c${data[i + j]}`, 'color: red');
          }
          i += unmounts - 1;
          break;
        }
        case MsgTypes.REORDER_CHILDREN: {
          const id = data[i + 1];
          const children = data.slice(i + 3, i + 3 + data[i + 2]);
          console.log(`Reorder: ${id}, [${children.join(', ')}]`);
          i += 2 + children.length;
          break;
        }
        case MsgTypes.UPDATE_VNODE_TIMINGS: {
          const id = data[i + 1];
          console.log(
            `Update: %c${id}%c, time: %c${data[i + 2]} %c- %c${data[i + 3]}`,
            'color: yellow',
            'color: inherit',
            'color: peachpuff',
            'color: inherit',
            'color: peachpuff',
          );
          i += 3;
          break;
        }
        case MsgTypes.RENDER_REASON: {
          const id = data[i + 1];
          const type = data[i + 2];
          const len = data[i + 3];
          const strs = [];

          for (let j = i + 4; j <= i + 3 + len; j++) {
            strs.push(strings[data[j] - 1]);
          }

          console.log(
            `Render Reason: %c${id}%c ${renderReasonToStr(type)} %c${
              strs.join(', ') || 'none'
            }`,
            'color: yellow',
            'color: aqua',
            'color: inherit',
          );
          i += 3 + len;
          break;
        }
        case MsgTypes.ADD_ROOT: {
          const id = data[i + 1];
          console.log(`Add Root: %c${id}`, 'color: yellow');
          i++;
          break;
        }
        case MsgTypes.HOC_NODES: {
          const id = data[i + 1];
          const count = data[i + 2];
          const hocs = [];
          for (let j = 0; j < count; j++) {
            hocs.push(strings[data[i + 3 + j] - 1]);
          }
          console.log(
            `  Add HOCs: %c${id} %c${hocs.join(', ')}`,
            'color: yellow',
            'font-size: 10px; color: #ccc; background-color: #444; padding: .1rem .3rem; border-radius: 2px;',
          );
          i += 2 + count;
          break;
        }
        case MsgTypes.COMMIT_STATS: {
          const stats = parseStats(i + 1, data);
          console.log('stats', stats.stats);
          i = stats.i;
          break;
        }
        default: {
          console.log('Not implemented', data[i]);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
  console.groupEnd();
  /* eslint-enable no-console */
}
