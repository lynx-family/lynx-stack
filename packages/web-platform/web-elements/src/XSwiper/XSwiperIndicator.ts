/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
  bindToStyle,
  boostedQueueMicrotask,
} from '@lynx-js/web-elements-reactive';
import type { XSwiper } from './XSwiper.js';

export class XSwiperIndicator
  implements InstanceType<AttributeReactiveClass<typeof XSwiper>>
{
  static observedAttributes = [
    'indicator-color',
    'indicator-active-color',
    'page-margin',
    'previous-margin',
    'next-margin',
  ];
  #dom: XSwiper;
  #numOfChildElement = 0;
  #getIndicatorContainer = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#indicator-container',
  );
  #getIndicatorDynamicStyleContainer = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#indicator-style',
  );
  #childrenElementMutationObserver?: MutationObserver;

  constructor(dom: XSwiper) {
    this.#dom = dom;
  }

  @registerAttributeHandler('indicator-color', true)
  #handleIndicatorColor = bindToStyle(
    this.#getIndicatorContainer,
    '--indicator-color',
    undefined,
    true,
  );
  @registerAttributeHandler('indicator-active-color', true)
  #handleIndicatorActiveColor = bindToStyle(
    this.#getIndicatorContainer,
    '--indicator-active-color',
    undefined,
    true,
  );
  @registerAttributeHandler('page-margin', true)
  #handlePageMargin = bindToStyle(
    this.#getIndicatorContainer,
    '--page-margin',
    undefined,
    true,
  );
  @registerAttributeHandler('previous-margin', true)
  #handlePreviousMargin = bindToStyle(
    this.#getIndicatorContainer,
    '--previous-margin',
    undefined,
    true,
  );
  @registerAttributeHandler('next-margin', true)
  #handleNextMargin = bindToStyle(
    this.#getIndicatorContainer,
    '--next-margin',
    undefined,
    true,
  );

  #updateIndicatorDoms() {
    const currentNumber = this.#dom.childElementCount;
    if (currentNumber !== this.#numOfChildElement) {
      let nextInnerHtml = '';
      for (let ii = 0; ii < currentNumber; ii++) {
        nextInnerHtml +=
          `<div style="animation-timeline:--x-swiper-item-${ii};" part="indicator-item"></div>`;
      }
      this.#getIndicatorContainer().innerHTML = nextInnerHtml;
      if (currentNumber > 5) {
        for (let ii = 0; ii < currentNumber; ii++) {
          (this.#dom.children.item(ii) as HTMLElement)?.style.setProperty(
            'view-timeline-name',
            `--x-swiper-item-${ii}`,
          );
        }
        this.#getIndicatorDynamicStyleContainer().innerHTML =
          `:host { timeline-scope: ${
            Array.from(
              { length: currentNumber },
              (_, ii) => `--x-swiper-item-${ii}`,
            ).join(',')
          } !important; }`;
      }
    }
    this.#numOfChildElement = currentNumber;
  }

  connectedCallback(): void {
    this.#updateIndicatorDoms();
    this.#childrenElementMutationObserver = new MutationObserver(
      this.#updateIndicatorDoms.bind(this),
    );
    this.#childrenElementMutationObserver.observe(this.#dom, {
      attributes: false,
      characterData: false,
      childList: true,
      subtree: false,
    });
    if (!CSS.supports('timeline-scope', '--a, --b')) {
      this.#dom.addEventListener(
        'change',
        (({ detail }: CustomEvent<{ current: number }>) => {
          const currentPage = detail.current;
          const numberOfChildren = this.#dom.childElementCount;
          const indicatorContainer = this.#getIndicatorContainer();
          for (let ii = 0; ii < numberOfChildren; ii++) {
            const indicator = indicatorContainer.children[ii] as HTMLElement;
            if (indicator) {
              if (ii === currentPage) {
                indicator.style.setProperty(
                  'background-color',
                  'var(--indicator-active-color)',
                  'important',
                );
              } else {
                indicator.style.removeProperty('background-color');
              }
            }
          }
        }).bind(this) as EventListener,
      );
      boostedQueueMicrotask(() => {
        (
          this.#getIndicatorContainer().children[
            this.#dom.currentIndex
          ] as HTMLElement
        )?.style.setProperty(
          'background-color',
          'var(--indicator-active-color)',
          'important',
        );
      });
    }
  }
  dispose(): void {
    this.#childrenElementMutationObserver?.disconnect();
    this.#childrenElementMutationObserver = undefined;
  }
}
