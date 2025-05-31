// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  lynxUniqueIdToElement,
  MainThreadRuntime,
} from '@lynx-js/web-mainthread-apis';
import { initOffscreenDocument } from '@lynx-js/offscreen-document/main';
import {
  _onEvent,
  OffscreenDocument,
} from '@lynx-js/offscreen-document/webworker';
import type {
  ElementOperation,
  OffscreenElement,
} from '@lynx-js/offscreen-document';
import {
  lynxTagAttribute,
  lynxUniqueIdAttribute,
} from '@lynx-js/web-constants';

type ComparableElementJson = {
  tag: string;
  children: ComparableElementJson[];
  parentUid?: number;
};
let runtime: any;
let elementOperations: ElementOperation[] = [];

const div: HTMLElement = document.createElement('div');
div.id = 'root';
const shadowRoot = div.attachShadow({ mode: 'open' });
document.body.appendChild(div);
const docu = new OffscreenDocument({
  onCommit(operations) {
    elementOperations = operations;
  },
});
const { decodeOperation } = initOffscreenDocument({
  shadowRoot,
  onEvent: docu[_onEvent],
});

function serializeElementThreadElement(
  element: OffscreenElement,
): ComparableElementJson {
  const parent = runtime.__GetParent(element);
  const tag = runtime.__GetTag(element);
  const parentUid = parent && runtime.__GetTag(element) !== 'page'
    ? runtime.__GetElementUniqueID(parent)
    : undefined;
  const children = runtime.__GetChildren(element).map(e =>
    serializeElementThreadElement(e)
  );
  return {
    tag,
    children,
    parentUid,
  };
}

function serializeDomElement(element: Element): ComparableElementJson {
  const attributes: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.value) {
      attributes[attr.name] = attr.value;
    }
  }
  const parentUid = element?.parentElement?.getAttribute(lynxUniqueIdAttribute);
  return {
    tag: element.getAttribute(lynxTagAttribute)!,
    children: [...element.children].map(e => serializeDomElement(e)),
    parentUid: parentUid ? parseFloat(parentUid) : undefined,
  };
}

function genFiberElementTree() {
  const page = runtime[lynxUniqueIdToElement][1]
    .deref() as unknown as OffscreenElement;
  if (runtime.__GetTag(page) === 'page') {
    return serializeElementThreadElement(page);
  } else {
    return {};
  }
  return serializeElementThreadElement(page);
}

function genDomElementTree() {
  const rootDom = shadowRoot.querySelector('[lynx-tag=\'page\']');
  if (rootDom) {
    return serializeDomElement(rootDom);
  } else {
    return {};
  }
}

function initializeMainThreadTest() {
  runtime = new MainThreadRuntime({
    tagMap: {
      'page': 'div',
      'view': 'x-view',
      'text': 'x-text',
      'image': 'x-image',
      'list': 'x-list',
      'svg': 'x-svg',
    },
    lepusCode: { root: '' },
    customSections: {},
    browserConfig: {
      pixelRatio: 0,
      pixelWidth: 0,
      pixelHeight: 0,
    },
    pageConfig: {
      enableCSSSelector: true,
      enableRemoveCSSScope: true,
      defaultDisplayLinear: true,
      defaultOverflowVisible: false,
    },
    rootDom: docu,
    createElement: docu.createElement.bind(docu),
    styleInfo: {},
    globalProps: {},
    callbacks: {
      mainChunkReady: function(): void {
      },
      flushElementTree: () => {
        docu.commit();
        decodeOperation(elementOperations);
      },
      _ReportError: function(error: string, info?: unknown): void {
        document.body.innerHTML = '';
      },
      __OnLifecycleEvent() {
      },
      markTiming: function(pipelineId: string, timingKey: string): void {
      },
      publishEvent: (hname, ev) => {
        Object.assign(globalThis, { publishEvent: { hname, ev } });
      },
      publicComponentEvent: (componentId, hname, ev) => {
        Object.assign(globalThis, {
          publicComponentEvent: { componentId, hname, ev },
        });
      },
      postExposure: () => {},
    },
  }).globalThis;
  Object.assign(globalThis, runtime);
  Object.assign(globalThis, {
    genFiberElementTree,
    genDomElementTree,
  });
}

initializeMainThreadTest();
