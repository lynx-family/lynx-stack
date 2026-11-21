import { expect, rstest, test } from '@rstest/core';
import { JSDOM } from 'jsdom';

import { TemplateSectionLabel } from '../ts/constants.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';

const { window } = new JSDOM(undefined, { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: window.document,
});
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: window.location,
});

const workers: MockWorker[] = [];

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly doneMessage: Promise<void>;
  #resolveDone!: () => void;

  constructor() {
    this.doneMessage = new Promise<void>((resolve) => {
      this.#resolveDone = resolve;
    });
    workers.push(this);
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'ready' } } as MessageEvent);
    });
  }

  postMessage(message: { type: string; url?: string }) {
    if (message.type !== 'load') return;

    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          type: 'section',
          label: TemplateSectionLabel.StyleInfo,
          url: message.url,
          data: new ArrayBuffer(0),
          config: {},
        },
      } as MessageEvent);
      this.onmessage?.({
        data: { type: 'done', url: message.url },
      } as MessageEvent);
      this.#resolveDone();
    });
  }

  terminate() {}
}

Object.defineProperty(globalThis, 'Worker', {
  configurable: true,
  value: MockWorker,
});

rstest.mock('../ts/client/wasm.js', () => ({
  wasmInstance: {
    StyleSheetResource: class {},
  },
  wasmModule: {},
}));

const { TemplateManager } = await import(
  '../ts/client/mainthread/TemplateManager.js'
);

function createInstance(onStyleInfoReady = rstest.fn()) {
  return {
    onPageConfigReady: rstest.fn(),
    onStyleInfoReady,
    onMTSScriptsLoaded: rstest.fn(),
    onBTSScriptsLoaded: rstest.fn(),
    backgroundThread: { markTiming: rstest.fn() },
  } as unknown as LynxViewInstance;
}

test('waits for async section handlers before resolving shared bundle loads', async () => {
  const manager = new TemplateManager();
  const worker = workers.at(-1)!;
  const url = 'http://localhost/shared-bundle';
  let resolveFirstInstance!: (instance: LynxViewInstance) => void;
  const firstInstancePromise = new Promise<LynxViewInstance>((resolve) => {
    resolveFirstInstance = resolve;
  });
  const firstInstance = createInstance();
  const secondOnStyleInfoReady = rstest.fn((loadedUrl: string) => {
    expect(manager.getStyleSheet(loadedUrl)).toBeDefined();
  });
  const secondInstance = createInstance(secondOnStyleInfoReady);

  const firstLoad = manager.fetchBundle(
    url,
    firstInstancePromise,
    false,
    false,
    false,
  );
  const secondLoad = manager.fetchBundle(
    url,
    Promise.resolve(secondInstance),
    false,
    false,
    false,
  );

  await worker.doneMessage;
  const secondLoadSettled = await Promise.race([
    secondLoad.then(() => true, () => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 100)),
  ]);
  expect(secondLoadSettled).toBe(false);

  resolveFirstInstance(firstInstance);
  await Promise.all([firstLoad, secondLoad]);

  expect(secondOnStyleInfoReady).toHaveBeenCalledWith(url);
  expect(manager.getStyleSheet(url)).toBeDefined();
});
