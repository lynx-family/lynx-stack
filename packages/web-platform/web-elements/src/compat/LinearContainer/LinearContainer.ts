// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  type AttributeReactiveClass,
  bindToAttribute,
} from '../../element-reactive/index.js';

/** For @container
 * chrome 111, safari 18, firefox no
 *
 * However, when the chromuim version is less than 116.0.5806.0, the following code will crash:
 * ```
 *  <style>
      #container {
        --lynx-display: flex;
      }

      #target {
        background-color: red;
        width: 400px;
        height: 400px;
      }

      @container style(--lynx-display: flex) {
        #target {
          background-color: green;
        }
      }
    </style>
    <div id="container">
      <div id="target"></div>
    </div>
    <script>
      const target = document.getElementById('container');
      container.style.setProperty('display', 'none');
      setTimeout(() => {
        target.style.removeProperty('display');
      }, 10);
    </script>
 * ```
 * it fixed in 116.0.5806.0, detail: https://issues.chromium.org/issues/40270007
 *
 * so we limit this feature to chrome 117, safari 18, firefox no:
 * -webkit-box-reflect: chrome 4, safari 4, firefox no
 *  https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-box-reflect
 * transition-behavior:allow-discrete: chrome 117, safari 18, firefox 125
 *  https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
 *  https://caniuse.com/mdn-css_properties_display_is_transitionable
 *
 * update this once firefox supports this.
 */
const supportContainerStyleQuery = CSS.supports('-webkit-box-reflect: above')
  && CSS.supports('transition-behavior:allow-discrete')
  && CSS.supports('content-visibility: auto');

class LinearContainerImpl
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static readonly observedAttributes = [];
  static readonly observedCSSProperties = [
    '--lynx-display',
    '--lynx-linear-orientation',
  ];

  readonly #dom: HTMLElement;

  constructor(currentElement: HTMLElement) {
    this.#dom = currentElement;
    // @ts-expect-error
    this.cssPropertyChangedHandler = {
      '--lynx-display': this.#setComputedDisplay,
      '--lynx-linear-orientation': this.#setLinearOrientation,
    };
  }

  #setComputedDisplay = bindToAttribute(
    () => this.#dom,
    'lynx-computed-display',
  );

  #setLinearOrientation = bindToAttribute(
    () => this.#dom,
    'lynx-linear-orientation',
  );
}

export const LinearContainer = supportContainerStyleQuery
  ? undefined
  : LinearContainerImpl;
