/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  registerEventEnableStatusChangeHandler,
} from '../../element-reactive/index.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

type SelectionChangeDetail = {
  start: number;
  end: number;
  direction: 'forward' | 'backward';
};

const emptySelection = (): SelectionChangeDetail => ({
  start: -1,
  end: -1,
  direction: 'forward',
});

/**
 * Converts a selection boundary to an offset in the target's text. Using the
 * range text length provides one offset space across nested text nodes.
 */
const getTextOffset = (
  root: HTMLElement,
  node: Node | null,
  offset: number,
) => {
  if (!node || !root.contains(node)) return null;
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  return range.toString().length;
};

/**
 * Returns offsets relative to the target text. A -1 offset means the selection
 * is collapsed, unavailable, or outside the target.
 */
const getSelectionDetail = (dom: HTMLElement): SelectionChangeDetail => {
  const selection = dom.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return emptySelection();
  }

  const anchor = getTextOffset(
    dom,
    selection.anchorNode,
    selection.anchorOffset,
  );
  const focus = getTextOffset(dom, selection.focusNode, selection.focusOffset);
  if (anchor !== null && focus !== null && anchor !== focus) {
    return {
      start: Math.min(anchor, focus),
      end: Math.max(anchor, focus),
      direction: anchor < focus ? 'forward' : 'backward',
    };
  }

  // WebKit retargets selection endpoints outside a shadow tree. Ask for the
  // composed range to recover the actual text nodes in that case.
  const shadowRoots: ShadowRoot[] = [];
  let root = dom.getRootNode();
  while (root instanceof ShadowRoot) {
    shadowRoots.push(root);
    root = root.host.getRootNode();
  }
  const [range] = selection.getComposedRanges?.({ shadowRoots }) ?? [];
  const start = range
    ? getTextOffset(dom, range.startContainer, range.startOffset)
    : null;
  const end = range
    ? getTextOffset(dom, range.endContainer, range.endOffset)
    : null;
  if (start === null || end === null || start === end) return emptySelection();

  return {
    start,
    end,
    direction: selection.direction === 'backward' ? 'backward' : 'forward',
  };
};

export class XTextSelectionEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];

  readonly #dom: HTMLElement;
  #enabled = false;
  #connected = false;
  #attachedDocument?: Document;
  #lastSelectionSignature?: string;

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }

  connectedCallback() {
    this.#connected = true;
    this.#updateSelectionChangeListener();
  }

  dispose() {
    this.#connected = false;
    this.#updateSelectionChangeListener();
  }

  @registerEventEnableStatusChangeHandler('selectionchange')
  _handleEnableSelectionChangeEvent(status: boolean) {
    this.#enabled = status;
    if (!status) this.#lastSelectionSignature = undefined;
    this.#updateSelectionChangeListener();
  }

  #updateSelectionChangeListener() {
    const document = this.#dom.ownerDocument;
    const shouldAttach = this.#enabled && this.#connected;
    if (shouldAttach && this.#attachedDocument === document) return;
    if (!shouldAttach && !this.#attachedDocument) return;

    this.#attachedDocument?.removeEventListener(
      'selectionchange',
      this.#handleSelectionChange,
    );
    if (shouldAttach) {
      document.addEventListener(
        'selectionchange',
        this.#handleSelectionChange,
      );
    }
    this.#attachedDocument = shouldAttach ? document : undefined;
  }

  #handleSelectionChange = () => {
    const detail = getSelectionDetail(this.#dom);
    const signature = `${detail.start}:${detail.end}:${detail.direction}`;
    if (
      signature === this.#lastSelectionSignature
      || (detail.start === -1 && this.#lastSelectionSignature === undefined)
    ) {
      return;
    }

    this.#lastSelectionSignature = signature;
    this.#dom.dispatchEvent(
      new CustomEvent('selectionchange', {
        ...commonComponentEventSetting,
        detail,
      }),
    );
  };
}
