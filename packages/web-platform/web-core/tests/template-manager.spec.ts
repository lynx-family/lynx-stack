import './jsdom.js';
import { describe, test, expect, rstest, beforeEach } from '@rstest/core';
import { encode, type TasmJSONInfo } from '../ts/encode/index.js';
import { MagicHeader0, MagicHeader1 } from '../ts/constants.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { HeartbreakMessage } from '../ts/client/decodeWorker/types.js';

// Import the worker script to execute it and register the handler
await import('../ts/client/decodeWorker/decode.worker.js');
// -------------------------------------

// Mock wasm-feature-detect to ensure we load the standard WASM
rstest.mock('wasm-feature-detect', () => ({
  referenceTypes: async () => true,
  simd: async () => true,
}));

// Import TemplateManager after mocks are set up
const { templateManager } = await import(
  '../ts/client/mainthread/TemplateManager.js'
);

const sampleTasm: TasmJSONInfo = {
  styleInfo: {},
  manifest: {},
  cardType: 'card',
  appType: 'react',
  pageConfig: {
    foo: 'bar',
    enableCSSSelector: true,
    isLazyComponentTemplate: false,
  },
  lepusCode: { root: 'console.log("hello")' },
  customSections: {
    'my-section': {
      type: 'lazy',
      content: 'some content',
    },
  },
  elementTemplates: {},
};

const mockLynxViewInstance = {
  onPageConfigReady: rstest.fn(),
  onStyleInfoReady: rstest.fn(),
  onMTSScriptsLoaded: rstest.fn(),
  onBTSScriptsLoaded: rstest.fn(),
  backgroundThread: rstest.mockObject({
    markTiming: rstest.fn(),
  }),
} as unknown as LynxViewInstance;

function isHeartbreakMessage(message: unknown): message is HeartbreakMessage {
  return typeof message === 'object'
    && message !== null
    && (message as Partial<HeartbreakMessage>).type === 'heartbreak';
}

describe('Template Manager', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    globalThis.fetch = rstest.fn();
  });

  test('should exchange worker-level heartbreak ack messages', async () => {
    const postMessageSpy = rstest.spyOn(globalThis, 'postMessage');

    try {
      const startedAt = performance.now();
      let heartbreakMessages = postMessageSpy.mock.calls.filter(
        ([message]) => isHeartbreakMessage(message),
      );

      while (
        heartbreakMessages.length < 2
        && performance.now() - startedAt < 5000
      ) {
        await new Promise(resolve => setTimeout(resolve, 50));
        heartbreakMessages = postMessageSpy.mock.calls.filter(
          ([message]) => isHeartbreakMessage(message),
        );
      }

      expect(heartbreakMessages.length).toBeGreaterThanOrEqual(2);
    } finally {
      postMessageSpy.mockRestore();
    }
  });

  test('should encode and decode correctly with version 1', async () => {
    const templateUrl = 'http://example.com/template_version_test';
    const encoded = encode(sampleTasm);

    // Verify version in encoded buffer
    const view = new DataView(encoded.buffer);
    const magic0 = view.getUint32(0, true);
    const magic1 = view.getUint32(4, true);
    expect(magic0).toBe(MagicHeader0);
    expect(magic1).toBe(MagicHeader1);
    const version = view.getUint32(8, true);
    expect(version).toBe(1);

    // Mock fetch
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    await templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
    );

    // Verify data using getCustomSection
    const customSections = templateManager.getBundle(templateUrl)
      ?.customSections;
    const decoder = new TextDecoder('utf-16le');
    const decodedCustomSections = JSON.parse(
      decoder.decode(customSections as unknown as Uint8Array),
    );
    expect(decodedCustomSections).toEqual(sampleTasm.customSections);
  });

  test('should throw error for unsupported version', async () => {
    const templateUrl = 'http://example.com/template_unsupported_version';
    const encoded = encode(sampleTasm);
    const buffer = new Uint8Array(encoded);
    const view = new DataView(buffer.buffer);
    view.setUint32(8, 2, true); // Set version to 2

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    await expect(
      templateManager.fetchBundle(
        templateUrl,
        Promise.resolve(mockLynxViewInstance),
        false,
        false,
        false,
      ),
    )
      .rejects.toThrow('Unsupported version: 2');

    // Verify template is removed
    expect(templateManager.getBundle(templateUrl)?.customSections)
      .toBeUndefined();
  });

  /*
  test('should throw error for create same template twice', () => {
    const templateUrl = 'http://example.com/template_duplicate_url_test';
    templateManager.createBundle(templateUrl);
    expect(() => {
      templateManager.createBundle(templateUrl);
    }).toThrow();
  });
  */

  test('should handle streaming', async () => {
    const encoded = encode(sampleTasm);

    const stream = new ReadableStream({
      async start(controller) {
        const chunkSize = 10;
        for (let i = 0; i < encoded.length; i += chunkSize) {
          controller.enqueue(encoded.slice(i, i + chunkSize));
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        controller.close();
      },
    });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    await templateManager.fetchBundle(
      'http://example.com/template',
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
    );

    // Verify data using getCustomSection
    const customSections = templateManager.getBundle(
      'http://example.com/template',
    )?.customSections;
    const decoder = new TextDecoder('utf-16le');
    const decodedCustomSections = JSON.parse(
      decoder.decode(customSections as unknown as Uint8Array),
    );
    expect(decodedCustomSections).toEqual(sampleTasm.customSections);
  });

  /*
  test('should remove template correctly', () => {
    const templateUrl = 'http://example.com/template_to_remove';
    templateManager.createBundle(templateUrl);

    // Manually set a custom section to verify existence
    templateManager.setCustomSection(templateUrl, { test: 'data' });
    expect(templateManager.getBundle(templateUrl)?.customSections).toEqual({
      test: 'data',
    });

    templateManager.removeBundle(templateUrl);

    expect(templateManager.getBundle(templateUrl)?.customSections)
      .toBeUndefined();
  });
  */

  test('should clean up template on stream error', async () => {
    const templateUrl = 'http://example.com/template_stream_error';
    const encoded = encode(sampleTasm);
    // Get valid header (8 bytes magic + 4 bytes version)
    const header = encoded.slice(0, 12);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(header);
        controller.error(new Error('Stream failed'));
      },
    });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    await expect(
      templateManager.fetchBundle(
        templateUrl,
        Promise.resolve(mockLynxViewInstance),
        false,
        false,
        false,
      ),
    ).rejects.toThrow('Stream failed');

    expect(templateManager.getBundle(templateUrl)?.customSections)
      .toBeUndefined();
  });

  test('should handle overrideConfig correctly', async () => {
    const templateUrl = 'http://example.com/template_override_test';
    const encoded = encode(sampleTasm);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    const overrideConfig = {
      cardType: 'override-card',
    };

    await templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
      overrideConfig as any,
    );

    // Verify config was merged and passed to instance
    expect(mockLynxViewInstance.onPageConfigReady).toHaveBeenCalledWith(
      expect.objectContaining({
        cardType: 'override-card',
        foo: 'bar',
      }),
    );
  });

  test('should reuse a bundle and ignore a later overrideConfig', async () => {
    const templateUrl = 'http://example.com/template_override_blob_test';
    const encoded = encode({
      ...sampleTasm,
      manifest: {
        '/app-service.js': 'module.exports = "background";',
      },
    });

    (globalThis.fetch as any).mockImplementation(() => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: stream,
      });
    });

    await templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
      {
        cardType: 'first-card',
        enableCSSSelector: 'true',
      },
    );

    const oldBundle = templateManager.getBundle(templateUrl);
    expect(Object.values(oldBundle?.lepusCode ?? {}).length).toBeGreaterThan(0);
    expect(Object.values(oldBundle?.backgroundCode ?? {}).length)
      .toBeGreaterThan(0);

    const createBundleSpy = rstest.spyOn(templateManager, 'createBundle');
    const revokeObjectURLSpy = rstest.spyOn(URL, 'revokeObjectURL');
    try {
      await templateManager.fetchBundle(
        templateUrl,
        Promise.resolve(mockLynxViewInstance),
        false,
        false,
        false,
        {
          cardType: 'ignored-card',
        },
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(templateManager.getBundle(templateUrl)).toBe(oldBundle);
      expect(templateManager.getBundle(templateUrl)?.config?.cardType)
        .toBe('first-card');
      expect(createBundleSpy).not.toHaveBeenCalled();
      expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    } finally {
      createBundleSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    }
  });

  test('should not dispose a cached bundle for a later overrideConfig', async () => {
    const templateUrl = 'http://example.com/template_override_conflict_test';
    const encoded = encode(sampleTasm);

    (globalThis.fetch as any).mockImplementation(() => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: stream,
      });
    });

    await templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
      { cardType: 'first-card' },
    );

    const oldBundle = templateManager.getBundle(templateUrl);
    expect(oldBundle?.styleSheet).toBeDefined();
    const createBundleSpy = rstest.spyOn(templateManager, 'createBundle');
    const revokeObjectURLSpy = rstest.spyOn(URL, 'revokeObjectURL');
    const freeStyleSheetSpy = rstest.spyOn(oldBundle!.styleSheet!, 'free');
    try {
      await templateManager.fetchBundle(
        templateUrl,
        Promise.resolve(mockLynxViewInstance),
        false,
        false,
        false,
        { cardType: 'ignored-card' },
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(templateManager.getBundle(templateUrl)).toBe(oldBundle);
      expect(templateManager.getBundle(templateUrl)?.config?.cardType)
        .toBe('first-card');
      expect(createBundleSpy).not.toHaveBeenCalled();
      expect(revokeObjectURLSpy).not.toHaveBeenCalled();
      expect(freeStyleSheetSpy).not.toHaveBeenCalled();
    } finally {
      createBundleSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      freeStyleSheetSpy.mockRestore();
    }
  });

  test('should ignore a later overrideConfig while the URL is loading', async () => {
    const templateUrl =
      'http://example.com/template_concurrent_override_conflict_test';
    const encoded = encode(sampleTasm);
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    const firstLoad = templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
      { cardType: 'first-card' },
    );

    const secondLoad = templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
      { cardType: 'ignored-card' },
    );

    streamController.enqueue(encoded);
    streamController.close();
    await Promise.all([firstLoad, secondLoad]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(templateManager.getBundle(templateUrl)?.config?.cardType)
      .toBe('first-card');
  });

  test('should load web-core.main-thread.json correctly', async () => {
    const jsonContent = {
      'styleInfo': {
        '0': {
          'rules': [],
          'content': [],
        },
      },
      'lepusCode': {
        'app-service.js':
          'globalThis.runtime = lynxCoreInject.tt; globalThis.__lynx_worker_type = \'background\'',
        'manifest-chunk.js': 'module.exports = \'hello\';',
        'manifest-chunk2.js': 'module.exports = \'world\';',
      },
      'manifest': {
        '/app-service.js':
          'globalThis.runtime = lynxCoreInject.tt; globalThis.__lynx_worker_type = \'background\'',
        '/manifest-chunk.js': 'module.exports = \'hello\';',
        '/manifest-chunk2.js': 'module.exports = \'world\';',
        '/json': '{}',
      },
      'customSections': {},
      'cardType': 'react',
      'appType': 'card',
      'pageConfig': {
        'enableFiberArch': true,
        'useLepusNG': true,
        'enableReuseContext': true,
        'bundleModuleMode': 'ReturnByFunction',
        'templateDebugUrl': '',
        'debugInfoOutside': true,
        'defaultDisplayLinear': true,
        'enableCSSInvalidation': true,
        'enableCSSSelector': true,
        'enableLepusDebug': false,
        'enableRemoveCSSScope': true,
        'targetSdkVersion': '2.10',
      },
    };

    const jsonString = JSON.stringify(jsonContent);
    const encoded = new TextEncoder().encode(jsonString);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    const templateUrl = 'http://example.com/web-core.main-thread.json';
    await templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
    );

    // Verify config
    expect(mockLynxViewInstance.onPageConfigReady).toHaveBeenCalledWith(
      expect.objectContaining(
        Object.fromEntries(
          Object.entries(jsonContent.pageConfig).map((
            [k, v],
          ) => [k, String(v)]),
        ),
      ),
    );

    // Verify style info
    expect(mockLynxViewInstance.onStyleInfoReady).toHaveBeenCalled();

    // Verify script decoding (LepusCode)
    expect(mockLynxViewInstance.onMTSScriptsLoaded).toHaveBeenCalled();
  });

  test('should detect lazy appType from lepusCode.root prefix for json template', async () => {
    const jsonContent = {
      'lepusCode': {
        'root': '(function (globDynamicComponentEntry) {})',
      },
      'pageConfig': {},
    };

    const jsonString = JSON.stringify(jsonContent);
    const encoded = new TextEncoder().encode(jsonString);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    const templateUrl = 'http://example.com/lazy.json';
    await templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(mockLynxViewInstance),
      false,
      false,
      false,
    );

    // Verify config has appType = lazy and isLazy = true
    expect(mockLynxViewInstance.onPageConfigReady).toHaveBeenCalledWith(
      expect.objectContaining({
        appType: 'lazy',
        isLazy: 'true',
      }),
    );
  });

  test('should not result in partial bundle when fetchBundle is called twice concurrently', async () => {
    const encoded = encode(sampleTasm);

    const stream = new ReadableStream({
      async start(controller) {
        // Enqueue with a small delay so concurrent requests wait
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.enqueue(encoded);
        controller.close();
      },
    });

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
    });

    const instance1 = {
      ...mockLynxViewInstance,
      onPageConfigReady: rstest.fn(),
      backgroundThread: { markTiming: rstest.fn() },
    };
    const instance2 = {
      ...mockLynxViewInstance,
      onPageConfigReady: rstest.fn(),
      backgroundThread: { markTiming: rstest.fn() },
    };

    // Trigger both concurrently
    await Promise.all([
      templateManager.fetchBundle(
        'http://example.com/template_concurrent',
        Promise.resolve(instance1 as unknown as LynxViewInstance),
        false,
        false,
        false,
      ),
      templateManager.fetchBundle(
        'http://example.com/template_concurrent',
        Promise.resolve(instance2 as unknown as LynxViewInstance),
        false,
        false,
        false,
      ),
    ]);

    // Verify both finish correctly
    const customSections = templateManager.getBundle(
      'http://example.com/template_concurrent',
    )?.customSections;
    const decoder = new TextDecoder('utf-16le');
    const decodedCustomSections = JSON.parse(
      decoder.decode(customSections as unknown as Uint8Array),
    );
    expect(decodedCustomSections).toEqual(sampleTasm.customSections);
    expect(instance1.onPageConfigReady).toHaveBeenCalled();
    expect(instance2.onPageConfigReady).toHaveBeenCalled();
  });
});
