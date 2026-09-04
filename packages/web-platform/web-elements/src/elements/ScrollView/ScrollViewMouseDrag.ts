// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { boostedQueueMicrotask } from '../../element-reactive/index.js';
import type {
  AttributeReactiveClass,
  WebComponentClass,
} from '../../element-reactive/index.js';

const dragStartThreshold = 5;
const userScrollableOverflowValues = new Set(['auto', 'overlay', 'scroll']);
const blockingOverscrollBehaviorValues = new Set(['contain', 'none']);

interface ScrollAxes {
  x: boolean;
  y: boolean;
}

interface ScrollCandidate {
  allowsChaining: boolean;
  dom: HTMLElement;
  start: number;
}

interface ScrollChain {
  owner: HTMLElement;
  ownerAxes: ScrollAxes;
  x: ScrollCandidate[];
  y: ScrollCandidate[];
}

interface DragState {
  activeAxes?: ScrollAxes;
  chain: ScrollChain;
  document: Document;
  dragging: boolean;
  pendingDeltaX: number;
  pendingDeltaY: number;
  pointerId: number;
  scrollUpdateQueued: boolean;
  startClientX: number;
  startClientY: number;
  previousUserSelect?: string;
}

interface ClickSuppressionState {
  suppress: boolean;
  target: Document | Window;
  timer?: ReturnType<typeof setTimeout>;
}

function getScrollableAxes(
  dom: HTMLElement,
  style: CSSStyleDeclaration,
): ScrollAxes {
  if (dom.getAttribute('enable-scroll') === 'false') {
    return { x: false, y: false };
  }

  return {
    x: userScrollableOverflowValues.has(style.overflowX)
      && dom.scrollWidth - dom.clientWidth > 1,
    y: userScrollableOverflowValues.has(style.overflowY)
      && dom.scrollHeight - dom.clientHeight > 1,
  };
}

function findScrollChain(event: PointerEvent): ScrollChain | undefined {
  let owner: HTMLElement | undefined;
  let ownerAxes: ScrollAxes | undefined;
  const x: ScrollCandidate[] = [];
  const y: ScrollCandidate[] = [];

  for (const target of event.composedPath()) {
    if (
      !(target instanceof HTMLElement) || target.localName !== 'scroll-view'
    ) {
      continue;
    }

    const style = getComputedStyle(target);
    const axes = getScrollableAxes(target, style);
    if (!axes.x && !axes.y) {
      continue;
    }
    if (!owner) {
      owner = target;
      ownerAxes = axes;
    }
    if (axes.x) {
      x.push({
        allowsChaining: !blockingOverscrollBehaviorValues.has(
          style.overscrollBehaviorX,
        ),
        dom: target,
        start: target.scrollLeft,
      });
    }
    if (axes.y) {
      y.push({
        allowsChaining: !blockingOverscrollBehaviorValues.has(
          style.overscrollBehaviorY,
        ),
        dom: target,
        start: target.scrollTop,
      });
    }
  }

  return owner && ownerAxes ? { owner, ownerAxes, x, y } : undefined;
}

function selectDragAxes(
  chain: ScrollChain,
  deltaX: number,
  deltaY: number,
): ScrollAxes | undefined {
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);
  if (Math.hypot(deltaX, deltaY) <= dragStartThreshold) {
    return undefined;
  }

  const hasX = chain.x.length > 0;
  const hasY = chain.y.length > 0;
  if (chain.ownerAxes.x && chain.ownerAxes.y) {
    return { x: hasX, y: hasY };
  }
  if (hasX && hasY) {
    if (absoluteX === absoluteY) {
      return chain.ownerAxes.x
        ? { x: true, y: false }
        : { x: false, y: true };
    }
    return absoluteX > absoluteY
      ? { x: true, y: false }
      : { x: false, y: true };
  }
  if (hasX && absoluteX >= absoluteY) {
    return { x: true, y: false };
  }
  if (hasY && absoluteY >= absoluteX) {
    return { x: false, y: true };
  }
  return undefined;
}

function applyScrollDelta(
  candidates: ScrollCandidate[],
  delta: number,
  axis: 'x' | 'y',
) {
  let remaining = delta;
  for (const candidate of candidates) {
    const next = candidate.start + remaining;
    if (axis === 'x') {
      candidate.dom.scrollTo({
        behavior: 'instant',
        left: next,
        top: candidate.dom.scrollTop,
      });
      remaining -= candidate.dom.scrollLeft - candidate.start;
    } else {
      candidate.dom.scrollTo({
        behavior: 'instant',
        left: candidate.dom.scrollLeft,
        top: next,
      });
      remaining -= candidate.dom.scrollTop - candidate.start;
    }

    if (!candidate.allowsChaining) {
      return;
    }
  }
}

/**
 * Makes a scroll-view follow mouse dragging in the same direction as touch
 * scrolling. Pointer events from touchscreens are left to the browser.
 */
class ScrollViewMouseDrag
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static readonly observedAttributes = [];

  readonly #dom: HTMLElement;
  #connected = false;
  #dragState?: DragState;
  #clickSuppression?: ClickSuppressionState;

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }

  #handlePointerDown = (event: PointerEvent) => {
    if (
      event.pointerType !== 'mouse'
      || !event.isPrimary
      || event.button !== 0
      || this.#dragState
    ) {
      return;
    }

    const chain = findScrollChain(event);
    if (!chain || chain.owner !== this.#dom) {
      return;
    }

    const document = this.#dom.ownerDocument;
    this.#dragState = {
      chain,
      document,
      dragging: false,
      pendingDeltaX: 0,
      pendingDeltaY: 0,
      pointerId: event.pointerId,
      scrollUpdateQueued: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };

    this.#trackPotentialClick(document);
    document.addEventListener('pointermove', this.#handlePointerMove, {
      capture: true,
      passive: false,
    });
    document.addEventListener('pointerup', this.#handlePointerUp, true);
    document.addEventListener('pointercancel', this.#handlePointerCancel, true);
    document.defaultView?.addEventListener('blur', this.#handlePointerCancel);
  };

  #handlePointerMove = (event: PointerEvent) => {
    const state = this.#dragState;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    if ((event.buttons & 1) === 0) {
      this.#stopDragging(false);
      return;
    }

    const deltaX = event.clientX - state.startClientX;
    const deltaY = event.clientY - state.startClientY;
    if (!state.dragging) {
      const activeAxes = selectDragAxes(state.chain, deltaX, deltaY);
      if (!activeAxes) {
        return;
      }

      state.activeAxes = activeAxes;
      state.dragging = true;
      state.previousUserSelect = this.#dom.style.userSelect;
      this.#dom.style.userSelect = 'none';
      state.document.getSelection()?.removeAllRanges();
      this.#dom.setPointerCapture(event.pointerId);
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    state.pendingDeltaX = -deltaX;
    state.pendingDeltaY = -deltaY;
    if (!state.scrollUpdateQueued) {
      state.scrollUpdateQueued = true;
      boostedQueueMicrotask(() => this.#flushScrollUpdate(state));
    }
  };

  #flushScrollUpdate(state: DragState) {
    if (!state.scrollUpdateQueued) {
      return;
    }

    state.scrollUpdateQueued = false;
    if (state.activeAxes?.x) {
      applyScrollDelta(state.chain.x, state.pendingDeltaX, 'x');
    }
    if (state.activeAxes?.y) {
      applyScrollDelta(state.chain.y, state.pendingDeltaY, 'y');
    }
  }

  #handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.#dragState?.pointerId) {
      return;
    }
    this.#stopDragging(this.#dragState.dragging);
  };

  #handlePointerCancel = (event?: PointerEvent | Event) => {
    if (
      event instanceof PointerEvent
      && event.pointerId !== this.#dragState?.pointerId
    ) {
      return;
    }
    this.#stopDragging(false);
  };

  #handleDragStart = (event: DragEvent) => {
    if (this.#dragState) {
      event.preventDefault();
    }
  };

  #handleClick = (event: Event) => {
    if (
      !this.#clickSuppression?.suppress
      || !event.composedPath().includes(this.#dom)
    ) {
      return;
    }

    this.#clearClickSuppression();
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  #stopDragging(suppressClick: boolean) {
    const state = this.#dragState;
    if (!state) {
      return;
    }

    const { document } = state;
    this.#flushScrollUpdate(state);
    document.removeEventListener('pointermove', this.#handlePointerMove, true);
    document.removeEventListener('pointerup', this.#handlePointerUp, true);
    document.removeEventListener(
      'pointercancel',
      this.#handlePointerCancel,
      true,
    );
    document.defaultView?.removeEventListener(
      'blur',
      this.#handlePointerCancel,
    );

    if (this.#dom.hasPointerCapture(state.pointerId)) {
      this.#dom.releasePointerCapture(state.pointerId);
    }

    if (state.dragging && this.#dom.style.userSelect === 'none') {
      this.#dom.style.userSelect = state.previousUserSelect ?? '';
    }
    this.#dragState = undefined;

    if (suppressClick) {
      const clickSuppression = this.#clickSuppression;
      if (clickSuppression) {
        clickSuppression.suppress = true;
        clearTimeout(clickSuppression.timer);
        clickSuppression.timer = setTimeout(
          this.#clearClickSuppression,
          0,
        );
      }
    } else {
      this.#clearClickSuppression();
    }
  }

  #trackPotentialClick(document: Document) {
    this.#clearClickSuppression();
    const target = document.defaultView ?? document;
    this.#clickSuppression = { suppress: false, target };
    target.addEventListener('click', this.#handleClick, true);
  }

  #clearClickSuppression = () => {
    const clickSuppression = this.#clickSuppression;
    if (!clickSuppression) {
      return;
    }
    clickSuppression.target.removeEventListener(
      'click',
      this.#handleClick,
      true,
    );
    clearTimeout(clickSuppression.timer);
    this.#clickSuppression = undefined;
  };

  connectedCallback(): void {
    if (this.#connected) {
      return;
    }
    this.#connected = true;
    this.#dom.addEventListener('pointerdown', this.#handlePointerDown, true);
    this.#dom.addEventListener('dragstart', this.#handleDragStart, true);
  }

  dispose(): void {
    this.#connected = false;
    this.#dom.removeEventListener('pointerdown', this.#handlePointerDown, true);
    this.#dom.removeEventListener('dragstart', this.#handleDragStart, true);
    this.#stopDragging(false);
    this.#clearClickSuppression();
  }
}

const scrollViewTagName = 'scroll-view';
const registeredClasses = new WeakSet<CustomElementConstructor>();

function registerMouseDragPlugin(elementClass: CustomElementConstructor) {
  if (registeredClasses.has(elementClass)) {
    return;
  }

  const componentClass = elementClass as WebComponentClass;
  if (!componentClass.registerPlugin) {
    return;
  }
  componentClass.registerPlugin(ScrollViewMouseDrag);
  registeredClasses.add(elementClass);
}

if (typeof customElements !== 'undefined') {
  const registeredScrollView = customElements.get(scrollViewTagName);
  if (registeredScrollView) {
    registerMouseDragPlugin(registeredScrollView);
  } else {
    const define = Reflect.get(
      customElements,
      'define',
    ) as CustomElementRegistry['define'];
    customElements.define = function(name, elementClass, options) {
      if (name === scrollViewTagName) {
        registerMouseDragPlugin(elementClass);
      }
      Reflect.apply(define, this, [name, elementClass, options]);
    };
    void customElements.whenDefined(scrollViewTagName).then(
      registerMouseDragPlugin,
    );
  }
}
