// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  ElementTemplateSerializableValue,
  NativeElementTemplateApi,
} from '@lynx-js/element-template-runtime';

interface SolidLynxNativeElementRef {
  readonly __solidLynxNativeElementRef: true;
}

interface SolidLynxPageHandle {
  readonly kind: 'page';
  readonly ref: SolidLynxNativeElementRef;
}

interface SolidLynxTemplateHandle {
  readonly kind: 'template';
  readonly ref: SolidLynxNativeElementRef;
}

export type SolidLynxElementTemplateHandle =
  | SolidLynxPageHandle
  | SolidLynxTemplateHandle;

declare function __CreateElementTemplate(
  templateKey: string,
  bundleUrl: string | null,
  attributeSlots: ElementTemplateSerializableValue[] | null,
  childSlots: Array<SolidLynxNativeElementRef[] | null | undefined> | null,
  handleId: number,
): SolidLynxNativeElementRef;

declare function __CreatePage(
  componentId: string,
  cssId: number,
): SolidLynxNativeElementRef;

declare function __AppendElement(
  parent: SolidLynxNativeElementRef,
  child: SolidLynxNativeElementRef,
): SolidLynxNativeElementRef;

declare function __FlushElementTree(
  element?: undefined,
  options?: Record<string, unknown>,
): void;

declare function __InsertElementBefore(
  parent: SolidLynxNativeElementRef,
  child: SolidLynxNativeElementRef,
  reference?: SolidLynxNativeElementRef,
): SolidLynxNativeElementRef;

declare function __InsertNodeToElementTemplate(
  parent: SolidLynxNativeElementRef,
  childSlotIndex: number,
  child: SolidLynxNativeElementRef,
  reference?: SolidLynxNativeElementRef | null,
): void;

declare function __RemoveElement(
  parent: SolidLynxNativeElementRef,
  child: SolidLynxNativeElementRef,
): SolidLynxNativeElementRef;

declare function __RemoveNodeFromElementTemplate(
  parent: SolidLynxNativeElementRef,
  childSlotIndex: number,
  child: SolidLynxNativeElementRef,
): void;

declare function __SetAttributeOfElementTemplate(
  element: SolidLynxNativeElementRef,
  attributeSlotIndex: number,
  value: ElementTemplateSerializableValue,
): void;

function getTemplateRef(
  handle: SolidLynxElementTemplateHandle,
): SolidLynxNativeElementRef {
  if (handle.kind !== 'template') {
    throw new Error('A page handle cannot be used as an Element Template.');
  }
  return handle.ref;
}

export function createNativeElementTemplateApi(): NativeElementTemplateApi<
  SolidLynxElementTemplateHandle
> {
  return {
    createTemplate(request) {
      return {
        kind: 'template',
        ref: __CreateElementTemplate(
          request.templateKey,
          request.bundleUrl,
          request.attributeSlots,
          request.childSlots?.map(slot =>
            slot?.map(handle => getTemplateRef(handle))
          ) ?? null,
          request.handleId,
        ),
      };
    },
    flush() {
      __FlushElementTree();
    },
    insertNode(request) {
      const child = getTemplateRef(request.child);
      if (request.parent.kind === 'page') {
        if (request.before === null) {
          __AppendElement(request.parent.ref, child);
        } else {
          __InsertElementBefore(
            request.parent.ref,
            child,
            getTemplateRef(request.before),
          );
        }
        return;
      }
      __InsertNodeToElementTemplate(
        request.parent.ref,
        request.childSlotIndex,
        child,
        request.before === null ? null : getTemplateRef(request.before),
      );
    },
    removeNode(request) {
      const child = getTemplateRef(request.child);
      if (request.parent.kind === 'page') {
        __RemoveElement(request.parent.ref, child);
        return;
      }
      __RemoveNodeFromElementTemplate(
        request.parent.ref,
        request.childSlotIndex,
        child,
      );
    },
    setAttribute(target, attributeSlotIndex, value) {
      const element = getTemplateRef(target);
      __SetAttributeOfElementTemplate(
        element,
        attributeSlotIndex,
        value,
      );
    },
  };
}

export function createPageElementTemplate(): SolidLynxElementTemplateHandle {
  return {
    kind: 'page',
    ref: __CreatePage('0', 0),
  };
}
