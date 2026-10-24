// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './jsdom.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { IntersectionObserverService } from '../ts/client/mainthread/IntersectionObserverService.js';

type ObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  readonly #callback: ObserverCallback;
  readonly observed = new Set<Element>();
  disconnect = rstest.fn(() => this.observed.clear());
  unobserve = rstest.fn((target: Element) => this.observed.delete(target));
  takeRecords = rstest.fn((): IntersectionObserverEntry[] => []);

  constructor(
    callback: ObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.#callback = callback;
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? '0px';
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0];
    MockIntersectionObserver.instances.push(this);
  }

  observe = rstest.fn((target: Element) => {
    this.observed.add(target);
  });

  emit(entries: IntersectionObserverEntry[]): void {
    this.#callback(entries, this);
  }
}

function createRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRectReadOnly {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON() {
      return {};
    },
  };
}

function createEntry(
  target: Element,
  {
    intersectionRatio,
    isIntersecting,
    rootBounds = createRect(10, 20, 200, 300),
    boundingClientRect = createRect(30, 50, 100, 80),
    intersectionRect = createRect(30, 50, 100, 80),
  }: {
    intersectionRatio: number;
    isIntersecting: boolean;
    rootBounds?: DOMRectReadOnly | null;
    boundingClientRect?: DOMRectReadOnly;
    intersectionRect?: DOMRectReadOnly;
  },
): IntersectionObserverEntry {
  return {
    boundingClientRect,
    intersectionRatio,
    intersectionRect,
    isIntersecting,
    rootBounds,
    target,
    time: 123,
  };
}

function createFixture() {
  const parentDom = document.createElement('lynx-view');
  document.body.append(parentDom);
  const rootDom = parentDom.attachShadow({ mode: 'open' });
  const page = document.createElement('div');
  page.setAttribute('part', 'page');
  const component = document.createElement('div');
  component.id = 'component';
  const target = document.createElement('div');
  target.id = 'target';
  const secondTarget = document.createElement('div');
  secondTarget.id = 'target';
  const relative = document.createElement('div');
  relative.id = 'relative';
  component.append(relative, target, secondTarget);
  page.append(component);
  rootDom.append(page);

  const dispatchIntersectionObserverEvent = rstest.fn();
  const instance = {
    backgroundThread: {
      dispatchIntersectionObserverEvent,
    },
    boundingClientRectService: {
      getLynxViewRect: () => createRect(10, 20, 200, 300),
    },
    mtsWasmBinding: {
      getElementByComponentId: (componentId: string) =>
        componentId === 'component-id' ? component : undefined,
      getElementByUniqueId: (uniqueId: number) =>
        uniqueId === 42 ? target : undefined,
    },
    parentDom,
    rootDom,
  } as unknown as LynxViewInstance;

  return {
    component,
    dispatchIntersectionObserverEvent,
    instance,
    page,
    parentDom,
    relative,
    secondTarget,
    target,
  };
}

describe('IntersectionObserverService', () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  test('resolves targets in the component and dispatches Lynx-relative entries', () => {
    const {
      dispatchIntersectionObserverEvent,
      instance,
      page,
      target,
    } = createFixture();
    const service = new IntersectionObserverService(instance);

    service.handleCommand({
      type: 'create',
      observerId: 7,
      componentId: 'component-id',
      options: {
        thresholds: [0.5, 0, 0.5],
        initialRatio: 0,
        observeAll: false,
      },
    });
    service.handleCommand({
      type: 'relativeToViewport',
      observerId: 7,
      margins: { top: 1, right: '2px', bottom: 3, left: '4%' },
    });
    service.handleCommand({
      type: 'observe',
      observerId: 7,
      selector: '#target',
      callbackId: 3,
    });

    const browserObserver = MockIntersectionObserver.instances[0]!;
    expect(browserObserver.root).toBe(page);
    expect(browserObserver.rootMargin).toBe('1px 2px 3px 4%');
    expect(browserObserver.thresholds).toHaveLength(4);
    expect(browserObserver.thresholds[0]).toBe(0);
    expect(browserObserver.thresholds[1]).toBeCloseTo(1e-7, 12);
    expect(browserObserver.thresholds[2]).toBe(0.5);
    expect(browserObserver.thresholds[3]).toBeCloseTo(0.5000001, 12);
    expect(browserObserver.observe).toHaveBeenCalledWith(target);

    browserObserver.emit([
      createEntry(target, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
    ]);

    expect(dispatchIntersectionObserverEvent).toHaveBeenCalledWith(
      7,
      3,
      {
        boundingClientRect: {
          bottom: 110,
          left: 20,
          right: 120,
          top: 30,
        },
        intersectionRatio: 1,
        intersectionRect: {
          bottom: 110,
          left: 20,
          right: 120,
          top: 30,
        },
        isIntersecting: true,
        observerId: 'target',
        relativeRect: {
          bottom: 300,
          left: 0,
          right: 200,
          top: 0,
        },
        time: 0,
      },
    );
  });

  test('supports element roots, uid targets, and screen coordinates', () => {
    const {
      dispatchIntersectionObserverEvent,
      instance,
      relative,
      target,
    } = createFixture();
    const service = new IntersectionObserverService(instance);

    service.handleCommand({
      type: 'create',
      observerId: 1,
      componentId: 'component-id',
      options: {},
    });
    service.handleCommand({
      type: 'relativeTo',
      observerId: 1,
      selector: '#relative',
      margins: {},
    });
    service.handleCommand({
      type: 'observe',
      observerId: 1,
      selector: '42',
      callbackId: 2,
    });
    expect(MockIntersectionObserver.instances[0]!.root).toBe(relative);
    expect(MockIntersectionObserver.instances[0]!.observed).toContain(target);

    service.handleCommand({
      type: 'relativeToScreen',
      observerId: 1,
      margins: {},
    });
    const screenObserver = MockIntersectionObserver.instances[1]!;
    expect(screenObserver.root).toBeNull();
    MockIntersectionObserver.instances[0]!.emit([
      createEntry(target, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).not.toHaveBeenCalled();
    screenObserver.emit([
      createEntry(target, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).toHaveBeenCalledWith(
      1,
      2,
      expect.objectContaining({
        boundingClientRect: {
          bottom: 130,
          left: 30,
          right: 130,
          top: 50,
        },
      }),
    );
  });

  test('observes every matching target when observeAll is enabled', () => {
    const {
      dispatchIntersectionObserverEvent,
      instance,
      secondTarget,
      target,
    } = createFixture();
    const service = new IntersectionObserverService(instance);

    service.handleCommand({
      type: 'create',
      observerId: 1,
      componentId: 'component-id',
      options: {
        initialRatio: -1,
        observeAll: true,
      },
    });
    service.handleCommand({
      type: 'observe',
      observerId: 1,
      selector: '#target',
      callbackId: 2,
    });

    const browserObserver = MockIntersectionObserver.instances[0]!;
    expect(browserObserver.observed).toEqual(new Set([target, secondTarget]));

    browserObserver.emit([
      createEntry(target, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
      createEntry(secondTarget, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
    ]);

    expect(dispatchIntersectionObserverEvent).toHaveBeenCalledTimes(2);
    expect(dispatchIntersectionObserverEvent).toHaveBeenNthCalledWith(
      1,
      1,
      2,
      expect.objectContaining({ observerId: 'target' }),
    );
    expect(dispatchIntersectionObserverEvent).toHaveBeenNthCalledWith(
      2,
      1,
      2,
      expect.objectContaining({ observerId: 'target' }),
    );
  });

  test('matches native initial-ratio and threshold filtering', () => {
    const { dispatchIntersectionObserverEvent, instance, target } =
      createFixture();
    const service = new IntersectionObserverService(instance);

    service.handleCommand({
      type: 'create',
      observerId: 1,
      componentId: '',
      options: {
        thresholds: [0.5],
        initialRatio: 0.75,
      },
    });
    service.handleCommand({
      type: 'observe',
      observerId: 1,
      selector: '#target',
      callbackId: 0,
    });
    const browserObserver = MockIntersectionObserver.instances[0]!;
    browserObserver.emit([
      createEntry(target, {
        intersectionRatio: 0.5,
        isIntersecting: true,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).not.toHaveBeenCalled();

    browserObserver.emit([
      createEntry(target, {
        intersectionRatio: 0.6,
        isIntersecting: true,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).toHaveBeenCalledTimes(1);

    browserObserver.emit([
      createEntry(target, {
        intersectionRatio: 0,
        intersectionRect: createRect(0, 0, 0, 0),
        isIntersecting: false,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).toHaveBeenCalledTimes(2);
    expect(dispatchIntersectionObserverEvent).toHaveBeenLastCalledWith(
      1,
      0,
      expect.objectContaining({
        intersectionRect: {
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
        },
        isIntersecting: false,
      }),
    );
  });

  test('disconnects individual observers and all observers on dispose', () => {
    const { dispatchIntersectionObserverEvent, instance, target } =
      createFixture();
    const service = new IntersectionObserverService(instance);
    for (const observerId of [1, 2]) {
      service.handleCommand({
        type: 'create',
        observerId,
        componentId: '',
        options: {},
      });
      service.handleCommand({
        type: 'observe',
        observerId,
        selector: '#target',
        callbackId: observerId,
      });
    }
    const [first, second] = MockIntersectionObserver.instances;

    service.handleCommand({ type: 'disconnect', observerId: 1 });
    expect(first!.disconnect).toHaveBeenCalledTimes(1);
    expect(second!.disconnect).not.toHaveBeenCalled();
    first!.emit([
      createEntry(target, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).not.toHaveBeenCalled();

    service.dispose();
    expect(second!.disconnect).toHaveBeenCalledTimes(1);
    service.handleCommand({
      type: 'create',
      observerId: 3,
      componentId: '',
      options: {},
    });
    service.handleCommand({
      type: 'observe',
      observerId: 3,
      selector: '#target',
      callbackId: 3,
    });
    expect(MockIntersectionObserver.instances).toHaveLength(2);
    second!.emit([
      createEntry(target, {
        intersectionRatio: 1,
        isIntersecting: true,
      }),
    ]);
    expect(dispatchIntersectionObserverEvent).not.toHaveBeenCalled();
  });
});
