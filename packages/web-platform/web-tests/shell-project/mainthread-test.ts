// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as lynxTemplate from '../resources/web-core.main-thread.json' with {
  type: 'json',
};
import { createMainThreadGlobalThis } from '@lynx-js/web-mainthread-apis';
import { initOffscreenDocument } from '@lynx-js/offscreen-document/main';
import {
  _onEvent,
  OffscreenDocument,
} from '@lynx-js/offscreen-document/webworker';

import {
  lynxTagAttribute,
  lynxUniqueIdAttribute,
  type MainThreadGlobalThis,
} from '@lynx-js/web-constants';

const ENABLE_MULTI_THREAD = !!process.env.ENABLE_MULTI_THREAD;

type ComparableElementJson = {
  tag: string;
  children: ComparableElementJson[];
  parentUid?: number;
};
let runtime!: MainThreadGlobalThis;
let elementOperations: unknown[] = [];

const div: HTMLElement = document.createElement('div');
div.id = 'root';
const shadowRoot = div.attachShadow({ mode: 'open' });
document.body.appendChild(div);
const docu: Document = ENABLE_MULTI_THREAD
  ? new OffscreenDocument({
    onCommit(operations) {
      elementOperations = operations;
    },
  }) as unknown as Document
  : document;
const { decodeOperation } = ENABLE_MULTI_THREAD
  ? initOffscreenDocument({
    shadowRoot,
    onEvent: docu[_onEvent],
  })
  : {};

function serializeElementThreadElement(
  element: HTMLElement,
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
  const page = runtime.__GetPageElement()!;
  if (page && runtime.__GetTag(page) === 'page') {
    return serializeElementThreadElement(page as any);
  } else {
    return {};
  }
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
  runtime = createMainThreadGlobalThis({
    document: docu,
    mtsRealm: {
      globalWindow: globalThis,
      loadScript: async (url: string) => {
        throw new Error('loadScript is not supported in main thread');
      },
      loadScriptSync: () => {
        throw new Error('loadScriptSync is not supported in main thread');
      },
    },
    // @ts-expect-error
    lynxTemplate,
    tagMap: {
      'page': 'div',
      'view': 'x-view',
      'text': 'x-text',
      'image': 'x-image',
      'list': 'x-list',
      'svg': 'x-svg',
    },
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
      enableJSDataProcessor: false,
    },
    // @ts-expect-error
    rootDom: ENABLE_MULTI_THREAD ? docu : shadowRoot,
    styleInfo: {},
    globalProps: {},
    callbacks: {
      mainChunkReady: function(): void {
      },
      flushElementTree: () => {
        // @ts-expect-error
        docu.commit?.();
        decodeOperation?.(elementOperations as any);
      },
      _ReportError: function(): void {
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
      _I18nResourceTranslation: () => {},
    },
  });
  const originalGlobalThis = globalThis;
  // @ts-ignore
  globalThis = originalGlobalThis;
  Object.assign(globalThis, {
    genFiberElementTree,
    genDomElementTree,
  });
}

initializeMainThreadTest();
