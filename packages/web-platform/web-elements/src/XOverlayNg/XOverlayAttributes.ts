/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XOverlayNg } from './XOverlayNg.js';
import {
  type AttributeReactiveClass,
  registerAttributeHandler,
  genDomGetter,
} from '@lynx-js/web-elements-reactive';

export class XOverlayAttributes
  implements InstanceType<AttributeReactiveClass<typeof XOverlayNg>>
{
  static observedAttributes = ['visible', 'events-pass-through'];
  #dom: XOverlayNg;
  #useModernDialog = !!window.HTMLDialogElement;
  #visible = false;

  constructor(dom: XOverlayNg) {
    this.#dom = dom;
  }

  #getDialogDom = genDomGetter<HTMLDialogElement>(
    () => this.#dom.shadowRoot!,
    '#dialog',
  );

  @registerAttributeHandler('events-pass-through', true)
  #handleEventsPassThrough(newVal: string | null) {
    if (newVal !== null) {
      this.#getDialogDom().addEventListener(
        'click',
        this.#portalEventToMainDocument,
        { passive: false },
      );
      this.#dom.addEventListener('click', this.#portalEventToMainDocument, {
        passive: false,
      });
    } else {
      this.#getDialogDom().removeEventListener(
        'click',
        this.#portalEventToMainDocument,
      );
      this.#dom.removeEventListener('click', this.#portalEventToMainDocument);
    }
  }

  @registerAttributeHandler('visible', false)
  #handleVisible(newVal: string | null) {
    this.#visible = newVal !== null;
    if (this.#useModernDialog) {
      if (this.#visible) {
        this.#getDialogDom().showModal();
        this.#dom.dispatchEvent(
          new CustomEvent('showoverlay', commonComponentEventSetting),
        );
      } else {
        this.#getDialogDom().close();
        this.#dom.dispatchEvent(
          new CustomEvent('dismissoverlay', commonComponentEventSetting),
        );
      }
    }
  }

  #portalEventToMainDocument = (e: MouseEvent) => {
    e.stopPropagation();
    const diaglogDom = this.#getDialogDom();
    if (e.target === this.#dom || e.target === diaglogDom) {
      diaglogDom.close();
      const { clientX, clientY } = e;
      let targetElement = document.elementFromPoint(clientX, clientY);
      if (targetElement?.tagName === 'LYNX-VIEW' && targetElement.shadowRoot) {
        targetElement =
          targetElement.shadowRoot.elementFromPoint(clientX, clientY)
            ?? targetElement;
      }
      targetElement?.dispatchEvent(new MouseEvent('click', e));
      requestAnimationFrame(() => {
        if (this.#visible && diaglogDom.isConnected) {
          diaglogDom.showModal();
        }
      });
    }
  };

  connectedCallback(): void {
    if (!this.#useModernDialog) {
      this.#getDialogDom().style.display = 'none';
    }
  }
}
