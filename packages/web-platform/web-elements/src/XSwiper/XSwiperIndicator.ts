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
  __dom: XSwiper;
  __numOfChildElement = 0;
  __getIndicatorContainer = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__indicator-container',
  );
  __getIndicatorDynamicStyleContainer = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__indicator-style',
  );
  __childrenElementMutationObserver?: MutationObserver;

  constructor(dom: XSwiper) {
    this.__dom = dom;
  }

  @registerAttributeHandler('indicator-color', true)
  __handleIndicatorColor = bindToStyle(
    this.__getIndicatorContainer,
    '--indicator-color',
    undefined,
    true,
  );
  @registerAttributeHandler('indicator-active-color', true)
  __handleIndicatorActiveColor = bindToStyle(
    this.__getIndicatorContainer,
    '--indicator-active-color',
    undefined,
    true,
  );
  @registerAttributeHandler('page-margin', true)
  __handlePageMargin = bindToStyle(
    this.__getIndicatorContainer,
    '--page-margin',
    undefined,
    true,
  );
  @registerAttributeHandler('previous-margin', true)
  __handlePreviousMargin = bindToStyle(
    this.__getIndicatorContainer,
    '--previous-margin',
    undefined,
    true,
  );
  @registerAttributeHandler('next-margin', true)
  __handleNextMargin = bindToStyle(
    this.__getIndicatorContainer,
    '--next-margin',
    undefined,
    true,
  );

  __updateIndicatorDoms() {
    const currentNumber = this.__dom.childElementCount;
    if (currentNumber !== this.__numOfChildElement) {
      let nextInnerHtml = '';
      for (let ii = 0; ii < currentNumber; ii++) {
        nextInnerHtml +=
          `<div style="animation-timeline:--x-swiper-item-${ii};" part="indicator-item"></div>`;
      }
      this.__getIndicatorContainer().innerHTML = nextInnerHtml;
      if (currentNumber > 5) {
        for (let ii = 0; ii < currentNumber; ii++) {
          (this.__dom.children.item(ii) as HTMLElement)?.style.setProperty(
            'view-timeline-name',
            `--x-swiper-item-${ii}`,
          );
        }
        this.__getIndicatorDynamicStyleContainer().innerHTML =
          `:host { timeline-scope: ${
            Array.from(
              { length: currentNumber },
              (_, ii) => `--x-swiper-item-${ii}`,
            ).join(',')
          } !important; }`;
      }
    }
    this.__numOfChildElement = currentNumber;
  }

  connectedCallback(): void {
    this.__updateIndicatorDoms();
    this.__childrenElementMutationObserver = new MutationObserver(
      this.__updateIndicatorDoms.bind(this),
    );
    this.__childrenElementMutationObserver.observe(this.__dom, {
      attributes: false,
      characterData: false,
      childList: true,
      subtree: false,
    });
    if (!CSS.supports('timeline-scope', '--a, --b')) {
      this.__dom.addEventListener(
        'change',
        (({ detail }: CustomEvent<{ current: number }>) => {
          const currentPage = detail.current;
          const numberOfChildren = this.__dom.childElementCount;
          const indicatorContainer = this.__getIndicatorContainer();
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
          this.__getIndicatorContainer().children[
            this.__dom.current
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
    this.__childrenElementMutationObserver?.disconnect();
    this.__childrenElementMutationObserver = undefined;
  }
}
