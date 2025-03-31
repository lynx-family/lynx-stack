/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  boostedQueueMicrotask,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XText } from './XText.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';
type NodeInfo = {
  node: Text | Element;
  start: number;
  length: number;
  nodeIndex: number;
};
type RectInfo = { rect: DOMRect; rectIndex: number } & NodeInfo;
type RawLineInfo = RectInfo[];
type LynxLineInfo = { start: number; end: number };
export class XTextTruncation
  implements InstanceType<AttributeReactiveClass<typeof XText>>
{
  static exceedMathLengthAttribute = 'x-text-clipped' as const;
  static showInlineTruncation = 'x-show-inline-truncation' as const;
  static observedAttributes = [
    'text-maxlength',
    'text-maxline',
    'tail-color-convert',
  ];
  __scheduledTextLayout = false;
  __componentConnected: boolean = false;
  __originalTextMap = new Map<Node, string>();
  __mutationObserver?: MutationObserver;
  __resizeObserver?: ResizeObserver;
  __inplaceEllipsisNode?: Node;
  __textMeasure?: TextRenderingMeasureTool;
  __firstResizeObserverCallback = false;
  // attribute status
  __maxLength = NaN;
  __maxLine = NaN;
  __tailColorConvert = true;
  __enableLayoutEvent = false;
  get __ellipsisInPlace() {
    return !this.__hasInlineTruncation && !this.__tailColorConvert;
  }
  get __hasInlineTruncation() {
    if (CSS.supports('selector(:has(inline-truncation))')) {
      return this.__dom.matches(':has(inline-truncation)');
    } else {
      const candidateElement = this.__dom.querySelector('inline-truncation');
      if (candidateElement?.parentElement === this.__dom) {
        return true;
      }
    }
    return false;
  }
  get __doExpensiveLineLayoutCalculation() {
    return (
      !isNaN(this.__maxLine)
      && (this.__hasInlineTruncation || !this.__tailColorConvert)
    );
  }
  __dom: XText;
  constructor(dom: XText) {
    this.__dom = dom;
  }
  __getInnerBox = genDomGetter(() => this.__dom.shadowRoot!, '__inner-box');
  __updateOriginalText(mutationRecords: MutationRecord[]) {
    mutationRecords.forEach((oneRecord) => {
      oneRecord.removedNodes.forEach((node) => {
        this.__originalTextMap.delete(node);
      });
      if (
        oneRecord.type === 'characterData'
        && this.__originalTextMap.get(oneRecord.target) !== undefined
      ) {
        this.__originalTextMap.set(
          oneRecord.target,
          (oneRecord.target as Text).data,
        );
      }
    });
  }

  __revertTruncatedTextNodes() {
    for (const [node, originalText] of this.__originalTextMap) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (originalText !== undefined) {
          (node as Text).data = originalText;
        }
      } else {
        (node as Element).removeAttribute(
          XTextTruncation.exceedMathLengthAttribute,
        );
      }
    }
    this.__dom.removeAttribute(XTextTruncation.exceedMathLengthAttribute);
    this.__dom.removeAttribute(XTextTruncation.showInlineTruncation);
  }

  __getAllSibilings(targetNode: Node) {
    const sibilingNodes: (Text | Element)[] = [];
    let targetNodeSibiling: Node | null = targetNode;
    while ((targetNodeSibiling = targetNodeSibiling.nextSibling)) {
      if (
        targetNodeSibiling.nodeType === Node.TEXT_NODE
        || targetNodeSibiling.nodeType === Node.ELEMENT_NODE
      ) {
        sibilingNodes.push(targetNodeSibiling as Text | Element);
      }
    }
    return sibilingNodes;
  }
  __layoutText() {
    if (!this.__componentConnected || this.__dom.matches('x-text>x-text')) {
      return;
    }
    if (this.__scheduledTextLayout) return;
    this.__scheduledTextLayout = true;
    boostedQueueMicrotask(() => {
      this.__layoutTextInner();
      this.__startObservers();
      queueMicrotask(() => {
        this.__scheduledTextLayout = false;
      });
    });
  }
  __layoutTextInner() {
    this.__inplaceEllipsisNode?.parentElement?.removeChild(
      this.__inplaceEllipsisNode,
    );

    this.__revertTruncatedTextNodes();
    if (!this.__doExpensiveLineLayoutCalculation && isNaN(this.__maxLength)) {
      return;
    }
    const parentBondingRect = this.__getInnerBox().getBoundingClientRect();
    this.__textMeasure = new TextRenderingMeasureTool(
      this.__dom,
      parentBondingRect,
    );
    const measure = this.__textMeasure!;
    const maxLengthMeasureResult = !isNaN(this.__maxLength)
      ? measure.getNodeInfoByCharIndex(this.__maxLength)
      : undefined;
    const maxLengthEndAt = maxLengthMeasureResult ? this.__maxLength : Infinity;
    const maxLineMeasureResult = this.__doExpensiveLineLayoutCalculation
      ? measure.getLineInfo(this.__maxLine)
        ? measure.getLineInfo(this.__maxLine - 1)
        : undefined
      : undefined;
    let maxLineEndAt = Infinity;
    let ellipsisLength = 3;
    if (maxLineMeasureResult) {
      const { start, end } = maxLineMeasureResult;
      const currentLineText = end - start;
      if (this.__hasInlineTruncation) {
        this.__dom.setAttribute(XTextTruncation.showInlineTruncation, '');
        const inlineTruncation = this.__dom.querySelector('inline-truncation')!;
        const inlineTruncationBoundingRect = inlineTruncation
          .getBoundingClientRect();
        const parentWidth = parentBondingRect!.width;
        const inlineTruncationWidth = inlineTruncationBoundingRect.width;
        if (parentWidth > inlineTruncationWidth) {
          maxLineEndAt = end - 1;
          const range = document.createRange();
          let currentNodeInfo: NodeInfo | undefined = measure
            .getNodeInfoByCharIndex(maxLineEndAt)!;
          const endCharInNodeIndex = end - currentNodeInfo.start;
          range.setEnd(currentNodeInfo.node, endCharInNodeIndex);
          range.setStart(currentNodeInfo.node, endCharInNodeIndex);
          while (
            range.getBoundingClientRect().width < inlineTruncationWidth
            && (maxLineEndAt -= 1)
            && (currentNodeInfo = measure.getNodeInfoByCharIndex(maxLineEndAt))
          ) {
            range.setStart(
              currentNodeInfo.node,
              maxLineEndAt - currentNodeInfo.start,
            );
          }
        } else {
          maxLineEndAt = start;
          this.__dom.removeAttribute(XTextTruncation.showInlineTruncation);
        }
      } else {
        if (currentLineText < 3) {
          ellipsisLength = currentLineText;
          maxLineEndAt = start;
        } else {
          maxLineEndAt = end - 3;
        }
      }
    }
    const truncateAt = Math.min(maxLengthEndAt, maxLineEndAt);
    if (truncateAt < Infinity) {
      const targetNodeInfo = measure.getNodeInfoByCharIndex(truncateAt);
      if (targetNodeInfo) {
        const truncatePositionInNode = truncateAt - targetNodeInfo.start;
        const targetNode = targetNodeInfo.node;
        let toBeHideNodes: (Text | Element)[] = [];
        if (targetNode.nodeType === Node.TEXT_NODE) {
          const textNode = targetNode as Text;
          this.__originalTextMap.set(targetNode, textNode.data);
          textNode.data = textNode.data.substring(0, truncatePositionInNode);
        } else {
          toBeHideNodes.push(targetNode);
        }
        toBeHideNodes = toBeHideNodes.concat(
          this.__getAllSibilings(targetNode),
        );
        let targetNodeParentElement = targetNode.parentElement!;
        while (targetNodeParentElement !== this.__dom) {
          toBeHideNodes = toBeHideNodes.concat(
            this.__getAllSibilings(targetNodeParentElement),
          );
          targetNodeParentElement = targetNodeParentElement.parentElement!;
        }

        toBeHideNodes.forEach((node) => {
          if (
            node.nodeType === Node.TEXT_NODE
            && (node as Text).data.length !== 0
          ) {
            this.__originalTextMap.set(node, (node as Text).data);
            (node as Text).data = '';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            this.__originalTextMap.set(node, '');
            (node as Element).setAttribute(
              XTextTruncation.exceedMathLengthAttribute,
              '',
            );
          }
        });

        if (this.__ellipsisInPlace) {
          const closestParent = (truncatePositionInNode === 0
            ? measure.nodelist.at(targetNodeInfo.nodeIndex - 1)
              ?.parentElement!
            : targetNode.parentElement!) ?? targetNode.parentElement!;
          this.__inplaceEllipsisNode = new Text(
            new Array(ellipsisLength).fill('.').join(''),
          );
          closestParent.append(this.__inplaceEllipsisNode);
        }
        this.__dom.setAttribute(XTextTruncation.exceedMathLengthAttribute, '');
      }
      this.__sendLayoutEvent(truncateAt);
    }
  }

  __handleMutationObserver: MutationCallback = (records: MutationRecord[]) => {
    this.__updateOriginalText(records);
    this.__layoutText();
  };

  __handleRezieObserver: ResizeObserverCallback = () => {
    if (this.__firstResizeObserverCallback) {
      this.__firstResizeObserverCallback = false;
      return;
    }
    this.__layoutText();
  };

  __startObservers() {
    if (!this.__componentConnected) {
      return;
    }
    if (this.__maxLength || this.__maxLine) {
      if (!this.__mutationObserver) {
        this.__mutationObserver = new MutationObserver(
          this.__handleMutationObserver,
        );
        this.__mutationObserver!.observe(this.__dom, {
          subtree: true,
          childList: true,
          attributes: false,
          characterData: true,
        });
      }
    }
    if (this.__maxLine) {
      if (!this.__resizeObserver) {
        this.__resizeObserver = new ResizeObserver(this.__handleRezieObserver);
        this.__firstResizeObserverCallback = true;
        this.__resizeObserver!.observe(this.__getInnerBox(), {
          box: 'content-box',
        });
      }
    }
  }

  __stopObservers() {
    this.__mutationObserver?.disconnect();
    this.__mutationObserver = undefined;
    this.__resizeObserver?.disconnect();
    this.__resizeObserver = undefined;
  }

  @registerAttributeHandler('text-maxlength', true)
  @registerAttributeHandler('text-maxline', true)
  @registerAttributeHandler('tail-color-convert', true)
  __handleAttributeChange() {
    this.__maxLength = parseFloat(
      this.__dom.getAttribute('text-maxlength') ?? '',
    );
    this.__maxLine = parseFloat(this.__dom.getAttribute('text-maxline') ?? '');
    this.__tailColorConvert =
      this.__dom.getAttribute('tail-color-convert') !== 'false';
    if (this.__maxLength < 0) this.__maxLength = NaN;
    if (this.__maxLine < 1) this.__maxLine = NaN;
    if (!isNaN(this.__maxLine)) {
      this.__getInnerBox().style.webkitLineClamp = this.__maxLine.toString();
    } else {
      this.__getInnerBox().style.removeProperty('-webkit-line-clamp');
    }
    this.__layoutText();
  }

  @registerEventEnableStatusChangeHandler('layout')
  __handleEnableLayoutEvent(status: boolean) {
    this.__enableLayoutEvent = status;
  }

  __sendLayoutEvent(truncateAt?: number) {
    if (!this.__enableLayoutEvent) return;
    const detail = new Proxy(this, {
      get(that, property): any {
        if (property === 'lineCount') {
          if (!that.__textMeasure) {
            that.__textMeasure = new TextRenderingMeasureTool(
              that.__dom,
              that.__dom.getBoundingClientRect(),
            );
          }
          return that.__textMeasure.getLineCount();
        } else if (property === 'lines') {
          // event.detail.lines
          return new Proxy(that, {
            get(that, lineIndex): any {
              // event.detail.lines[num]
              const lineIndexNum = parseFloat(lineIndex.toString());
              if (!isNaN(lineIndexNum)) {
                if (!that.__textMeasure) {
                  that.__textMeasure = new TextRenderingMeasureTool(
                    that.__dom,
                    that.__dom.getBoundingClientRect(),
                  );
                }
                const lineInfo = that.__textMeasure.getLineInfo(lineIndexNum);
                if (lineInfo) {
                  return new Proxy(lineInfo, {
                    get(lineInfo, property): any {
                      // event.detail.lines[num].(<start>, <end>, <ellipsisCount>)
                      switch (property) {
                        case 'start':
                        case 'end':
                          return lineInfo[property];
                        case 'ellipsisCount':
                          if (
                            truncateAt !== undefined
                            && truncateAt >= lineInfo.start
                            && truncateAt < lineInfo.end
                          ) {
                            return lineInfo.end - truncateAt;
                          }
                          return 0;
                      }
                    },
                  });
                }
              }
            },
          });
        }
      },
    });
    this.__dom.dispatchEvent(
      new CustomEvent('layout', { ...commonComponentEventSetting, detail }),
    );
  }

  dispose(): void {
    this.__stopObservers();
  }

  connectedCallback(): void {
    this.__componentConnected = true;
    this.__handleEnableLayoutEvent(
      this.__enableLayoutEvent,
    );
    document.fonts.ready.then(() => {
      this.__handleAttributeChange();
    });
    boostedQueueMicrotask(() => {
      this.__sendLayoutEvent();
    });
  }
}

class TextRenderingMeasureTool {
  __cachedLineInfo: (Partial<LynxLineInfo> | undefined)[] = [{ start: 0 }];
  __lazyLinesInfo: (RawLineInfo | undefined)[] = [];
  __lazyNodesInfo: (NodeInfo | undefined)[] = [];
  __dom: HTMLElement;
  __domRect: DOMRect;
  public nodelist: LazyNodesList;
  constructor(containerDom: HTMLElement, parentRect: DOMRect) {
    this.__dom = containerDom;
    this.nodelist = new LazyNodesList(this.__dom);
    this.__domRect = parentRect;
  }
  __findWrapIndexInTargetTextNode(lastRectInfo: RectInfo) {
    if (lastRectInfo.node.nodeType === Node.TEXT_NODE) {
      const { rect, rectIndex } = lastRectInfo;
      const textNode = lastRectInfo.node as Text;
      const mesaurementRange = document.createRange();
      mesaurementRange.selectNode(textNode);
      for (let charIndex = 0; charIndex < textNode.data.length; charIndex++) {
        mesaurementRange.setEnd(textNode, charIndex);
        const targetRect = mesaurementRange.getClientRects().item(rectIndex);
        if (targetRect && targetRect.right === rect.right) {
          return charIndex;
        }
      }
      return textNode.data.length;
    } else {
      return 1;
    }
  }
  __genLinesInfoUntil(lineIndex: number) {
    if (this.__lazyLinesInfo[lineIndex]) return;
    const { left: containerLeft } = this.__domRect;
    const lastLineInfo = this.__lazyLinesInfo[this.__lazyLinesInfo.length - 1];
    const lastNodeInfo = lastLineInfo?.[lastLineInfo.length - 1];
    const nextNodeIndex = lastNodeInfo?.nodeIndex
      ? lastNodeInfo?.nodeIndex + 1
      : 0;
    for (
      let nodeIndex: number = nextNodeIndex,
        currentNodeInfo: NodeInfo | undefined;
      (currentNodeInfo = this.__getNodeInfoByIndex(nodeIndex))
      && lineIndex >= this.__lazyLinesInfo.length;
      nodeIndex++
    ) {
      const { node } = currentNodeInfo;
      let rects: DOMRectList;
      if (node.nodeType === Node.ELEMENT_NODE) {
        rects = (node as Element).getClientRects();
      } else {
        const range = document.createRange();
        range.selectNode(node);
        rects = range.getClientRects();
      }
      if (rects.length > 0) {
        const currentLine = this
          .__lazyLinesInfo[this.__lazyLinesInfo.length - 1]!;
        const firstRect = rects[0]!;
        if (Math.abs(firstRect!.left - containerLeft) < 0.2 || !currentLine) {
          this.__lazyLinesInfo.push([
            { ...currentNodeInfo, rect: firstRect, rectIndex: 0 },
          ]);
        } else {
          currentLine.push({
            ...currentNodeInfo,
            rect: firstRect,
            rectIndex: 0,
          });
        }
        if (rects.length > 1) {
          for (let ii = 1; ii < rects.length; ii++) {
            const rect = rects[ii]!;
            if (
              rect.left !== firstRect.left
              || rect.bottom !== firstRect.bottom
            ) {
              if (Math.abs(rect!.left - containerLeft) < 0.2) {
                // is a new line
                this.__lazyLinesInfo.push([
                  { ...currentNodeInfo, rect, rectIndex: ii },
                ]);
              } else {
                const currentLine = this
                  .__lazyLinesInfo[this.__lazyLinesInfo.length - 1]!;
                currentLine.push({
                  ...currentNodeInfo,
                  rect,
                  rectIndex: ii,
                });
              }
            }
          }
        }
      }
    }
  }
  /**
   * **NOTE: this is expensive.**
   * @returns
   */
  getLineCount() {
    this.__genLinesInfoUntil(Infinity);
    return this.__lazyLinesInfo.length;
  }
  getLineInfo(lineIndex: number): LynxLineInfo | void {
    this.__genLinesInfoUntil(lineIndex + 1);
    if (lineIndex < this.__lazyLinesInfo.length) {
      // get catched info first
      const pervLineInfo = lineIndex > 0
        ? this.__cachedLineInfo[lineIndex - 1] ?? {}
        : undefined;
      const currentLineInfo = this.__cachedLineInfo[lineIndex] ?? {};
      const nextLineInfo = lineIndex < this.__lazyLinesInfo.length - 1
        ? this.__cachedLineInfo[lineIndex + 1] ?? {}
        : undefined;
      if (currentLineInfo.start === undefined) {
        // can't be firstline since the first line's start is already initialized at the constructor.
        const pervLineRects = this.__lazyLinesInfo[lineIndex - 1]!;
        const pervLineLastRectInfo = pervLineRects[pervLineRects.length - 1]!;
        const wrapPosition = this.__findWrapIndexInTargetTextNode(
          pervLineLastRectInfo,
        );
        const end = pervLineLastRectInfo.start + wrapPosition;
        if (pervLineInfo) pervLineInfo.end = end;
        currentLineInfo.start = end + 1;
      }
      if (currentLineInfo.end === undefined) {
        const currentLineRects = this.__lazyLinesInfo[lineIndex]!;
        const currentLineLastRectInfo =
          currentLineRects[currentLineRects.length - 1]!;
        if (lineIndex === this.__lazyLinesInfo.length - 1) {
          // the last line
          const currentNodeLength =
            currentLineLastRectInfo.node.nodeType === Node.TEXT_NODE
              ? (currentLineLastRectInfo.node as Text).data.length
              : 1;
          currentLineInfo.end = currentLineLastRectInfo.start
            + currentNodeLength;
        } else {
          const wrapPosition = this.__findWrapIndexInTargetTextNode(
            currentLineLastRectInfo,
          );
          currentLineInfo.end = currentLineLastRectInfo.start + wrapPosition;
          nextLineInfo!.start = currentLineInfo.end + 1;
        }
      }
      return currentLineInfo as LynxLineInfo;
    }
  }
  __getNodeInfoByIndex(nodeIndex: number) {
    const lastIndex = this.__lazyNodesInfo.length - 1;
    const lastNode = this.__lazyNodesInfo[lastIndex];
    let currentLength = lastNode ? lastNode.start + lastNode.length : 0;
    for (
      let currentIndex = this.__lazyNodesInfo.length,
        nextNode: Text | Element | undefined;
      (nextNode = this.nodelist.at(currentIndex))
      && nodeIndex >= this.__lazyNodesInfo.length;
      currentIndex++
    ) {
      const nodeLength = nextNode.nodeType === Node.ELEMENT_NODE
        ? 1
        : (nextNode as Text).data.length;
      const currentNodeInfo = {
        node: nextNode,
        length: nodeLength,
        start: currentLength,
        nodeIndex: currentIndex,
      };
      this.__lazyNodesInfo.push(currentNodeInfo);
    }
    return this.__lazyNodesInfo[nodeIndex];
  }
  getNodeInfoByCharIndex(searchTarget: number) {
    // binary search
    let left = 0;
    let right = this.__lazyNodesInfo.length - 1;
    let result;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midNodeInfo = this.__lazyNodesInfo[mid]!;
      const midNode = midNodeInfo.node;
      const mindNodeLength = midNode.nodeType === Node.TEXT_NODE
        ? (midNode as Text).data.length
        : 1;
      const midNodeStart = midNodeInfo.start;

      // check searchTarget is placed inside midRange
      if (
        searchTarget >= midNodeStart
        && searchTarget < midNodeStart + mindNodeLength
      ) {
        result = midNodeInfo;
        break;
      } else if (searchTarget < midNodeStart) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    if (result) {
      return result;
    } else {
      for (
        let currentIndex = this.__lazyNodesInfo.length,
          nextNode: NodeInfo | undefined;
        (nextNode = this.__getNodeInfoByIndex(currentIndex));
        currentIndex++
      ) {
        if (searchTarget < nextNode.start + nextNode.length) {
          return nextNode;
        }
      }
    }

    return undefined;
  }
}
class LazyNodesList {
  __nodeCache: (Text | Element)[] = [];
  __treeWalker: TreeWalker;
  constructor(dom: HTMLElement) {
    this.__treeWalker = document.createTreeWalker(
      dom,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = (node as Element).tagName;
          if (
            tagName === 'X-TEXT'
            || tagName === 'INLINE-TEXT'
            || tagName === 'RAW-TEXT'
            || tagName === 'LYNX-WRAPPER'
          ) {
            return NodeFilter.FILTER_SKIP;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    );
  }
  at(index: number) {
    if (this.__nodeCache[index]) {
      return this.__nodeCache[index];
    }
    this.__fillCacheTo(index);
    return this.__nodeCache[index];
  }
  __fillCacheTo(index: number) {
    let currentNode: Node | null = null;
    while (
      index >= this.__nodeCache.length
      && (currentNode = this.__treeWalker.nextNode())
    ) {
      this.__nodeCache.push(currentNode as Text | Element);
      break;
    }
  }
}
// function addClientRectsOverlay(rect: DOMRect, color: string = 'red', size: string = '1px') {
//   /* Absolutely position a div over each client rect so that its border width
//      is the same as the rectangle's width.
//      Note: the overlays will be out of place if the user resizes or zooms. */
//   const tableRectDiv = document.createElement("div");
//   tableRectDiv.style.position = "absolute";
//   tableRectDiv.style.border = `${size} solid ${color}`;
//   const scrollTop =
//     document.documentElement.scrollTop || document.body.scrollTop;
//   const scrollLeft =
//     document.documentElement.scrollLeft || document.body.scrollLeft;
//   tableRectDiv.style.margin = tableRectDiv.style.padding = "0";
//   tableRectDiv.style.top = `${rect.top + scrollTop}px`;
//   tableRectDiv.style.left = `${rect.left + scrollLeft}px`;
//   // We want rect.width to be the border width, so content width is 2px less.
//   tableRectDiv.style.width = `${rect.width - 2}px`;
//   tableRectDiv.style.height = `${rect.height - 2}px`;
//   document.body.appendChild(tableRectDiv);
// }
