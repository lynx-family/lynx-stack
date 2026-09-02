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

const getSelectionDetail = (dom: HTMLElement): SelectionChangeDetail => {
  const selection = dom.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return emptySelection();
  }

  const anchor = getTextOffset(
    dom,
    selection.anchorNode,
    selection.anchorOffset,
  );
  const focus = getTextOffset(dom, selection.focusNode, selection.focusOffset);
  if (anchor === null || focus === null || anchor === focus) {
    return emptySelection();
  }

  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
    direction: anchor < focus ? 'forward' : 'backward',
  };
};

export class XTextSelectionEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];

  readonly #dom: HTMLElement;
  #enabled = false;
  #connected = false;
  #attached = false;
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
    const shouldAttach = this.#enabled && this.#connected;
    if (shouldAttach === this.#attached) return;

    if (shouldAttach) {
      this.#dom.ownerDocument.addEventListener(
        'selectionchange',
        this.#handleSelectionChange,
      );
    } else {
      this.#dom.ownerDocument.removeEventListener(
        'selectionchange',
        this.#handleSelectionChange,
      );
    }
    this.#attached = shouldAttach;
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
