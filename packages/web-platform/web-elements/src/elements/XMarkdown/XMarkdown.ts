/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { templateXMarkdown } from '../htmlTemplates.js';
import {
  parseMarkdownStyle,
  serializeMarkdownStyle,
  XMarkdownAttributes,
} from './XMarkdownAttributes.js';
import type { MarkdownStyleConfig } from './XMarkdownAttributes.js';

type SelectionRoot = ShadowRoot & { getSelection?: () => Selection | null };
type SelectionWithComposedRanges = Selection & {
  getComposedRanges?: (...args: unknown[]) => StaticRange[];
};

const getComposedRange = (
  selection: Selection,
  shadowRoot: ShadowRoot | null,
): StaticRange | null => {
  const getComposedRanges = (selection as SelectionWithComposedRanges)
    .getComposedRanges;
  if (!shadowRoot || typeof getComposedRanges !== 'function') return null;
  try {
    return getComposedRanges.call(selection, {
      shadowRoots: [shadowRoot],
    })[0] ?? null;
  } catch {
    try {
      return getComposedRanges.call(selection, shadowRoot)[0] ?? null;
    } catch {
      return null;
    }
  }
};

const createRangeByOffsets = (
  doc: Document,
  root: HTMLElement,
  start: number,
  end: number,
): Range | null => {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const len = node.nodeValue?.length ?? 0;
    if (!startNode && pos + len >= start) {
      startNode = node;
      startOffset = start - pos;
    }
    if (pos + len >= end) {
      endNode = node;
      endOffset = end - pos;
      break;
    }
    pos += len;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode) return null;
  if (!endNode) {
    endNode = startNode;
    endOffset = startOffset;
  }

  const range = doc.createRange();
  range.setStart(
    startNode,
    Math.max(0, Math.min(startOffset, startNode.length)),
  );
  range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.length)));
  return range;
};

const getRenderedPrefixLengthForSourceOffset = (
  source: string,
  rendered: string,
  sourceOffset: number,
) => {
  let renderedIndex = 0;
  const limit = Math.max(0, Math.min(sourceOffset, source.length));

  for (let sourceIndex = 0; sourceIndex < limit; sourceIndex += 1) {
    if (renderedIndex >= rendered.length) break;
    if (source[sourceIndex] === rendered[renderedIndex]) {
      renderedIndex += 1;
    }
  }

  return renderedIndex;
};

const mapSourceRangeToCharRange = (
  source: string,
  rendered: string,
  start: number,
  end: number,
): { start: number; end: number } => {
  const renderedStart = getRenderedPrefixLengthForSourceOffset(
    source,
    rendered,
    start,
  );
  const renderedEnd = getRenderedPrefixLengthForSourceOffset(
    source,
    rendered,
    end,
  );
  return {
    start: renderedStart,
    end: Math.max(renderedStart, renderedEnd),
  };
};

const isSelectionNodeInsideHost = (
  dom: XMarkdown,
  shadowRoot: ShadowRoot | null,
  node: Node | null,
) =>
  !!node
  && (
    node === dom
    || node === shadowRoot
    || dom.contains(node)
    || !!shadowRoot?.contains(node)
  );

const getRangeInRoot = (
  dom: XMarkdown,
  root: HTMLElement,
  selection: Selection | null,
): Range | null => {
  if (!selection) return null;
  const shadowRoot = dom.shadowRoot as SelectionRoot | null;
  const sourceRange = getComposedRange(selection, shadowRoot)
    ?? (selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
  if (!sourceRange) return null;
  if (
    !root.contains(sourceRange.startContainer)
    || !root.contains(sourceRange.endContainer)
  ) {
    if (
      !isSelectionNodeInsideHost(dom, shadowRoot, sourceRange.startContainer)
      || !isSelectionNodeInsideHost(dom, shadowRoot, sourceRange.endContainer)
      || !isSelectionNodeInsideHost(dom, shadowRoot, selection.anchorNode)
      || !isSelectionNodeInsideHost(dom, shadowRoot, selection.focusNode)
    ) {
      return null;
    }
    const selectedText = selection.toString();
    if (!selectedText) {
      return null;
    }
    const start = root.textContent?.indexOf(selectedText) ?? -1;
    if (start < 0) return null;
    return createRangeByOffsets(
      dom.ownerDocument,
      root,
      start,
      start + selectedText.length,
    );
  }
  const range = dom.ownerDocument.createRange();
  range.setStart(sourceRange.startContainer, sourceRange.startOffset);
  range.setEnd(sourceRange.endContainer, sourceRange.endOffset);
  return range;
};

const getSelectionCandidates = (dom: XMarkdown): Selection[] => {
  const shadowRoot = dom.shadowRoot as SelectionRoot | null;
  const shadowSelection =
    shadowRoot && typeof shadowRoot.getSelection === 'function'
      ? shadowRoot.getSelection()
      : null;
  const documentSelection = dom.ownerDocument.getSelection();
  return [shadowSelection, documentSelection].filter(
    (selection, index, selections): selection is Selection =>
      !!selection && selections.indexOf(selection) === index,
  );
};

const getSelectionForRoot = (
  dom: XMarkdown,
  root: HTMLElement,
): { selection: Selection; range: Range } | null => {
  for (const selection of getSelectionCandidates(dom)) {
    const range = getRangeInRoot(dom, root, selection);
    if (range) return { selection, range };
  }
  return null;
};

const getPreferredSelectionTarget = (dom: XMarkdown): Selection | null => {
  const candidates = getSelectionCandidates(dom);
  return candidates[0] ?? null;
};

@Component<typeof XMarkdown>(
  'x-markdown',
  [CommonEventsAndMethods, XMarkdownAttributes],
  templateXMarkdown,
)
export class XMarkdown extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['content-complete']);

  #getMarkdownStyle() {
    return parseMarkdownStyle(this.getAttribute('markdown-style'));
  }

  #setMarkdownStyle(value: MarkdownStyleConfig | string | null) {
    const serialized = serializeMarkdownStyle(value);
    if (serialized === null) {
      this.removeAttribute('markdown-style');
    } else {
      this.setAttribute('markdown-style', serialized);
    }
  }

  get markdownStyle(): MarkdownStyleConfig {
    return this.#getMarkdownStyle();
  }

  set markdownStyle(value: MarkdownStyleConfig | string | null) {
    this.#setMarkdownStyle(value);
  }

  get ['markdown-style'](): MarkdownStyleConfig {
    return this.#getMarkdownStyle();
  }

  set ['markdown-style'](value: MarkdownStyleConfig | string | null) {
    this.#setMarkdownStyle(value);
  }

  /**
   * 获取当前渲染内容中的所有图片 URL。
   */
  getImages(): string[] {
    const root = this.shadowRoot?.querySelector(
      '#markdown-root',
    ) as HTMLElement | null;
    if (!root) return [];
    return Array.from(root.querySelectorAll('img'))
      .map((img) => img.getAttribute('src') || '')
      .filter((v) => !!v) as string[];
  }

  getContent(params?: { start?: number; end?: number }): { content: string } {
    const content = this.getAttribute('content') ?? '';
    const s = Math.max(0, params?.start ?? 0);
    const eInclusive = params?.end ?? (content.length - 1);
    const e = Math.min(content.length, eInclusive + 1);
    const slice = e >= s ? content.slice(s, e) : '';
    return { content: slice };
  }

  pauseAnimation() {
    this.setAttribute('animation-paused', 'true');
  }

  resumeAnimation(params?: { animationStep?: number }) {
    if (params?.animationStep !== undefined) {
      this.setAttribute('initial-animation-step', String(params.animationStep));
    }
    if (this.getAttribute('animation-type') !== 'typewriter') {
      this.setAttribute('animation-type', 'typewriter');
    }
    const velocity = this.getAttribute('animation-velocity');
    if (!velocity || Number(velocity) <= 0) {
      this.setAttribute('animation-velocity', '40');
    }
    this.removeAttribute('animation-paused');
  }

  getSelectedText(): string {
    const root = this.shadowRoot?.querySelector('#markdown-root') as
      | HTMLElement
      | null;
    if (!root) return '';
    const result = getSelectionForRoot(this, root);
    return result?.range.toString() ?? '';
  }

  getTextBoundingRect(
    params?: { start?: number; end?: number; indexType?: 'char' | 'source' },
  ): { boundingRect: DOMRect } | null {
    const root = this.shadowRoot?.querySelector('#markdown-root') as
      | HTMLElement
      | null;
    if (!root) return null;
    const doc = this.ownerDocument;
    const createRangeByChar = (s: number, e: number): Range | null => {
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let pos = 0;
      let startNode: Text | null = null;
      let startOffset = 0;
      let endNode: Text | null = null;
      let endOffset = 0;
      let node = walker.nextNode() as Text | null;
      while (node) {
        const len = node.nodeValue?.length ?? 0;
        if (!startNode && pos + len >= s) {
          startNode = node;
          startOffset = s - pos;
        }
        if (pos + len >= e) {
          endNode = node;
          endOffset = e - pos;
          break;
        }
        pos += len;
        node = walker.nextNode() as Text | null;
      }
      if (!startNode) return null;
      if (!endNode) {
        endNode = startNode;
        endOffset = startOffset;
      }
      const r = doc.createRange();
      r.setStart(
        startNode,
        Math.max(0, Math.min(startOffset, startNode.length)),
      );
      r.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.length)));
      return r;
    };
    if (params?.start !== undefined || params?.end !== undefined) {
      const s = Math.max(0, params?.start ?? 0);
      const e = Math.max(s, params?.end ?? s);
      const rangeOffsets = params?.indexType === 'source'
        ? mapSourceRangeToCharRange(
          this.getAttribute('content') ?? '',
          root.textContent ?? '',
          s,
          e,
        )
        : { start: s, end: e };
      if (!rangeOffsets) return null;
      const r = createRangeByChar(rangeOffsets.start, rangeOffsets.end);
      if (!r) return null;
      return { boundingRect: r.getBoundingClientRect() };
    }
    const result = getSelectionForRoot(this, root);
    if (!result) return null;
    return { boundingRect: result.range.getBoundingClientRect() };
  }

  setTextSelection(
    params: { startX: number; startY: number; endX: number; endY: number },
  ) {
    const doc = this.ownerDocument as any;
    const getRangeAtPoint = (x: number, y: number): Range | null => {
      if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
      if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(x, y);
        if (!pos) return null;
        const r = this.ownerDocument.createRange();
        r.setStart(pos.offsetNode, pos.offset);
        r.collapse(true);
        return r;
      }
      return null;
    };
    const r1 = getRangeAtPoint(params.startX, params.startY);
    const r2 = getRangeAtPoint(params.endX, params.endY);
    if (r1 && r2) {
      const sel = getPreferredSelectionTarget(this);
      if (!sel) return;
      sel.removeAllRanges();
      const range = this.ownerDocument.createRange();
      range.setStart(r1.startContainer, r1.startOffset);
      range.setEnd(r2.startContainer, r2.startOffset);
      sel.addRange(range);
    }
  }

  getParseResult(
    params: { tags: string[] },
  ): Record<string, { start: number; end: number }[]> {
    const root = this.shadowRoot?.querySelector('#markdown-root') as
      | HTMLElement
      | null;
    if (!root) return {};
    const text = root.textContent || '';
    const result: Record<string, { start: number; end: number }[]> = {};
    const doc = this.ownerDocument;
    const calcOffset = (node: Node): { start: number; end: number } => {
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let pos = 0;
      let start = -1;
      let end = -1;
      let current = walker.nextNode();
      while (current) {
        const len = (current.nodeValue || '').length;
        if (current === node || node.contains(current)) {
          if (start < 0) {
            start = pos;
          }
          end = pos + len;
        }
        pos += len;
        current = walker.nextNode();
      }
      return {
        start: Math.max(0, Math.min(start, text.length)),
        end: Math.max(0, Math.min(end, text.length)),
      };
    };
    for (const tag of params.tags) {
      const nodes = Array.from(root.querySelectorAll(tag));
      result[tag] = nodes.map((el) => calcOffset(el));
    }
    return result;
  }
}
