import type {
  CssInJsInfo,
  ElementOperation,
  PageConfig,
} from '@lynx-js/web-constants';
import { ListElement, ElementThreadElement } from './ElementThreadElement.js';

interface OffscreenDocument {
  createElement(tagName: string): ElementThreadElement;
}

export function createOffscreenDocument(options: {
  pageConfig: PageConfig;
  styleInfo: CssInJsInfo;
  operationsRef: {
    operations: ElementOperation[];
  };
}): OffscreenDocument {
  const { pageConfig, styleInfo, operationsRef } = options;
  let incrementalUniqueId = 0;
  function createElement(tagName: string): ElementThreadElement {
    const uniqueId = incrementalUniqueId++;
    if (tagName === 'x-list') {
      return new ListElement(
        tagName,
        uniqueId,
        pageConfig,
        operationsRef,
        styleInfo,
      );
    } else {
      return new ElementThreadElement(
        tagName,
        uniqueId,
        pageConfig,
        operationsRef,
        styleInfo,
      );
    }
  }
  return {
    createElement,
  };
}
