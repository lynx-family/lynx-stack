// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { enqueueComponentFactory } from './list.js';
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
          const enqueueFunc = enqueueComponentFactory();
          for (const child of top.childNodes) {
            enqueueFunc(
              top.__element_root!,
              __GetElementUniqueID(top.__element_root!),
              __GetElementUniqueID(child.__element_root!),
            );
          }
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
        const text = opcodes[i + 1];
        const s = new SnapshotInstance(null as unknown as string);
        s.setAttribute(0, text);
        top.insertBefore(s);

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
        s.setAttribute(0, text);
        top.insertBefore(s);

        i += 2;
        break;
      }
    }
  }
}
