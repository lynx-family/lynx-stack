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
  __dom: XOverlayNg;
  __useModernDialog = !!window.HTMLDialogElement;
  __visible = false;

  constructor(dom: XOverlayNg) {
    this.__dom = dom;
  }

  __getDialogDom = genDomGetter<HTMLDialogElement>(
    () => this.__dom.shadowRoot!,
    '__dialog',
  );

  @registerAttributeHandler('events-pass-through', true)
  __handleEventsPassThrough(newVal: string | null) {
    if (newVal !== null) {
      this.__getDialogDom().addEventListener(
        'click',
        this.__portalEventToMainDocument,
        { passive: false },
      );
      this.__dom.addEventListener('click', this.__portalEventToMainDocument, {
        passive: false,
      });
    } else {
      this.__getDialogDom().removeEventListener(
        'click',
        this.__portalEventToMainDocument,
      );
      this.__dom.removeEventListener('click', this.__portalEventToMainDocument);
    }
  }

  @registerAttributeHandler('visible', false)
  __handleVisible(newVal: string | null) {
    this.__visible = newVal !== null;
    if (this.__useModernDialog) {
      if (this.__visible) {
        this.__getDialogDom().showModal();
        this.__dom.dispatchEvent(
          new CustomEvent('showoverlay', commonComponentEventSetting),
        );
      } else {
        this.__getDialogDom().close();
        this.__dom.dispatchEvent(
          new CustomEvent('dismissoverlay', commonComponentEventSetting),
        );
      }
    }
  }

  __portalEventToMainDocument = (e: MouseEvent) => {
    e.stopPropagation();
    const diaglogDom = this.__getDialogDom();
    if (e.target === this.__dom || e.target === diaglogDom) {
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
        if (this.__visible && diaglogDom.isConnected) {
          diaglogDom.showModal();
        }
      });
    }
  };

  connectedCallback(): void {
    if (!this.__useModernDialog) {
      this.__getDialogDom().style.display = 'none';
    }
  }
}
