import { describe, test, expect, vi, beforeEach } from 'vitest';
import { encode, type TasmJSONInfo } from '@encode/index.js';
import { fetchTemplate } from '@client/mainthread/fetchTemplate.js';
import { MagicHeader } from '@constants';
import { templateManager } from '@client/wasm.js';
import type { LynxViewInstance } from '@client/mainthread/LynxViewInstance.js';

// Mock wasm-feature-detect to ensure we load the standard WASM
vi.mock('wasm-feature-detect', () => ({
  referenceTypes: async () => true,
}));

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
    const magic = view.getBigUint64(0, true);
    expect(magic).toBe(BigInt(MagicHeader));
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
      body: stream,
    });

    await fetchTemplate(
      templateUrl,
      new AbortController().signal,
      mockLynxViewInstance,
    );

    // Verify data using getCustomSection
    const customSections = templateManager.getCustomSection(
      templateUrl,
    );
    expect(customSections).toEqual(sampleTasm.customSections);
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
      body: stream,
    });

    await expect(
      fetchTemplate(
        templateUrl,
        new AbortController().signal,
        mockLynxViewInstance,
      ),
    )
      .rejects.toThrow('Unsupported version: 2');

    // Verify template is removed
    expect(() => {
      templateManager.getCustomSection(templateUrl);
    }).toThrow();
  });

  test('should throw error for create same template twice', () => {
    const templateUrl = 'http://example.com/template_duplicate_url_test';
    templateManager.createTemplate(templateUrl);
    expect(() => {
      templateManager.createTemplate(templateUrl);
    }).toThrow();
  });

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
      body: stream,
    });

    await fetchTemplate(
      'http://example.com/template',
      new AbortController().signal,
      mockLynxViewInstance,
    );

    // Verify data using getCustomSection
    const customSections = templateManager.getCustomSection(
      'http://example.com/template',
    );
    expect(customSections).toEqual(sampleTasm.customSections);
  });

  test('should remove template correctly', () => {
    const templateUrl = 'http://example.com/template_to_remove';
    templateManager.createTemplate(templateUrl);

    // Manually set a custom section to verify existence
    templateManager.setCustomSection(templateUrl, { test: 'data' });
    expect(templateManager.getCustomSection(templateUrl)).toEqual({
      test: 'data',
    });

    templateManager.removeTemplate(templateUrl);

    expect(() => {
      templateManager.getCustomSection(templateUrl);
    }).toThrow('Template not found');
  });

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
      body: stream,
    });

    await expect(
      fetchTemplate(
        templateUrl,
        new AbortController().signal,
        mockLynxViewInstance,
      ),
    ).rejects.toThrow('Stream failed');

    expect(() => {
      templateManager.getCustomSection(templateUrl);
    }).toThrow('Template not found');
  });
});
