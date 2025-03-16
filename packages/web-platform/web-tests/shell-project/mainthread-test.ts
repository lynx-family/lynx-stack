// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MainThreadRuntime } from '@lynx-js/web-mainthread-apis';
import { ElementThreadElement } from '@lynx-js/web-mainthread-apis/dist/elementAPI/ElementThreadElement.js';
import { decodeElementOperation } from '@lynx-js/web-core/dist/uiThread/decodeElementOperation';
import type { RuntimePropertyOnElement } from '@lynx-js/web-core/dist/types/RuntimePropertyOnElement';
import { lynxRuntimeValue } from '@lynx-js/web-core';

type CompareableElementJson = {
  tag: string;
  children: CompareableElementJson[];
  parentUid?: number;
};

const uniqueIdToElement: WeakRef<HTMLElement & RuntimePropertyOnElement>[] = [];

let rootDom: HTMLElement;

function serializeElementThreadElement(
  element: ElementThreadElement,
): CompareableElementJson {
  return {
    tag: element.tag,
    children: element.children.map(e => serializeElementThreadElement(e)),
    parentUid: element.parent?.uniqueId,
  };
}

function serializeDomElement(element: Element): CompareableElementJson {
  const attributes: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.value) {
      attributes[attr.name] = attr.value;
    }
  }
  const parentUid = element?.parentElement?.getAttribute('lynx-unique-id');
  return {
    tag: element.getAttribute('lynx-tag')!,
    children: [...element.children].map(e => serializeDomElement(e)),
    parentUid: parentUid ? parseFloat(parentUid) : undefined,
  };
}

function genFiberElementTree() {
  const page = ElementThreadElement.uniqueIdToElement[0]?.deref();
  if (page?.tag === 'page') {
    return serializeElementThreadElement(page);
  } else {
    return {};
  }
}

function genDomElementTree() {
  if (rootDom) {
    return serializeDomElement(rootDom);
  } else {
    return {};
  }
}

function getElementThreadElements() {
  return ElementThreadElement.uniqueIdToElement;
}

function initializeMainThreadTest() {
  const runtime = new MainThreadRuntime({
    lepusCode: { root: '' },
    customSections: {},
    entryId: 't',
    browserConfig: {},
    pageConfig: {
      enableCSSSelector: true,
      enableRemoveCSSScope: true,
      defaultDisplayLinear: true,
    },
    styleInfo: {},
    globalProps: {},
    callbacks: {
      mainChunkReady: function(): void {
      },
      flushElementTree: (operations) => {
        console.log(operations);
        const page = decodeElementOperation(
          operations,
          {
            uniqueIdToElement,
            uniqueIdToCssInJsRule: [],
            createElementImpl: (tag: string) => {
              const htmlTag = tag.includes('-') ? tag : `x-${tag}`;
              const element = document.createElement(htmlTag) as
                & HTMLDivElement
                & RuntimePropertyOnElement;
              element[lynxRuntimeValue] = {
                dataset: {},
                eventHandler: {},
              };
              return element;
            },
            createStyleRuleImpl: function(
              uniqueId: number,
              initialStyle: string,
            ): CSSStyleRule {
              throw new Error('Function not implemented.');
            },
            eventHandler: {
              mtsHandler: () => {},
              btsHandler: () => {},
            },
            timingFlags: [],
          },
        );
        if (page) {
          document.body.append(page as HTMLElement);
          rootDom = page;
        }
      },
      _ReportError: function(error: Error, info?: unknown): void {
        document.body.innerHTML = '';
      },
      __OnLifecycleEvent() {
      },
      markTiming: function(pipelineId: string, timingKey: string): void {
        throw new Error('Function not implemented.');
      },
    },
  });
  Object.assign(globalThis, runtime);
  Object.assign(globalThis, {
    genFiberElementTree,
    genDomElementTree,
    getElementThreadElements,
  });
}

initializeMainThreadTest();
