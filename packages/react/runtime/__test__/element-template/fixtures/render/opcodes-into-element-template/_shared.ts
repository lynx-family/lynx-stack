import { vi } from 'vitest';

import { renderOpcodesIntoElementTemplate } from '../../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../../src/element-template/runtime/template/registry.js';
import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
} from '../../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { installMockNativePapi } from '../../../test-utils/mock/mockNativePapi.js';
import { registerBuiltinRawTextTemplate, registerTemplates } from '../../../test-utils/debug/registry.js';

export interface RootNode {
  type: 'root';
  children?: unknown[];
}

export interface CaseContext {
  root: RootNode;
  nativeLog: unknown[];
}

const templates = [
  {
    templateId: '__et_builtin_raw_text__',
    compiledTemplate: {
      kind: 'element',
      type: 'raw-text',
      attributesArray: [
        {
          kind: 'attribute',
          key: 'text',
          binding: 'slot',
          attrSlotIndex: 0,
        },
      ],
      children: [],
    },
  },
  {
    templateId: '_et_foo',
    compiledTemplate: {
      kind: 'element',
      type: 'view',
      attributesArray: [
        {
          kind: 'attribute',
          key: 'id',
          binding: 'slot',
          attrSlotIndex: 0,
        },
      ],
      children: [
        { kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 },
        { kind: 'elementSlot', type: 'slot', elementSlotIndex: 1 },
      ],
    },
  },
  {
    templateId: '_et_parent',
    compiledTemplate: {
      kind: 'element',
      type: 'view',
      attributesArray: [],
      children: [{ kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 }],
    },
  },
  {
    templateId: '_et_child',
    compiledTemplate: { kind: 'element', type: 'view', attributesArray: [], children: [] },
  },
  {
    templateId: '_et_outer',
    compiledTemplate: {
      kind: 'element',
      type: 'view',
      attributesArray: [],
      children: [{ kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 }],
    },
  },
  {
    templateId: '_et_inner',
    compiledTemplate: {
      kind: 'element',
      type: 'view',
      attributesArray: [
        {
          kind: 'attribute',
          key: 'title',
          binding: 'slot',
          attrSlotIndex: 0,
        },
      ],
      children: [{ kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 }],
    },
  },
  {
    templateId: '_et_child_a',
    compiledTemplate: { kind: 'element', type: 'view', attributesArray: [], children: [] },
  },
  {
    templateId: '_et_child_b',
    compiledTemplate: { kind: 'element', type: 'view', attributesArray: [], children: [] },
  },
];

function setup(): CaseContext {
  vi.resetAllMocks();
  ElementTemplateRegistry.clear();
  resetTemplateId();

  const installed = installMockNativePapi({ clearTemplatesOnCleanup: false });
  registerBuiltinRawTextTemplate();
  registerTemplates(templates);

  return {
    root: { type: 'root' },
    nativeLog: installed.nativeLog,
  };
}

export function runCase<T>(runner: (context: CaseContext) => T): T {
  const context = setup();
  try {
    return runner(context);
  } finally {
    // cleanup is automatic
  }
}

export { ElementTemplateRegistry, renderOpcodesIntoElementTemplate, __OpAttr, __OpBegin, __OpEnd, __OpSlot, __OpText };
