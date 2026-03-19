import './jsdom.js';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { encode, type TasmJSONInfo } from '../ts/encode/index.js';
import { MagicHeader0, MagicHeader1 } from '../ts/constants.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';

// Import the worker script to execute it and register the handler
await import('../ts/client/decodeWorker/decode.worker.js');
// -------------------------------------

// Mock wasm-feature-detect to ensure we load the standard WASM
vi.mock('wasm-feature-detect', () => ({
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
  onPageConfigReady: vi.fn(),
  onStyleInfoReady: vi.fn(),
  onMTSScriptsLoaded: vi.fn(),
  onBTSScriptsLoaded: vi.fn(),
  backgroundThread: vi.mockObject({
    markTiming: vi.fn(),
  }),
} as unknown as LynxViewInstance;

describe('Template Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
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
    );

    // Verify data using getCustomSection
    const customSections = templateManager.getTemplate(templateUrl)
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
      ),
    )
      .rejects.toThrow('Unsupported version: 2');

    // Verify template is removed
    expect(templateManager.getTemplate(templateUrl)?.customSections)
      .toBeUndefined();
  });

  /*
  test('should throw error for create same template twice', () => {
    const templateUrl = 'http://example.com/template_duplicate_url_test';
    templateManager.createTemplate(templateUrl);
    expect(() => {
      templateManager.createTemplate(templateUrl);
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
    );

    // Verify data using getCustomSection
    const customSections = templateManager.getTemplate(
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
    templateManager.createTemplate(templateUrl);

    // Manually set a custom section to verify existence
    templateManager.setCustomSection(templateUrl, { test: 'data' });
    expect(templateManager.getTemplate(templateUrl)?.customSections).toEqual({
      test: 'data',
    });

    templateManager.removeTemplate(templateUrl);

    expect(templateManager.getTemplate(templateUrl)?.customSections)
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
      ),
    ).rejects.toThrow('Stream failed');

    expect(templateManager.getTemplate(templateUrl)?.customSections)
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
    // The worker sends section: LepusCode with a blob URL map.
    // TemplateManager handles this but doesn't expose the blob map directly easily in tests unless we mock the handler side effect or inspect mockLynxViewInstance.
    // TemplateManager calls lynxViewInstance.onMTSScriptsLoaded(url, data).
    expect(mockLynxViewInstance.onMTSScriptsLoaded).toHaveBeenCalled();
  });
});
