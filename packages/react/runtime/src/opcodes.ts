// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { componentAtIndexFactory, enqueueComponentFactory, gRecycleMap, gSignMap } from './list.js';
import { CHILDREN } from './renderToOpcodes/constants.js';
import { SnapshotInstance } from './snapshot.js';

const enum Opcode {
  Begin = 0,
  End,
  Attr,
  Text,
}

interface SSRFiberElement {
  ssrID: string;
}
export type SSRSnapshotInstance = [string, number, SSRFiberElement[]];

export function ssrHydrateByOpcodes(
  opcodes: any[],
  into: SnapshotInstance,
  refMap?: Record<string, FiberElement>,
): void {
  let top: SnapshotInstance & { __pendingElements?: SSRFiberElement[] } = into;
  const stack: SnapshotInstance[] = [into];
  for (let i = 0; i < opcodes.length;) {
    const opcode = opcodes[i];
    switch (opcode) {
      case Opcode.Begin: {
        const p = top;
        const [type, __id, elements] = opcodes[i + 1] as SSRSnapshotInstance;
        top = new SnapshotInstance(type, __id);
        top.__pendingElements = elements;
        p.insertBefore(top);
        stack.push(top);

        i += 2;
        break;
      }
      case Opcode.End: {
        // @ts-ignore
        top[CHILDREN] = undefined;

        top.__elements = top.__pendingElements!.map(({ ssrID }) => refMap![ssrID]!);
        top.__element_root = top.__elements[0];
        delete top.__pendingElements;

        if (top.__snapshot_def.isListHolder) {
          const listElement = top.__element_root!;
          const listElementUniqueID = __GetElementUniqueID(listElement);
          const signMap = gSignMap[listElementUniqueID] = new Map();
          gRecycleMap[listElementUniqueID] = new Map();
          const enqueueFunc = enqueueComponentFactory();
          const componentAtIndex = componentAtIndexFactory(top.childNodes);
          for (const child of top.childNodes) {
            if (child.__element_root) {
              const childElementUniqueID = __GetElementUniqueID(child.__element_root);
              signMap.set(childElementUniqueID, child);
              enqueueFunc(
                listElement,
                listElementUniqueID,
                childElementUniqueID,
              );
            }
          }
          __UpdateListCallbacks(listElement, componentAtIndex, enqueueFunc);
        }

        stack.pop();
        const p = stack[stack.length - 1];
        top = p!;

        i += 1;
        break;
      }
      case Opcode.Attr: {
        const key = opcodes[i + 1];
        const value = opcodes[i + 2];
        top.setAttribute(key, value);

        i += 3;
        break;
      }
      case Opcode.Text: {
        const [[type, __id, elements], text] = opcodes[i + 1] as [SSRSnapshotInstance, string];
        const s = new SnapshotInstance(type, __id);
        s.setAttribute(0, text);
        top.insertBefore(s);
        s.__elements = elements.map(({ ssrID }) => refMap![ssrID]!);
        s.__element_root = s.__elements[0];
        i += 2;
        break;
      }
    }
  }
}

export function renderOpcodesInto(opcodes: any[], into: SnapshotInstance): void {
  let top: SnapshotInstance = into;
  const stack: SnapshotInstance[] = [into];
  for (let i = 0; i < opcodes.length;) {
    const opcode = opcodes[i];
    switch (opcode) {
      case Opcode.Begin: {
        const p = top;
        top = opcodes[i + 1];
        // @ts-ignore
        if (top.__parent) {
          // already inserted
          top = new SnapshotInstance(top.type);
          opcodes[i + 1] = top;
        }
        p.insertBefore(top);
        stack.push(top);

        i += 2;
        break;
      }
      case Opcode.End: {
        // @ts-ignore
        top[CHILDREN] = undefined;

        stack.pop();
        const p = stack[stack.length - 1];
        top = p!;

        i += 1;
        break;
      }
      case Opcode.Attr: {
        const key = opcodes[i + 1];
        const value = opcodes[i + 2];
        top.setAttribute(key, value);

        i += 3;
        break;
      }
      case Opcode.Text: {
        const text = opcodes[i + 1];
        const s = new SnapshotInstance(null as unknown as string);
        if (__ENABLE_SSR__) {
          // We need store the just created SnapshotInstance, or it will be lost when we leave the function
          opcodes[i + 1] = [s, text];
        }
        s.setAttribute(0, text);
        top.insertBefore(s);

        i += 2;
        break;
      }
    }
  }
}
