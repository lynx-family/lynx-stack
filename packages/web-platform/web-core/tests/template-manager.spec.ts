import './jsdom.js';
import { resolveObjectURL } from 'node:buffer';
import {
  describe,
  test,
  expect,
  rstest,
  beforeEach,
  afterEach,
} from '@rstest/core';
import {
  encode,
  encodeLynxXML,
  type TasmJSONInfo,
} from '../ts/encode/index.js';
import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../ts/constants.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
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
  afterEach(() => rstest.unstubAllGlobals());

  test.each(
    [
      ['external', false, false],
      ['lazy', false, false],
      ['external', true, false],
      ['lazy', true, false],
      ['external', true, true],
    ] as const,
  )(
    'keeps real decoded modes distinct (%s first, concurrent=%s, separate instances=%s)',
    async (first, concurrent, separateInstances) => {
      const url =
        `http://example.com/mixed-${first}-${concurrent}-${separateInstances}.bundle`;
      const encoded = encode({
        ...sampleTasm,
        lepusCode: { root: '(function () { return "lazy"; })' },
        styleInfo: {
          '0': [{
            type: 'StyleRule',
            selectorText: { value: '.mode-probe' },
            style: [{ name: 'background-color', value: 'red' }],
            variables: {},
          }],
        },
      });
      rstest.mocked(globalThis.fetch).mockImplementation(async () =>
        new Response(encoded)
      );
      const modes = first === 'external'
        ? ['external', 'lazy']
        : ['lazy', 'external'];
      const load = (mode: string) =>
        templateManager.fetchBundle(
          url,
          Promise.resolve(
            separateInstances
              ? { ...mockLynxViewInstance }
              : mockLynxViewInstance,
          ),
          false,
          false,
          false,
          {
            isLazy: mode === 'lazy' ? 'true' : 'false',
            isExternalBundle: mode === 'external' ? 'true' : 'false',
          },
        );
      const bundles = concurrent
        ? await Promise.all(modes.map(load))
        : [await load(modes[0]!), await load(modes[1]!)];
      expect(
        rstest.mocked(mockLynxViewInstance.onPageConfigReady).mock.calls.map((
          [config],
        ) => config.isLazy),
      ).toEqual(
        modes.map(mode => mode === 'lazy' ? 'true' : 'false'),
      );
      const { wasmInstance } = await import('../ts/client/wasm.js');
      for (const [index, bundle] of bundles.entries()) {
        const lazy = modes[index] === 'lazy';
        expect(bundle.config?.isLazy).toBe(lazy ? 'true' : 'false');
        const root = document.createElement('div').attachShadow({
          mode: 'open',
        });
        const context = new wasmInstance.MainThreadWasmContext(
          root,
          {} as any,
          true,
        );
        context.push_style_sheet(bundle.styleSheet!);
        const css = root.querySelector('style')!.textContent!;
        expect(css.includes(`l-e-name="${url}"`)).toBe(lazy);
        const code = await resolveObjectURL(bundle.lepusCode!.root!)!.text();
        expect(code).toContain(`${url}/root`);
        const module = { exports: undefined as unknown };
        new Function('module', code)(module);
        if (lazy) expect((module.exports as () => string)()).toBe('lazy');
        else expect(module.exports).toEqual({});
        expect(await load(modes[index]!)).toBe(bundle);
        context.free();
      }
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    },
  );

  test.each([undefined, 'QueryComponent', 'FetchBundle'] as const)(
    'uses authored %s CSS mode without changing the lazy wrapper',
    async lazyBundleFetcher => {
      const url = `http://example.com/css-mode-${lazyBundleFetcher}.bundle`;
      const encoded = encode({
        ...sampleTasm,
        pageConfig: {
          enableCSSSelector: true,
          enableRemoveCSSScope: true,
          ...(lazyBundleFetcher ? { lazyBundleFetcher } : {}),
        },
        lepusCode: { root: '(function () { return "lazy"; })' },
        styleInfo: {
          '0': [{
            type: 'StyleRule',
            selectorText: { value: '.mode-probe' },
            style: [{ name: 'background-color', value: 'red' }],
            variables: {},
          }],
        },
      });
      rstest.mocked(globalThis.fetch).mockResolvedValue(new Response(encoded));
      const bundle = await templateManager.fetchBundle(
        url,
        Promise.resolve(mockLynxViewInstance),
        false,
        false,
        false,
      );
      const { wasmInstance } = await import('../ts/client/wasm.js');
      const root = document.createElement('div').attachShadow({ mode: 'open' });
      const context = new wasmInstance.MainThreadWasmContext(
        root,
        {} as any,
        true,
      );
      context.push_style_sheet(bundle.styleSheet!);
      expect(
        root.querySelector('style')!.textContent!.includes(`l-e-name="${url}"`),
      ).toBe(lazyBundleFetcher !== 'FetchBundle');
      const code = await resolveObjectURL(bundle.lepusCode!.root!)!.text();
      const module = { exports: undefined as unknown };
      new Function('module', code)(module);
      expect((module.exports as () => string)()).toBe('lazy');
      context.free();
    },
  );

  test.each([true, false])(
    'queryComponent retains its decoded root alongside an external load (external first=%s)',
    async externalFirst => {
      const url = `http://example.com/instance-mixed-${externalFirst}.bundle`;
      const encoded = encode({
        ...sampleTasm,
        lepusCode: { root: '(function () { return "lazy"; })' },
        styleInfo: {
          '0': [{
            type: 'StyleRule',
            selectorText: { value: '.instance-probe' },
            style: [{ name: 'background-color', value: 'red' }],
            variables: {},
          }],
        },
      });
      rstest.mocked(globalThis.fetch).mockImplementation(async () =>
        new Response(encoded)
      );
      const parent = document.createElement('div') as LynxViewElement;
      rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
      const root = parent.attachShadow({ mode: 'open' });
      const instance = new LynxViewInstance(
        parent,
        {},
        {},
        'http://example.com/host.bundle',
        root,
        {
          globalWindow: {} as typeof globalThis,
          loadScript: async blobUrl => {
            const module = { exports: undefined as unknown };
            new Function('module', await resolveObjectURL(blobUrl)!.text())(
              module,
            );
            return module.exports;
          },
          loadScriptSync: rstest.fn(),
        },
        false,
        undefined,
      );
      instance.onPageConfigReady({ enableCSSSelector: 'true' });
      // The host is already running; keep the test at the bundle loading boundary.
      rstest.spyOn(instance, 'onMTSScriptsExecuted').mockImplementation(
        () => {},
      );
      rstest.spyOn(instance.backgroundThread, 'updateBTSChunk')
        .mockResolvedValue();
      rstest.spyOn(instance.backgroundThread, 'startBTS').mockImplementation(
        () => {},
      );
      const external = () => instance.loadExternalBundle(url);
      const lazy = () => instance.queryComponent(url);
      const results = await Promise.all(
        externalFirst ? [external(), lazy()] : [lazy(), external()],
      );
      const lazyResult = results[externalFirst ? 1 : 0] as () => string;
      expect(lazyResult()).toBe('lazy');
      expect(results[externalFirst ? 0 : 1]).toEqual({
        url,
        code: 0,
        errorMsg: '',
      });
      const styles = Array.from(
        root.querySelectorAll('style'),
        style => style.textContent!,
      );
      expect(styles.some(css => css.includes(`l-e-name="${url}"`))).toBe(true);
      expect(
        styles.some(css =>
          css.includes('instance-probe') && !css.includes(`l-e-name="${url}"`)
        ),
      ).toBe(true);
    },
  );

  test('retains root custom sections without a main-thread section', async () => {
    const url = 'http://example.com/background-only.json';
    const customSections = { metadata: { content: 'background-only' } };
    rstest.mocked(globalThis.fetch).mockImplementation(async () =>
      new Response(JSON.stringify({
        pageConfig: { cardType: 'react', isLazy: false },
        manifest: { '/app-service.js': 'module.exports = {};' },
        customSections,
      }))
    );
    const instance = {
      ...mockLynxViewInstance,
      templateUrl: url,
    } as LynxViewInstance;
    const bundle = await templateManager.fetchBundle(
      url,
      Promise.resolve(instance),
      false,
      false,
      false,
    );
    expect(bundle.lepusCode).toBeUndefined();
    expect(instance.template).toBe(bundle);
    expect(instance.template?.customSections).toEqual(customSections);
    const cachedInstance = {
      ...mockLynxViewInstance,
      templateUrl: url,
    } as LynxViewInstance;
    expect(
      await templateManager.fetchBundle(
        url,
        Promise.resolve(cachedInstance),
        false,
        false,
        false,
      ),
    ).toBe(bundle);
    expect(cachedInstance.template).toBe(bundle);
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

  test.each([false, true])(
    'registers styles before main-thread execution (reject=%s)',
    async reject => {
      const templateUrl =
        `http://example.com/styles_before_execution_${reject}`;
      const encoded = encode(sampleTasm);
      const view = new DataView(
        encoded.buffer,
        encoded.byteOffset,
        encoded.byteLength,
      );
      const labels: number[] = [];
      for (let offset = 12; offset < encoded.length;) {
        labels.push(view.getUint32(offset, true));
        offset += 8 + view.getUint32(offset + 4, true);
      }
      expect(labels.indexOf(TemplateSectionLabel.LepusCode)).toBeLessThan(
        labels.indexOf(TemplateSectionLabel.StyleInfo),
      );
      rstest.mocked(globalThis.fetch).mockResolvedValue(new Response(encoded));
      const instance = {
        ...mockLynxViewInstance,
        onMTSScriptsLoaded: rstest.fn(async () => {
          expect(mockLynxViewInstance.onStyleInfoReady).toHaveBeenCalledWith(
            templateUrl,
            expect.any(Object),
          );
          expect(templateManager.getStyleSheet(templateUrl)).toBeDefined();
          expect(instance.backgroundThread.markTiming).toHaveBeenCalledWith(
            'decode_end',
          );
          expect(instance.backgroundThread.markTiming).toHaveBeenCalledWith(
            'load_template_start',
          );
          if (reject) throw new Error('main-thread execution failed');
        }),
      } as unknown as LynxViewInstance;
      const pending = templateManager.fetchBundle(
        templateUrl,
        Promise.resolve(instance),
        false,
        false,
        false,
      );
      if (reject) {
        await expect(pending).rejects.toThrow('main-thread execution failed');
        expect(templateManager.getBundle(templateUrl)).toBeUndefined();
      } else {
        await pending;
      }
      expect(instance.onMTSScriptsLoaded).toHaveBeenCalled();
    },
  );

  test('should wait for background chunks before resolving', async () => {
    const templateUrl = 'http://example.com/template_background_ready';
    const encoded = encode(sampleTasm);
    let resolveBackgroundChunks!: () => void;
    const backgroundChunksReady = new Promise<void>(resolve => {
      resolveBackgroundChunks = resolve;
    });
    const lynxViewInstance = {
      ...mockLynxViewInstance,
      onBTSScriptsLoaded: rstest.fn(() => backgroundChunksReady),
    } as unknown as LynxViewInstance;
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

    let settled = false;
    const fetchPromise = templateManager.fetchBundle(
      templateUrl,
      Promise.resolve(lynxViewInstance),
      false,
      false,
      false,
    ).then(() => {
      settled = true;
    });
    const startedAt = performance.now();
    while (
      !lynxViewInstance.onBTSScriptsLoaded.mock.calls.length
      && performance.now() - startedAt < 5000
    ) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    expect(lynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalled();
    expect(settled).toBe(false);
    resolveBackgroundChunks();
    await fetchPromise;
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
      isExternalBundle: 'true',
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
    expect(mockLynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalledWith(
      templateUrl,
      true,
      expect.any(Object),
    );
  });

  test('should keep encoded external bundle mode over runtime fallback', async () => {
    const templateUrl = 'http://example.com/template_encoded_mode_test';
    const encoded = encode({
      ...sampleTasm,
      pageConfig: {
        ...sampleTasm.pageConfig,
        isExternalBundle: 'true',
        isLazy: 'false',
      },
    });

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
      { isExternalBundle: 'false', isLazy: 'true' },
    );

    expect(mockLynxViewInstance.onPageConfigReady).toHaveBeenCalledWith(
      expect.objectContaining({
        isExternalBundle: 'true',
        isLazy: 'false',
      }),
    );
    expect(mockLynxViewInstance.onMTSScriptsLoaded).toHaveBeenCalledWith(
      templateUrl,
      false,
      expect.any(Object),
    );
    expect(mockLynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalledWith(
      templateUrl,
      true,
      expect.any(Object),
    );
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
      { isExternalBundle: 'true' },
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
    expect(mockLynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalledWith(
      templateUrl,
      true,
      expect.any(Object),
    );
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
  /**
   * The markup path, end to end through the worker.
   *
   * A markup card is decoded in the worker like any other artifact, and it is
   * reached the way the worker reaches everything else: `handleStream` reads the
   * 8 byte header, dispatches JSON on `{` and a bundle on the magic header, and
   * what is left over is a markup card. It is the only artifact that cannot be
   * streamed - the XML parser has no incremental mode - so it is the one that
   * waits for the whole response, and putting it last is what keeps the two that
   * do stream from paying for it.
   *
   * The conversion happens in a lazily loaded chunk and emits the ordinary
   * `Configurations` / `StyleInfo` / `LepusCode` / `Manifest` sections. The main
   * thread has no markup branch at all, so what these assert is precisely that -
   * a markup card arrives through the same section handler, and completes through
   * the same `done`, as a built card.
   */
  describe('markup cards', () => {
    const markupSource = [
      '<!doctype lynx>',
      '<lynx engine-version="4.2">',
      // The viewport and root-relative units are load bearing, not decoration:
      // they are what makes `transformVW` / `transformVH` / `transformREM`
      // observable in the decoded bytes. Without them those flags are no-ops and
      // any test comparing two loads would agree however they were propagated.
      '<style>.a{color:red;display:linear;width:10vw;height:20vh;font-size:2rem}</style>',
      '<script thread="main">globalThis.__mts = 1;</script>',
      '<script thread="background">globalThis.__bts = 1;</script>',
      '</lynx>',
    ].join('\n');
    const mainOnlyMarkupSource = markupSource.replace(
      '<script thread="background">globalThis.__bts = 1;</script>\n',
      '',
    );

    function serveBytes(bytes: Uint8Array, chunkSize = bytes.length) {
      const stream = new ReadableStream({
        start(controller) {
          for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            controller.enqueue(bytes.slice(offset, offset + chunkSize));
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
    }

    function serveText(text: string, chunkSize?: number) {
      const bytes = new TextEncoder().encode(text);
      serveBytes(bytes, chunkSize ?? bytes.length);
    }

    function load(url: string, transforms = false) {
      return templateManager.fetchBundle(
        url,
        Promise.resolve(mockLynxViewInstance),
        transforms,
        transforms,
        transforms,
      );
    }

    test('loads a markup card and resolves the load', async () => {
      const url = 'http://example.com/card.xml';
      serveText(markupSource);

      await load(url);

      const bundle = templateManager.getBundle(url);
      expect(bundle).toBeDefined();
      // The engine hard-codes a markup bundle's config, so these are the values
      // a native XML bundle would carry too.
      expect(bundle!.config).toMatchObject({
        cardType: 'react',
        isLazy: 'false',
        enableCSSSelector: 'true',
      });
      expect(bundle!.styleSheet).toBeDefined();
      expect(Object.keys(bundle!.lepusCode ?? {})).toStrictEqual(['root']);
      expect(Object.keys(bundle!.backgroundCode ?? {})).toStrictEqual([
        '/app-service.js',
      ]);

      // Same callbacks, same order, as a bundle card.
      expect(mockLynxViewInstance.onPageConfigReady).toHaveBeenCalled();
      expect(mockLynxViewInstance.onStyleInfoReady).toHaveBeenCalledWith(
        url,
        expect.any(Object),
      );
      expect(mockLynxViewInstance.onMTSScriptsLoaded).toHaveBeenCalledWith(
        url,
        false,
        expect.any(Object),
      );
      expect(mockLynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalledWith(
        url,
        false,
        expect.any(Object),
      );
    });

    test('registers an empty app-service entry for a main-only card', async () => {
      const url = 'http://example.com/main-only.xml';
      serveText(mainOnlyMarkupSource);

      await load(url);

      const bundle = templateManager.getBundle(url);
      expect(Object.keys(bundle?.backgroundCode ?? {})).toStrictEqual([
        '/app-service.js',
      ]);
      expect(mockLynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalledWith(
        url,
        false,
        expect.any(Object),
      );
    });

    /**
     * The whole claim of the markup path, end to end: a hand-written card is
     * compiled in the browser into the bundle a build would have produced, and
     * loading it is therefore the same act as loading that bundle.
     *
     * Asserted on what the worker actually posts, because that is the entire
     * interface between the two threads. The section *order* matters as much as
     * the payloads: a markup card is not adapted into the section sequence, it
     * produces the encoder's own sequence, because after compiling
     * `handleMarkup` hands the bytes back to `handleStream` and the ordinary
     * binary reader takes over. If it were reordered, adapted, or given the wrong
     * transform flags on the way through, these would diverge.
     *
     * The `StyleInfo` payload is copied out of the message before it is posted:
     * the worker transfers that `ArrayBuffer`, so reading it afterwards would
     * find it detached.
     */
    test('is indistinguishable from loading the bundle compiled from it', async () => {
      const compiled = encodeLynxXML(markupSource);
      expect(compiled.success).toBe(true);
      const bundleBytes = (compiled as { buffer: Uint8Array }).buffer;

      function recordSections() {
        const seen: { label: number; bytes?: number[] }[] = [];
        const original = globalThis.postMessage;
        const spy = rstest.spyOn(globalThis, 'postMessage')
          .mockImplementation(
            ((message: any, ...rest: any[]) => {
              if (message?.type === 'section') {
                seen.push({
                  label: message.label,
                  ...(message.data instanceof ArrayBuffer
                    ? { bytes: Array.from(new Uint8Array(message.data)) }
                    : {}),
                });
              }
              return (original as any).call(globalThis, message, ...rest);
            }) as any,
          );
        return { seen, restore: () => spy.mockRestore() };
      }

      async function sectionsOf(
        url: string,
        serve: () => void,
        transforms: boolean,
      ) {
        const recorder = recordSections();
        serve();
        await load(url, transforms);
        recorder.restore();
        return recorder.seen;
      }

      // Run under both flag settings. The card carries `vw`, `vh` and `rem`, so
      // the transforms genuinely move the decoded style bytes - which is what
      // makes this sensitive to the flags being carried into the recursive
      // `handleStream` call rather than defaulted or dropped along the way.
      for (const transforms of [false, true]) {
        const suffix = transforms ? 'transformed' : 'plain';
        const asMarkup = await sectionsOf(
          `http://example.com/twin-${suffix}.xml`,
          () => serveText(markupSource),
          transforms,
        );
        const asBundle = await sectionsOf(
          `http://example.com/twin-${suffix}.web.bundle`,
          () => serveBytes(bundleBytes),
          transforms,
        );

        // Control: the recording saw a whole load, so an equality between two
        // empty arrays cannot be what passes here.
        expect(asMarkup).toHaveLength(5);
        expect(asMarkup).toStrictEqual(asBundle);
      }

      // And the two flag settings really do produce different bytes, so the
      // equality above cannot be holding because the transforms did nothing.
      const plain = await sectionsOf(
        'http://example.com/twin-a.xml',
        () => serveText(markupSource),
        false,
      );
      const transformed = await sectionsOf(
        'http://example.com/twin-b.xml',
        () => serveText(markupSource),
        true,
      );
      expect(plain).not.toStrictEqual(transformed);
    });

    /**
     * The document is reassembled from the 8 header bytes `handleStream` already
     * consumed plus the remainder, so how the response was split has to make no
     * difference. One byte at a time is the worst case for that seam.
     */
    test('loads a card delivered one byte at a time', async () => {
      const url = 'http://example.com/card-drip.xml';
      serveText(markupSource, 1);

      await load(url);
      expect(templateManager.getBundle(url)?.styleSheet).toBeDefined();
    });

    /**
     * A BOM and leading whitespace are the author's, not the tool's, so however
     * much of it there is the card still loads.
     *
     * This used to have a limit. When the markup check ran ahead of
     * `handleStream` it only ever saw 8 bytes, so a `<` pushed past byte 8 by a
     * BOM plus a few blank lines was not recognised and the card was reported as
     * a corrupt binary. Reaching markup by elimination removes the window
     * entirely: the padding here is deliberately far longer than 8 bytes.
     */
    test('tolerates a BOM and any amount of leading whitespace', async () => {
      const url = 'http://example.com/card-bom.xml';
      serveText('\ufeff\n \t\n \t\n \t\n \t\n \t\n \t\n' + markupSource);

      await load(url);
      expect(templateManager.getBundle(url)?.styleSheet).toBeDefined();
    });

    /**
     * A document that is markup but wrong is reported by the XML parser, in the
     * parser's own words and with an offset.
     */
    test('rejects an unparsable card with the parser\'s own message', async () => {
      const url = 'http://example.com/card-broken.xml';
      serveText('<lynx engine-version="1">never closed');

      await expect(load(url)).rejects.toThrow(
        /invalid TemplateBundle XML at offset \d+:/,
      );
    });

    /**
     * The cost of making markup the fallback, paid off deliberately.
     *
     * A corrupted bundle no longer stops at `Invalid Magic Header`; it reaches
     * the markup path like anything else that is not a bundle and not JSON. Left
     * alone it would come back as
     * `expected '<lynx engine-version="...">' root element`,
     * which points whoever is reading it at a markup bug in a file that is not
     * markup. So the two are told apart before the parser is even loaded, on
     * whether the content begins a tag at all, and a corrupt bundle keeps the
     * diagnosis it always had.
     */
    describe('bytes that are no kind of Lynx artifact', () => {
      test('a corrupted bundle is reported as a bad header, not as bad XML', async () => {
        const url = 'http://example.com/corrupt.bundle';
        const encoded = encode(sampleTasm);
        // One flipped bit in the magic header, the cheapest real corruption.
        // 'S' of 'SDRAWROF' becomes 0xac.
        expect(encoded[0]).toBe(0x53);
        encoded[0] = encoded[0]! ^ 0xff;
        serveBytes(encoded);

        const error = await load(url).then(
          () => undefined,
          (thrown: Error) => thrown,
        );
        expect(error).toBeDefined();
        expect(error!.message).toContain('Invalid Magic Header');
        // Not the XML parser's answer: that is the confusing outcome this
        // guards against.
        expect(error!.message).not.toContain('TemplateBundle XML');
        // The bytes that failed to match, so the reader can see how close it
        // was - 'DRAWROF' is still legible after the corrupted first byte.
        expect(error!.message).toContain('ac 44 52 41 57 52 4f 46');
      });

      test('a non-text payload is reported the same way', async () => {
        const url = 'http://example.com/not-lynx.gz';
        // A gzip member: real enough that a misconfigured server could serve it.
        serveBytes(
          new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0x03]),
        );

        await expect(load(url)).rejects.toThrow(
          /Invalid Magic Header.*1f 8b 08 00 00 00 00 00/s,
        );
      });

      /**
       * The one input markup does *not* rescue, pinned because it is the
       * boundary of the fallback rather than an oversight.
       *
       * Markup is reached from the magic header check, which is downstream of
       * the eight byte header read, so a response too short to fill that header
       * never gets there and keeps the stream errors it always had. Making
       * markup work for a document shorter than eight bytes would mean moving
       * the read, and no useful card is that short.
       */
      test('a response too short for the header keeps the stream errors', async () => {
        serveText('<a>');
        await expect(load('http://example.com/tiny.xml')).rejects.toThrow(
          'Unexpected end of stream. Expected 8 bytes, got 3',
        );

        serveBytes(new Uint8Array(0));
        await expect(load('http://example.com/empty.xml')).rejects.toThrow(
          'Empty stream',
        );
      });
    });
  });
});
