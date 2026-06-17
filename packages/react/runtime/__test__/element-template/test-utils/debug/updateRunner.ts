// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { formatElementTemplateUpdateCommands } from '../../../../src/element-template/debug/alog.js';
import type { FormattedElementTemplateUpdateCommand } from '../../../../src/element-template/debug/alog.js';
import { root } from '../../../../src/element-template/index.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type {
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
  SerializedEtNode,
} from '../../../../src/element-template/protocol/types.js';
import {
  createElementTemplateUpdateEvent,
  parseElementTemplateUpdateEventPayload,
} from '../../../../src/element-template/protocol/update-event.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { __page } from '../../../../src/element-template/runtime/page/page.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from './envManager.js';
import { hydrateBackground } from './hydrate.js';
import { extractSerializedHydrateInstances } from './hydratePayload.js';
import { lastMock } from '../mock/mockNativePapi.js';
import { serializeBackgroundTree, serializeToJSX } from './serializer.js';

declare const renderPage: () => void;

type FormattedUpdateEntry =
  | {
    type: 'create';
    id: number;
    template: string;
    attributeSlots: unknown;
    elementSlots: unknown;
  }
  | {
    type: 'createTypedElement';
    id: number;
    elementType: string;
    attributes: unknown;
    elementSlots: unknown;
    options: unknown;
  }
  | {
    type: 'insertTypedListItem';
    id: number;
    item: unknown;
    before: unknown;
  }
  | {
    type: 'removeTypedListItem';
    id: number;
    item: unknown;
    removedSubtreeHandleIds: unknown;
  }
  | {
    type: 'updateTypedListItem';
    id: number;
    item: unknown;
  }
  | {
    type: 'setAttribute';
    id: number;
    attrSlotIndex: number;
    value: unknown;
  }
  | {
    type: 'insertNode';
    id: number;
    elementSlotIndex: number;
    child: unknown;
    reference: unknown;
  }
  | {
    type: 'removeNode';
    id: number;
    elementSlotIndex: number;
    child: unknown;
    removedSubtreeHandleIds: unknown;
  }
  | {
    type: 'unknown';
    opcode: unknown;
    index: number;
    remaining: unknown[];
  };

export interface UpdateRunOptions {
  render: () => JSX.Element;
  update: () => void;
}

export interface UpdateRunResult {
  beforePageJsx: string;
  afterPageJsx: string;
  backgroundJsx: string;
  ops: ElementTemplateUpdateCommandStream;
  formattedOps: FormattedUpdateEntry[];
  updateNativeLog: unknown[];
  formattedNativeLog: unknown[];
}

export function formatUpdateStream(stream: ElementTemplateUpdateCommandStream): FormattedUpdateEntry[] {
  return formatElementTemplateUpdateCommands(stream).map(formatUpdateEntry);
}

function formatUpdateEntry(entry: FormattedElementTemplateUpdateCommand): FormattedUpdateEntry {
  switch (entry.op) {
    case 'createTemplate':
      return {
        type: 'create',
        id: entry.handleId,
        template: entry.templateKey,
        attributeSlots: entry.attributeSlots,
        elementSlots: entry.elementSlots,
      };

    case 'createTypedElement':
      return {
        type: 'createTypedElement',
        id: entry.handleId,
        elementType: entry.type,
        attributes: entry.attributes,
        elementSlots: entry.elementSlots,
        options: entry.options,
      };

    case 'setAttribute':
      return {
        type: 'setAttribute',
        id: entry.targetId,
        attrSlotIndex: entry.attrSlotIndex,
        value: entry.value,
      };

    case 'insertTypedListItem':
      return {
        type: 'insertTypedListItem',
        id: entry.targetId,
        item: entry.item,
        before: entry.beforeId,
      };

    case 'removeTypedListItem':
      return {
        type: 'removeTypedListItem',
        id: entry.targetId,
        item: entry.itemId,
        removedSubtreeHandleIds: entry.removedSubtreeHandleIds,
      };

    case 'updateTypedListItem':
      return {
        type: 'updateTypedListItem',
        id: entry.targetId,
        item: entry.item,
      };

    case 'insertNode':
      return {
        type: 'insertNode',
        id: entry.targetId,
        elementSlotIndex: entry.elementSlotIndex,
        child: entry.childId,
        reference: entry.referenceId,
      };

    case 'removeNode':
      return {
        type: 'removeNode',
        id: entry.targetId,
        elementSlotIndex: entry.elementSlotIndex,
        child: entry.childId,
        removedSubtreeHandleIds: entry.removedSubtreeHandleIds,
      };

    case 'unknown':
      return {
        type: 'unknown',
        opcode: entry.opcode,
        index: entry.index,
        remaining: entry.remaining,
      };
  }
}

export function formatNativePatchLog(nativeLog: unknown[]): unknown[] {
  return nativeLog.map((entry) => {
    if (!Array.isArray(entry)) {
      return entry;
    }
    if (
      entry[0] === '__SetAttributeOfElementTemplate'
      || entry[0] === '__InsertNodeToElementTemplate'
      || entry[0] === '__RemoveNodeFromElementTemplate'
    ) {
      return entry;
    }
    return entry;
  });
}

export function runElementTemplateUpdate(options: UpdateRunOptions): UpdateRunResult {
  const envManager = new ElementTemplateEnvManager();
  const nativeLog = lastMock!.nativeLog;
  const hydrationData: SerializedEtNode[] = [];
  envManager.resetEnv('background');
  envManager.setUseElementTemplate(true);
  const onHydrate = (event: { data: unknown }) => {
    hydrationData.push(...extractSerializedHydrateInstances(event.data));
  };
  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

  const updateEvents: ElementTemplateUpdateCommitContext[] = [];
  envManager.switchToMainThread();
  installElementTemplatePatchListener();
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data));
  };
  lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);

  try {
    envManager.switchToBackground();
    root.render(options.render());
    envManager.switchToMainThread();
    root.render(options.render());
    renderPage();
    const beforePageJsx = serializeToJSX(__page);
    envManager.switchToBackground();

    const before = hydrationData[0];
    if (!before) {
      throw new Error('Missing hydration data.');
    }

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const nativeLogStart = nativeLog.length;
    options.update();

    const afterBackground = backgroundRoot.firstChild;
    if (!afterBackground) {
      throw new Error('Missing background root child.');
    }

    const ops = hydrateBackground(before, afterBackground);
    if (ops.length > 0) {
      lynx.getCoreContext().dispatchEvent(
        createElementTemplateUpdateEvent({
          ops,
          flushOptions: {},
        }),
      );
    }

    envManager.switchToMainThread();
    const updatePayload = updateEvents.at(-1);
    if (ops.length > 0 && !updatePayload) {
      throw new Error('Missing update event.');
    }
    const afterPageJsx = serializeToJSX(__page);
    const updateNativeLog = nativeLog.slice(nativeLogStart);

    return {
      beforePageJsx,
      afterPageJsx,
      backgroundJsx: serializeBackgroundTree(afterBackground),
      ops,
      formattedOps: formatUpdateStream(updatePayload?.ops ?? ops),
      updateNativeLog,
      formattedNativeLog: formatNativePatchLog(updateNativeLog),
    };
  } finally {
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    resetElementTemplatePatchListener();
    envManager.switchToBackground();
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);
    envManager.setUseElementTemplate(false);
  }
}
