// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BackgroundElementTemplateInstance } from '../background/instance.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateOp } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateCommandStream } from '../protocol/types.js';

export type FormattedElementTemplateUpdateCommand =
  | {
    op: 'createTemplate';
    handleId: number;
    templateKey: string;
    bundleUrl: string | null | undefined;
    attributeSlots: unknown;
    elementSlots: unknown;
  }
  | {
    op: 'setAttribute';
    targetId: number;
    attrSlotIndex: number;
    value: unknown;
  }
  | {
    op: 'insertNode';
    targetId: number;
    elementSlotIndex: number;
    childId: number;
    referenceId: number;
  }
  | {
    op: 'removeNode';
    targetId: number;
    elementSlotIndex: number;
    childId: number;
  }
  | {
    op: 'unknown';
    opcode: unknown;
    index: number;
    remaining: unknown[];
  };

export function formatElementTemplateUpdateCommands(
  stream: ElementTemplateUpdateCommandStream | undefined,
): FormattedElementTemplateUpdateCommand[] {
  if (!Array.isArray(stream)) {
    return [];
  }

  const result: FormattedElementTemplateUpdateCommand[] = [];
  for (let index = 0; index < stream.length;) {
    const opIndex = index;
    const op = stream[index++] as ElementTemplateUpdateOp;

    switch (op) {
      case ElementTemplateUpdateOps.createTemplate:
        result.push({
          op: 'createTemplate',
          handleId: stream[index++] as number,
          templateKey: stream[index++] as string,
          bundleUrl: stream[index++] as string | null | undefined,
          attributeSlots: stream[index++],
          elementSlots: stream[index++],
        });
        break;

      case ElementTemplateUpdateOps.setAttribute:
        result.push({
          op: 'setAttribute',
          targetId: stream[index++] as number,
          attrSlotIndex: stream[index++] as number,
          value: stream[index++],
        });
        break;

      case ElementTemplateUpdateOps.insertNode:
        result.push({
          op: 'insertNode',
          targetId: stream[index++] as number,
          elementSlotIndex: stream[index++] as number,
          childId: stream[index++] as number,
          referenceId: stream[index++] as number,
        });
        break;

      case ElementTemplateUpdateOps.removeNode:
        result.push({
          op: 'removeNode',
          targetId: stream[index++] as number,
          elementSlotIndex: stream[index++] as number,
          childId: stream[index++] as number,
        });
        break;

      default:
        result.push({
          op: 'unknown',
          opcode: op,
          index: opIndex,
          remaining: stream.slice(index),
        });
        index = stream.length;
        break;
    }
  }
  return result;
}

export function printElementTemplateTreeToString(
  root: BackgroundElementTemplateInstance | null | undefined,
): string {
  if (!root) {
    return '<empty>';
  }

  const lines: string[] = [];
  appendInstance(lines, root, 0);
  return lines.join('\n');
}

function appendInstance(
  lines: string[],
  instance: BackgroundElementTemplateInstance,
  depth: number,
): void {
  const indent = '  '.repeat(depth);
  const type = instance.type ?? '<unknown>';
  const instanceId = instance.instanceId ?? '<unknown>';
  lines.push(`${indent}${type}#${instanceId}`);

  if (Array.isArray(instance.attributeSlots) && instance.attributeSlots.length > 0) {
    lines.push(`${indent}  attributeSlots: ${JSON.stringify(instance.attributeSlots)}`);
  }

  const elementSlots = Array.isArray(instance.elementSlots) ? instance.elementSlots : [];
  for (let slotIndex = 0; slotIndex < elementSlots.length; slotIndex += 1) {
    const children = elementSlots[slotIndex];
    if (!children || children.length === 0) {
      continue;
    }
    lines.push(
      `${indent}  elementSlots[${slotIndex}]: [${children.map(child => child.instanceId).join(', ')}]`,
    );
  }

  let child = instance.firstChild;
  while (child) {
    appendInstance(lines, child, depth + 1);
    child = child.nextSibling;
  }
}
