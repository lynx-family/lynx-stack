// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  IntersectionObserverMargins,
  LynxIntersectionObserverCommand,
  LynxIntersectionObserverEntry,
  LynxIntersectionObserverOptions,
  LynxIntersectionObserverRect,
} from '../../types/index.js';
import type { LynxViewInstance } from './LynxViewInstance.js';

type RootType = 'element' | 'screen' | 'viewport';

type ObservationTarget = {
  callbackId: number;
  isIntersecting?: boolean;
  ratio?: number;
};

type ObserverState = {
  browserObserver?: IntersectionObserver;
  componentId: string;
  margins: IntersectionObserverMargins;
  options: Required<LynxIntersectionObserverOptions>;
  rootSelector?: string;
  rootType: RootType;
  targets: Map<Element, ObservationTarget>;
};

const DEFAULT_MARGINS: IntersectionObserverMargins = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const DEFAULT_OPTIONS: Required<LynxIntersectionObserverOptions> = {
  thresholds: [0],
  initialRatio: 0,
  observeAll: false,
};

const EMPTY_RECT: LynxIntersectionObserverRect = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const BROWSER_THRESHOLD_EPSILON = 1e-7;

function normalizeThresholds(thresholds: number[] | undefined): number[] {
  const normalized = (
    Array.isArray(thresholds) ? thresholds : DEFAULT_OPTIONS.thresholds
  )
    .filter((threshold) =>
      Number.isFinite(threshold) && threshold >= 0 && threshold <= 1
    )
    .sort((left, right) => left - right);
  return normalized.length > 0 ? [...new Set(normalized)] : [0];
}

function toBrowserThresholds(thresholds: number[]): number[] {
  const browserThresholds = new Set(thresholds);
  for (const threshold of thresholds) {
    if (threshold < 1) {
      browserThresholds.add(
        Math.min(1, threshold + BROWSER_THRESHOLD_EPSILON),
      );
    }
  }
  return [...browserThresholds].sort((left, right) => left - right);
}

function toRootMarginValue(value: number | string | undefined): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}px` : '0px';
  }
  const normalized = value?.trim();
  if (!normalized) return '0px';
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)$/.test(normalized)) {
    return normalized;
  }
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    return `${normalized}px`;
  }
  return '0px';
}

function toRootMargin(margins: IntersectionObserverMargins): string {
  return [
    margins.top,
    margins.right,
    margins.bottom,
    margins.left,
  ].map(toRootMarginValue).join(' ');
}

function rectToPayload(
  rect: DOMRectReadOnly | null,
  offsetLeft: number,
  offsetTop: number,
): LynxIntersectionObserverRect {
  if (!rect) return { ...EMPTY_RECT };
  return {
    left: rect.left - offsetLeft,
    right: rect.right - offsetLeft,
    top: rect.top - offsetTop,
    bottom: rect.bottom - offsetTop,
  };
}

function hasCrossedThreshold(
  thresholds: number[],
  previousRatio: number,
  currentRatio: number,
): boolean {
  if (previousRatio === currentRatio) return false;
  return thresholds.some((threshold) =>
    threshold === previousRatio
    || threshold === currentRatio
    || (threshold < previousRatio) !== (threshold < currentRatio)
  );
}

export class IntersectionObserverService {
  readonly #lynxViewInstance: LynxViewInstance;
  readonly #observers = new Map<number, ObserverState>();
  #disposed = false;

  constructor(lynxViewInstance: LynxViewInstance) {
    this.#lynxViewInstance = lynxViewInstance;
  }

  handleCommand(command: LynxIntersectionObserverCommand): void {
    if (this.#disposed) return;
    switch (command.type) {
      case 'create':
        this.#create(
          command.observerId,
          command.componentId,
          command.options,
        );
        break;
      case 'relativeTo':
        this.#configureRoot(
          command.observerId,
          'element',
          command.margins,
          command.selector,
        );
        break;
      case 'relativeToViewport':
        this.#configureRoot(
          command.observerId,
          'viewport',
          command.margins,
        );
        break;
      case 'relativeToScreen':
        this.#configureRoot(
          command.observerId,
          'screen',
          command.margins,
        );
        break;
      case 'observe':
        this.#observe(
          command.observerId,
          command.selector,
          command.callbackId,
        );
        break;
      case 'disconnect':
        this.#disconnect(command.observerId);
        break;
    }
  }

  dispose(): void {
    this.#disposed = true;
    for (const observer of this.#observers.values()) {
      observer.browserObserver?.disconnect();
      observer.targets.clear();
    }
    this.#observers.clear();
  }

  #create(
    observerId: number,
    componentId: string,
    options: LynxIntersectionObserverOptions,
  ): void {
    this.#disconnect(observerId);
    this.#observers.set(observerId, {
      componentId,
      margins: { ...DEFAULT_MARGINS },
      options: {
        thresholds: normalizeThresholds(options.thresholds),
        initialRatio: Number.isFinite(options.initialRatio)
          ? options.initialRatio!
          : DEFAULT_OPTIONS.initialRatio,
        observeAll: options.observeAll ?? DEFAULT_OPTIONS.observeAll,
      },
      rootType: 'viewport',
      targets: new Map(),
    });
  }

  #configureRoot(
    observerId: number,
    rootType: RootType,
    margins: IntersectionObserverMargins,
    rootSelector?: string,
  ): void {
    const observer = this.#observers.get(observerId);
    if (!observer) return;
    observer.rootType = rootType;
    observer.rootSelector = rootSelector;
    observer.margins = { ...DEFAULT_MARGINS, ...margins };
    this.#rebuildBrowserObserver(observerId, observer);
  }

  #observe(
    observerId: number,
    selector: string,
    callbackId: number,
  ): void {
    const observer = this.#observers.get(observerId);
    if (!observer) return;
    const targets = observer.options.observeAll
      ? this.#resolveTargets(observer.componentId, selector)
      : [this.#resolveTarget(observer.componentId, selector)].filter(
        (target): target is HTMLElement => target !== null,
      );
    if (targets.length === 0) return;
    const browserObserver = this.#ensureBrowserObserver(observerId, observer);
    for (const target of targets) {
      if (observer.targets.has(target)) continue;
      observer.targets.set(target, { callbackId });
      browserObserver.observe(target);
    }
  }

  #disconnect(observerId: number): void {
    const observer = this.#observers.get(observerId);
    observer?.browserObserver?.disconnect();
    observer?.targets.clear();
    this.#observers.delete(observerId);
  }

  #rebuildBrowserObserver(
    observerId: number,
    observer: ObserverState,
  ): void {
    if (!observer.browserObserver) return;
    observer.browserObserver.disconnect();
    observer.browserObserver = undefined;
    if (observer.targets.size === 0) return;
    const browserObserver = this.#ensureBrowserObserver(
      observerId,
      observer,
    );
    for (const target of observer.targets.keys()) {
      browserObserver.observe(target);
    }
  }

  #ensureBrowserObserver(
    observerId: number,
    observer: ObserverState,
  ): IntersectionObserver {
    if (observer.browserObserver) return observer.browserObserver;
    const browserObserver = new IntersectionObserver(
      (entries) => {
        if (observer.browserObserver !== browserObserver) return;
        this.#handleEntries(observerId, observer, entries);
      },
      {
        root: this.#resolveRoot(observer),
        rootMargin: toRootMargin(observer.margins),
        threshold: toBrowserThresholds(observer.options.thresholds),
      },
    );
    observer.browserObserver = browserObserver;
    return browserObserver;
  }

  #resolveRoot(observer: ObserverState): Element | null {
    if (observer.rootType === 'screen') return null;
    if (observer.rootType === 'viewport') {
      return this.#getViewportRoot();
    }
    return observer.rootSelector
      ? this.#resolveTarget(observer.componentId, observer.rootSelector)
        ?? this.#getViewportRoot()
      : this.#getViewportRoot();
  }

  #getViewportRoot(): Element {
    return this.#lynxViewInstance.rootDom.querySelector('[part="page"]')
      ?? this.#lynxViewInstance.parentDom;
  }

  #resolveTarget(
    componentId: string,
    selector: string,
  ): HTMLElement | null {
    return this.#resolveTargets(componentId, selector)[0] ?? null;
  }

  #resolveTargets(
    componentId: string,
    selector: string,
  ): HTMLElement[] {
    if (!selector.startsWith('#')) {
      if (!/^\d+$/.test(selector)) return [];
      const target = this.#lynxViewInstance.mtsWasmBinding.getElementByUniqueId(
        Number(selector),
      );
      return target ? [target] : [];
    }

    const componentRoot = componentId && componentId !== 'card'
      ? this.#lynxViewInstance.mtsWasmBinding.getElementByComponentId(
        componentId,
      )
      : null;
    const scopedTargets = this.#querySelectorAll(
      componentRoot ?? null,
      selector,
    );
    return scopedTargets.length > 0
      ? scopedTargets
      : this.#querySelectorAll(this.#lynxViewInstance.rootDom, selector);
  }

  #querySelectorAll(
    root: Element | ShadowRoot | null,
    selector: string,
  ): HTMLElement[] {
    if (!root) return [];
    try {
      const targets = [...root.querySelectorAll<HTMLElement>(selector)];
      if (root instanceof HTMLElement && root.matches(selector)) {
        targets.unshift(root);
      }
      return targets;
    } catch {
      return [];
    }
  }

  #handleEntries(
    observerId: number,
    observer: ObserverState,
    entries: IntersectionObserverEntry[],
  ): void {
    const shouldOffsetFromViewport = observer.rootType !== 'screen';
    const lynxViewRect = shouldOffsetFromViewport
      ? this.#lynxViewInstance.boundingClientRectService.getLynxViewRect()
      : null;
    const offsetLeft = lynxViewRect?.left ?? 0;
    const offsetTop = lynxViewRect?.top ?? 0;

    for (const entry of entries) {
      const target = observer.targets.get(entry.target);
      if (!target) continue;
      const hasArea = entry.intersectionRect.width > 0
        && entry.intersectionRect.height > 0;
      const isIntersecting = entry.isIntersecting && hasArea;
      const intersectionRatio = isIntersecting ? entry.intersectionRatio : 0;
      const currentRatio = isIntersecting ? intersectionRatio : -1;
      let shouldNotify: boolean;
      if (target.ratio === undefined) {
        shouldNotify = observer.options.initialRatio < intersectionRatio;
      } else {
        const previousRatio = target.isIntersecting ? target.ratio : -1;
        shouldNotify = hasCrossedThreshold(
          observer.options.thresholds,
          previousRatio,
          currentRatio,
        );
      }
      target.ratio = intersectionRatio;
      target.isIntersecting = isIntersecting;
      if (!shouldNotify) continue;

      const payload: LynxIntersectionObserverEntry = {
        relativeRect: rectToPayload(
          entry.rootBounds,
          offsetLeft,
          offsetTop,
        ),
        boundingClientRect: rectToPayload(
          entry.boundingClientRect,
          offsetLeft,
          offsetTop,
        ),
        intersectionRect: isIntersecting
          ? rectToPayload(entry.intersectionRect, offsetLeft, offsetTop)
          : { ...EMPTY_RECT },
        intersectionRatio,
        isIntersecting,
        time: 0,
        observerId: (entry.target as HTMLElement).id,
      };
      this.#lynxViewInstance.backgroundThread
        .dispatchIntersectionObserverEvent(
          observerId,
          target.callbackId,
          payload,
        );
    }
  }
}
