import './jsdom.js';
import { describe, test, expect, beforeEach, beforeAll, vi } from 'vitest';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import { templateManager } from '../ts/client/mainthread/TemplateManager.js';
import { ElementTemplateSection, wasmInstance } from '../ts/client/wasm.js';
import { encodeElementTemplates } from '../ts/encode/encodeElementTemplate.js';

describe('Lazy Load Web Elements', () => {
  let lynxViewDom: HTMLElement;
  let rootDom: ShadowRoot;
  let mtsGlobalThis: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;
  let loadUnknownElementSpy: any;
  let loadWebElementSpy: any;

  beforeAll(() => {
    templateManager.createTemplate('test-lazy-load');
    const encoded = encodeElementTemplates({
      'lazy-load-template': {
        'type': 'custom-element',
        'attributes': {},
        'builtinAttributes': {},
        'children': [],
        'events': [],
      },
      'normal-template': {
        'type': 'view',
        'attributes': {},
        'builtinAttributes': {},
        'children': [],
        'events': [],
      },
      'list-template': {
        'type': 'list',
        'attributes': {},
        'builtinAttributes': {},
        'children': [],
        'events': [],
      },
    });
    const section = wasmInstance.ElementTemplateSection.from_encoded(encoded);
    templateManager.setElementTemplateSection(
      'test-lazy-load',
      section,
    );
  });

  beforeEach(() => {
    vi.resetAllMocks();
    lynxViewDom = document.createElement('div') as unknown as HTMLElement;
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });

    loadUnknownElementSpy = vi.fn();
    loadWebElementSpy = vi.fn();

    mtsBinding = new WASMJSBinding(
      vi.mockObject({
        rootDom,
        backgroundThread: vi.mockObject({
          publicComponentEvent: vi.fn(),
          publishEvent: vi.fn(),
          postTimingFlags: vi.fn(),
        } as any),
        exposureServices: vi.mockObject({
          updateExposureStatus: vi.fn(),
        }) as any,
        loadWebElement: loadWebElementSpy,
        loadUnknownElement: loadUnknownElementSpy,
        mainThreadGlobalThis: {} as any,
      }),
    );
    mtsGlobalThis = createElementAPI(
      'test-lazy-load',
      rootDom,
      mtsBinding,
      true,
      true,
      true,
    );
  });

  test('should trigger loadUnknownElement for unknown tags', () => {
    const element = mtsGlobalThis.__ElementFromBinary('lazy-load-template', 0);
    expect(loadUnknownElementSpy).toHaveBeenCalledWith('custom-element');
    expect(element.tagName.toLowerCase()).toBe('custom-element');
  });

  test('should trigger loadWebElement for dynamic load tags (list)', () => {
    const element = mtsGlobalThis.__ElementFromBinary('list-template', 0);
    expect(loadWebElementSpy).toHaveBeenCalledWith(0); // list -> 0
    expect(loadUnknownElementSpy).not.toHaveBeenCalled();
    expect(element.tagName.toLowerCase()).toBe('x-list');
  });
});
