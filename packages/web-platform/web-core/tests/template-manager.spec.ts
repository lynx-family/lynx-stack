import './jsdom.js';
import { describe, test, expect, rstest, beforeEach } from '@rstest/core';
import {
  encode,
  encodeLynxXML,
  type TasmJSONInfo,
} from '../ts/encode/index.js';
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
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE lynx>',
      '<lynx version="5.4.2">',
      // The viewport and root-relative units are load bearing, not decoration:
      // they are what makes `transformVW` / `transformVH` / `transformREM`
      // observable in the decoded bytes. Without them those flags are no-ops and
      // any test comparing two loads would agree however they were propagated.
      '<style><![CDATA[.a{color:red;display:linear;width:10vw;height:20vh;font-size:2rem}]]></style>',
      '<script main-thread="true"><![CDATA[globalThis.__mts = 1;]]></script>',
      '<script background="true"><![CDATA[globalThis.__bts = 1;]]></script>',
      '</lynx>',
    ].join('\n');

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
      expect(mockLynxViewInstance.onStyleInfoReady).toHaveBeenCalledWith(url);
      expect(mockLynxViewInstance.onMTSScriptsLoaded).toHaveBeenCalledWith(
        url,
        false,
      );
      expect(mockLynxViewInstance.onBTSScriptsLoaded).toHaveBeenCalledWith(url);
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
      serveText('<lynx version="1">never closed');

      await expect(load(url)).rejects.toThrow(
        /invalid TemplateBundle XML at offset \d+:/,
      );
    });

    /**
     * The cost of making markup the fallback, paid off deliberately.
     *
     * A corrupted bundle no longer stops at `Invalid Magic Header`; it reaches
     * the markup path like anything else that is not a bundle and not JSON. Left
     * alone it would come back as `expected '<lynx version="...">' root element`,
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
