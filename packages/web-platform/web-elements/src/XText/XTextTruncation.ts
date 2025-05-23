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
  #scheduledTextLayout = false;
  #componentConnected: boolean = false;
  #originalTextMap = new Map<Node, string>();
  #mutationObserver?: MutationObserver;
  #resizeObserver?: ResizeObserver;
  #inplaceEllipsisNode?: Node;
  #textMeasure?: TextRenderingMeasureTool;
  #firstResizeObserverCallback = false;
  // attribute status
  #maxLength = NaN;
  #maxLine = NaN;
  #tailColorConvert = true;
  #enableLayoutEvent = false;
  get #ellipsisInPlace() {
    return !this.#hasInlineTruncation && !this.#tailColorConvert;
  }
  get #hasInlineTruncation() {
    if (CSS.supports('selector(:has(inline-truncation))')) {
      return this.#dom.matches(':has(inline-truncation)');
    } else {
      const candidateElement = this.#dom.querySelector('inline-truncation');
      if (candidateElement?.parentElement === this.#dom) {
        return true;
      }
    }
    return false;
  }
  get #doExpensiveLineLayoutCalculation() {
    return (
      !isNaN(this.#maxLine)
      && (this.#hasInlineTruncation || !this.#tailColorConvert)
    );
  }
  #dom: XText;
  constructor(dom: XText) {
    this.#dom = dom;
  }
  #getInnerBox = genDomGetter(() => this.#dom.shadowRoot!, '#inner-box');
  #updateOriginalText(mutationRecords: MutationRecord[]) {
    mutationRecords.forEach((oneRecord) => {
      oneRecord.removedNodes.forEach((node) => {
        this.#originalTextMap.delete(node);
      });
      if (
        oneRecord.type === 'characterData'
        && this.#originalTextMap.get(oneRecord.target) !== undefined
      ) {
        this.#originalTextMap.set(
          oneRecord.target,
          (oneRecord.target as Text).data,
        );
      }
    });
  }

  #revertTruncatedTextNodes() {
    for (const [node, originalText] of this.#originalTextMap) {
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
    this.#dom.removeAttribute(XTextTruncation.exceedMathLengthAttribute);
    this.#dom.removeAttribute(XTextTruncation.showInlineTruncation);
  }

  #getAllSiblings(targetNode: Node) {
    const siblingNodes: (Text | Element)[] = [];
    let targetNodeSibling: Node | null = targetNode;
    while ((targetNodeSibling = targetNodeSibling.nextSibling)) {
      if (
        targetNodeSibling.nodeType === Node.TEXT_NODE
        || targetNodeSibling.nodeType === Node.ELEMENT_NODE
      ) {
        siblingNodes.push(targetNodeSibling as Text | Element);
      }
    }
    return siblingNodes;
  }
  #layoutText() {
    if (!this.#componentConnected || this.#dom.matches('x-text>x-text')) return;
    if (this.#scheduledTextLayout) return;
    this.#scheduledTextLayout = true;
    boostedQueueMicrotask(async () => {
      await this.#layoutTextInner();
      this.#startObservers();
      this.#scheduledTextLayout = false;
    });
  }
  async #layoutTextInner() {
    this.#inplaceEllipsisNode?.parentElement?.removeChild(
      this.#inplaceEllipsisNode,
    );

    this.#revertTruncatedTextNodes();
    if (!this.#doExpensiveLineLayoutCalculation && isNaN(this.#maxLength)) {
      return;
    }
    await document.fonts.ready;
    const parentBondingRect = this.#getInnerBox().getBoundingClientRect();
    this.#textMeasure = new TextRenderingMeasureTool(
      this.#dom,
      parentBondingRect,
    );
    const measure = this.#textMeasure!;
    const maxLengthMeasureResult = !isNaN(this.#maxLength)
      ? measure.getNodeInfoByCharIndex(this.#maxLength)
      : undefined;
    const maxLengthEndAt = maxLengthMeasureResult ? this.#maxLength : Infinity;
    const maxLineMeasureResult = this.#doExpensiveLineLayoutCalculation
      ? measure.getLineInfo(this.#maxLine)
        ? measure.getLineInfo(this.#maxLine - 1)
        : undefined
      : undefined;
    let maxLineEndAt = Infinity;
    let ellipsisLength = 3;
    if (maxLineMeasureResult) {
      const { start, end } = maxLineMeasureResult;
      const currentLineText = end - start;
      if (this.#hasInlineTruncation) {
        this.#dom.setAttribute(XTextTruncation.showInlineTruncation, '');
        const inlineTruncation = this.#dom.querySelector('inline-truncation')!;
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
          this.#dom.removeAttribute(XTextTruncation.showInlineTruncation);
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
          this.#originalTextMap.set(targetNode, textNode.data);
          textNode.data = textNode.data.substring(0, truncatePositionInNode);
        } else {
          toBeHideNodes.push(targetNode);
        }
        toBeHideNodes = toBeHideNodes.concat(this.#getAllSiblings(targetNode));
        let targetNodeParentElement = targetNode.parentElement!;
        while (targetNodeParentElement !== this.#dom) {
          toBeHideNodes = toBeHideNodes.concat(
            this.#getAllSiblings(targetNodeParentElement),
          );
          targetNodeParentElement = targetNodeParentElement.parentElement!;
        }

        toBeHideNodes.forEach((node) => {
          if (
            node.nodeType === Node.TEXT_NODE
            && (node as Text).data.length !== 0
          ) {
            this.#originalTextMap.set(node, (node as Text).data);
            (node as Text).data = '';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            this.#originalTextMap.set(node, '');
            (node as Element).setAttribute(
              XTextTruncation.exceedMathLengthAttribute,
              '',
            );
          }
        });

        if (this.#ellipsisInPlace) {
          const closestParent = (truncatePositionInNode === 0
            ? measure.nodelist.at(targetNodeInfo.nodeIndex - 1)
              ?.parentElement!
            : targetNode.parentElement!) ?? targetNode.parentElement!;
          this.#inplaceEllipsisNode = new Text(
            new Array(ellipsisLength).fill('.').join(''),
          );
          closestParent.append(this.#inplaceEllipsisNode);
        }
        this.#dom.setAttribute(XTextTruncation.exceedMathLengthAttribute, '');
      }
      this.#sendLayoutEvent(truncateAt);
    }
  }

  #handleMutationObserver: MutationCallback = (records: MutationRecord[]) => {
    this.#updateOriginalText(records);
    this.#layoutText();
  };

  #handleRezieObserver: ResizeObserverCallback = () => {
    if (this.#firstResizeObserverCallback) {
      this.#firstResizeObserverCallback = false;
      return;
    }
    this.#layoutText();
  };

  #startObservers() {
    if (!this.#componentConnected) {
      return;
    }
    if (this.#maxLength || this.#maxLine) {
      if (!this.#mutationObserver) {
        this.#mutationObserver = new MutationObserver(
          this.#handleMutationObserver,
        );
        this.#mutationObserver!.observe(this.#dom, {
          subtree: true,
          childList: true,
          attributes: false,
          characterData: true,
        });
      }
    }
    if (this.#maxLine) {
      if (!this.#resizeObserver) {
        this.#resizeObserver = new ResizeObserver(this.#handleRezieObserver);
        this.#firstResizeObserverCallback = true;
        this.#resizeObserver!.observe(this.#getInnerBox(), {
          box: 'content-box',
        });
      }
    }
  }

  #stopObservers() {
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = undefined;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }

  @registerAttributeHandler('text-maxlength', true)
  @registerAttributeHandler('text-maxline', true)
  @registerAttributeHandler('tail-color-convert', true)
  #handleAttributeChange() {
    this.#maxLength = parseFloat(
      this.#dom.getAttribute('text-maxlength') ?? '',
    );
    this.#maxLine = parseFloat(this.#dom.getAttribute('text-maxline') ?? '');
    this.#tailColorConvert =
      this.#dom.getAttribute('tail-color-convert') !== 'false';
    if (this.#maxLength < 0) this.#maxLength = NaN;
    if (this.#maxLine < 1) this.#maxLine = NaN;
    if (!isNaN(this.#maxLine)) {
      this.#getInnerBox().style.webkitLineClamp = this.#maxLine.toString();
    } else {
      this.#getInnerBox().style.removeProperty('-webkit-line-clamp');
    }
    this.#layoutText();
  }

  @registerEventEnableStatusChangeHandler('layout')
  #handleEnableLayoutEvent(status: boolean) {
    this.#enableLayoutEvent = status;
  }

  #sendLayoutEvent(truncateAt?: number) {
    if (!this.#enableLayoutEvent) return;
    const detail = new Proxy(this, {
      get(that, property): any {
        if (property === 'lineCount') {
          if (!that.#textMeasure) {
            that.#textMeasure = new TextRenderingMeasureTool(
              that.#dom,
              that.#dom.getBoundingClientRect(),
            );
          }
          return that.#textMeasure.getLineCount();
        } else if (property === 'lines') {
          // event.detail.lines
          return new Proxy(that, {
            get(that, lineIndex): any {
              // event.detail.lines[num]
              const lineIndexNum = parseFloat(lineIndex.toString());
              if (!isNaN(lineIndexNum)) {
                if (!that.#textMeasure) {
                  that.#textMeasure = new TextRenderingMeasureTool(
                    that.#dom,
                    that.#dom.getBoundingClientRect(),
                  );
                }
                const lineInfo = that.#textMeasure.getLineInfo(lineIndexNum);
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
    this.#dom.dispatchEvent(
      new CustomEvent('layout', { ...commonComponentEventSetting, detail }),
    );
  }

  dispose(): void {
    this.#stopObservers();
  }

  connectedCallback(): void {
    this.#componentConnected = true;
    this.#handleEnableLayoutEvent(
      this.#enableLayoutEvent,
    );
    this.#handleAttributeChange();
    boostedQueueMicrotask(() => {
      this.#sendLayoutEvent();
    });
  }
}

class TextRenderingMeasureTool {
  #cachedLineInfo: (Partial<LynxLineInfo> | undefined)[] = [{ start: 0 }];
  #lazyLinesInfo: (RawLineInfo | undefined)[] = [];
  #lazyNodesInfo: (NodeInfo | undefined)[] = [];
  #dom: HTMLElement;
  #domRect: DOMRect;
  public nodelist: LazyNodesList;
  constructor(containerDom: HTMLElement, parentRect: DOMRect) {
    this.#dom = containerDom;
    this.nodelist = new LazyNodesList(this.#dom);
    this.#domRect = parentRect;
  }
  #findWrapIndexInTargetTextNode(lastRectInfo: RectInfo) {
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
  #genLinesInfoUntil(lineIndex: number) {
    if (this.#lazyLinesInfo[lineIndex]) return;
    const { left: containerLeft } = this.#domRect;
    const lastLineInfo = this.#lazyLinesInfo[this.#lazyLinesInfo.length - 1];
    const lastNodeInfo = lastLineInfo?.[lastLineInfo.length - 1];
    const nextNodeIndex = lastNodeInfo?.nodeIndex
      ? lastNodeInfo?.nodeIndex + 1
      : 0;
    for (
      let nodeIndex: number = nextNodeIndex,
        currentNodeInfo: NodeInfo | undefined;
      (currentNodeInfo = this.#getNodeInfoByIndex(nodeIndex))
      && lineIndex >= this.#lazyLinesInfo.length;
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
          .#lazyLinesInfo[this.#lazyLinesInfo.length - 1]!;
        const firstRect = rects[0]!;
        if (Math.abs(firstRect!.left - containerLeft) < 0.2 || !currentLine) {
          this.#lazyLinesInfo.push([
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
                this.#lazyLinesInfo.push([
                  { ...currentNodeInfo, rect, rectIndex: ii },
                ]);
              } else {
                const currentLine = this
                  .#lazyLinesInfo[this.#lazyLinesInfo.length - 1]!;
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
    this.#genLinesInfoUntil(Infinity);
    return this.#lazyLinesInfo.length;
  }
  getLineInfo(lineIndex: number): LynxLineInfo | void {
    this.#genLinesInfoUntil(lineIndex + 1);
    if (lineIndex < this.#lazyLinesInfo.length) {
      // get caught info first
      const pervLineInfo = lineIndex > 0
        ? this.#cachedLineInfo[lineIndex - 1] ?? {}
        : undefined;
      const currentLineInfo = this.#cachedLineInfo[lineIndex] ?? {};
      const nextLineInfo = lineIndex < this.#lazyLinesInfo.length - 1
        ? this.#cachedLineInfo[lineIndex + 1] ?? {}
        : undefined;
      if (currentLineInfo.start === undefined) {
        // can't be firstline since the first line's start is already initialized at the constructor.
        const pervLineRects = this.#lazyLinesInfo[lineIndex - 1]!;
        const pervLineLastRectInfo = pervLineRects[pervLineRects.length - 1]!;
        const wrapPosition = this.#findWrapIndexInTargetTextNode(
          pervLineLastRectInfo,
        );
        const end = pervLineLastRectInfo.start + wrapPosition;
        if (pervLineInfo) pervLineInfo.end = end;
        currentLineInfo.start = end + 1;
      }
      if (currentLineInfo.end === undefined) {
        const currentLineRects = this.#lazyLinesInfo[lineIndex]!;
        const currentLineLastRectInfo =
          currentLineRects[currentLineRects.length - 1]!;
        if (lineIndex === this.#lazyLinesInfo.length - 1) {
          // the last line
          const currentNodeLength =
            currentLineLastRectInfo.node.nodeType === Node.TEXT_NODE
              ? (currentLineLastRectInfo.node as Text).data.length
              : 1;
          currentLineInfo.end = currentLineLastRectInfo.start
            + currentNodeLength;
        } else {
          const wrapPosition = this.#findWrapIndexInTargetTextNode(
            currentLineLastRectInfo,
          );
          currentLineInfo.end = currentLineLastRectInfo.start + wrapPosition;
          nextLineInfo!.start = currentLineInfo.end + 1;
        }
      }
      return currentLineInfo as LynxLineInfo;
    }
  }
  #getNodeInfoByIndex(nodeIndex: number) {
    const lastIndex = this.#lazyNodesInfo.length - 1;
    const lastNode = this.#lazyNodesInfo[lastIndex];
    let currentLength = lastNode ? lastNode.start + lastNode.length : 0;
    for (
      let currentIndex = this.#lazyNodesInfo.length,
        nextNode: Text | Element | undefined;
      (nextNode = this.nodelist.at(currentIndex))
      && nodeIndex >= this.#lazyNodesInfo.length;
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
      this.#lazyNodesInfo.push(currentNodeInfo);
    }
    return this.#lazyNodesInfo[nodeIndex];
  }
  getNodeInfoByCharIndex(searchTarget: number) {
    // binary search
    let left = 0;
    let right = this.#lazyNodesInfo.length - 1;
    let result;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midNodeInfo = this.#lazyNodesInfo[mid]!;
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
        let currentIndex = this.#lazyNodesInfo.length,
          nextNode: NodeInfo | undefined;
        (nextNode = this.#getNodeInfoByIndex(currentIndex));
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
  #nodeCache: (Text | Element)[] = [];
  #treeWalker: TreeWalker;
  constructor(dom: HTMLElement) {
    this.#treeWalker = document.createTreeWalker(
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
    if (this.#nodeCache[index]) {
      return this.#nodeCache[index];
    }
    this.#fillCacheTo(index);
    return this.#nodeCache[index];
  }
  #fillCacheTo(index: number) {
    let currentNode: Node | null = null;
    while (
      index >= this.#nodeCache.length
      && (currentNode = this.#treeWalker.nextNode())
    ) {
      this.#nodeCache.push(currentNode as Text | Element);
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
