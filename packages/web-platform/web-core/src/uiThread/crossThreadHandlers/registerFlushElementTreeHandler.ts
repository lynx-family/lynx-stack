// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  componentIdAttribute,
  lynxDefaultDisplayLinearAttribute,
  lynxRuntimeValue,
  lynxTagAttribute,
  lynxUniqueIdAttribute,
  parentComponentUniqueIdAttribute,
  postMainThreadEvent,
  publicComponentEventEndpoint,
  publishEventEndpoint,
  type PageConfig,
  type flushElementTreeEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import type { RuntimePropertyOnElement } from '../../types/RuntimePropertyOnElement.js';
import { decodeElementOperation } from '../decodeElementOperation.js';
import { createCrossThreadEvent } from '../../utils/createCrossThreadEvent.js';

function applyPageAttributes(
  page: HTMLElement,
  pageConfig: PageConfig,
) {
  if (pageConfig.defaultDisplayLinear === false) {
    page.setAttribute(lynxDefaultDisplayLinearAttribute, 'false');
  }
}

export function registerFlushElementTreeHandler(
  mainThreadRpc: Rpc,
  endpoint: typeof flushElementTreeEndpoint,
  options: {
    pageConfig: PageConfig;
    backgroundRpc: Rpc;
    rootDom: HTMLElement;
  },
  onCommit: (info: {
    pipelineId: string | undefined;
    timingFlags: string[];
    isFP: boolean;
  }) => void,
  markTimingInternal: (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => void,
) {
  const {
    pageConfig,
    backgroundRpc,
    rootDom,
  } = options;
  const uniqueIdToElement: WeakRef<
    HTMLElement & RuntimePropertyOnElement
  >[] = [];
  const uniqueIdToCssInJsRule: WeakRef<
    CSSStyleRule
  >[] = [];
  const rootStyleElementForCssInJs = document.createElement('style');
  if (!pageConfig.enableCSSSelector) {
    rootDom.append(rootStyleElementForCssInJs);
  }
  const createElementImpl = (tag: string) => {
    const element = document.createElement(tag) as
      & HTMLElement
      & RuntimePropertyOnElement;
    element[lynxRuntimeValue] = {
      dataset: {},
      eventHandler: {},
    };
    return element;
  };
  const createStyleRuleImpl = (uniqueId: number, initialStyle: string) => {
    const commonStyleSheetText =
      `[${lynxUniqueIdAttribute}="${uniqueId.toString()}"]{${initialStyle}}`;
    const idx = rootStyleElementForCssInJs.sheet!.insertRule(
      commonStyleSheetText,
    );
    return rootStyleElementForCssInJs.sheet!.cssRules[idx] as CSSStyleRule;
  };
  const mtsHandler = (event: Event) => {
    const crossThreadEvent = createCrossThreadEvent(event);
    mainThreadRpc.invoke(postMainThreadEvent, [crossThreadEvent]);
  };
  const btsHandler = (event: Event) => {
    const crossThreadEvent = createCrossThreadEvent(event);
    const currentTarget = event.currentTarget as
      & Element
      & RuntimePropertyOnElement;
    const parentComponentUniqueId =
      currentTarget.getAttribute(parentComponentUniqueIdAttribute) ?? '0';
    const componentTargetDom = rootDom.querySelector(
      `[${lynxUniqueIdAttribute}="${parentComponentUniqueId}"]`,
    );
    const componentId =
      componentTargetDom?.getAttribute(lynxTagAttribute) !== 'page'
        ? componentTargetDom?.getAttribute(componentIdAttribute) ?? undefined
        : undefined;
    const hname = currentTarget[lynxRuntimeValue]
      .eventHandler[crossThreadEvent.type]!.hname;
    if (componentId) {
      backgroundRpc.invoke(publicComponentEventEndpoint, [
        componentId,
        hname,
        crossThreadEvent,
      ]);
    } else {
      backgroundRpc.invoke(publishEventEndpoint, [
        hname,
        crossThreadEvent,
      ]);
    }
  };
  mainThreadRpc.registerHandler(
    endpoint,
    (operations, options, cardCss, timingFlags) => {
      const { pipelineOptions } = options;
      const pipelineId = pipelineOptions?.pipelineID;
      markTimingInternal('dispatch_start', pipelineId);
      markTimingInternal('layout_start', pipelineId);
      markTimingInternal('ui_operation_flush_start', pipelineId);
      const page = decodeElementOperation(operations, {
        uniqueIdToElement,
        uniqueIdToCssInJsRule,
        createElementImpl,
        createStyleRuleImpl,
        eventHandler: {
          mtsHandler,
          btsHandler,
        },
      });
      markTimingInternal('ui_operation_flush_end', pipelineId);
      const isFP = !!page;
      if (isFP) {
        // on FP
        const styleElement = document.createElement('style');
        styleElement.innerHTML = cardCss!;
        rootDom.append(styleElement);
        rootDom.append(page);
        applyPageAttributes(page, pageConfig);
      }
      markTimingInternal('layout_end', pipelineId);
      markTimingInternal('dispatch_end', pipelineId);
      onCommit({
        pipelineId,
        timingFlags,
        isFP,
      });
    },
  );
  return { uniqueIdToElement, uniqueIdToCssInJsRule };
}
