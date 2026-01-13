import './jsdom.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';

describe('Testing Library Port', () => {
  let lynxViewDom: HTMLElement;
  let rootDom: ShadowRoot;
  let mtsGlobalThis: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;
  const mockedBackground = vi.mockObject({
    publishEvent: vi.fn(),
    postTimingFlags: vi.fn(),
  });
  beforeEach(() => {
    vi.resetAllMocks();
    lynxViewDom = document.createElement('div') as unknown as HTMLElement;
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });

    mtsBinding = new WASMJSBinding(
      vi.mockObject({
        rootDom,
        backgroundThread: vi.mockObject({
          publicComponentEvent: vi.fn(),
          publishEvent: vi.fn(),
          postTimingFlags: vi.fn(),
          markTiming: vi.fn(),
          flushTimingInfo: vi.fn(),
          jsContext: vi.mockObject({
            dispatchEvent: vi.fn(),
          }),
        } as any),
        exposureServices: vi.mockObject({
          updateExposureStatus: vi.fn(),
        } as any),
        loadWebElement: vi.fn(),
        loadUnknownElement: vi.fn(),
        mainThreadGlobalThis: globalThis as any,
      }),
    );
    mtsGlobalThis = createElementAPI(
      'test',
      rootDom,
      mtsBinding as any,
      true,
      true,
      true,
    );
  });

  // Helper to simulate elementTree.root.querySelector
  const querySelector = (selector: string) => rootDom.querySelector(selector);

  describe('basic.test.js', () => {
    test('should create page and view', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);

      const view0 = mtsGlobalThis.__CreateView(0);
      expect(mtsGlobalThis.__GetTag(view0)).toBe('view');

      mtsGlobalThis.__AppendElement(page, view0);
      mtsGlobalThis.__FlushElementTree();

      // Verify view is in DOM
      const el = rootDom.querySelector('x-view');
      expect(el).not.toBeNull();
      expect(el?.tagName.toLowerCase()).toBe('x-view');
    });

    test('should add dataset to view', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const view0 = mtsGlobalThis.__CreateView(0);
      mtsGlobalThis.__AppendElement(page, view0);

      mtsGlobalThis.__AddDataset(view0, 'testid', 'view-element');
      mtsGlobalThis.__FlushElementTree();

      const el = rootDom.querySelector('[data-testid="view-element"]');
      expect(el).not.toBeNull();
      expect(el?.tagName.toLowerCase()).toBe('x-view');
      expect(mtsGlobalThis.__GetTag(view0)).toBe('view');
    });

    test('should create and append svg element', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const view1 = mtsGlobalThis.__CreateElement('svg', 0);
      mtsGlobalThis.__AddDataset(view1, 'testid', 'svg-element');
      mtsGlobalThis.__AppendElement(page, view1);
      mtsGlobalThis.__FlushElementTree();

      const el = rootDom.querySelector('[data-testid="svg-element"]');
      expect(el).not.toBeNull();
      expect(el?.tagName.toLowerCase()).toBe('x-svg');
      expect(mtsGlobalThis.__GetTag(view1)).toBe('svg');
    });

    test('should create and append custom element', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const element0 = mtsGlobalThis.__CreateElement('custom-element', 0);
      mtsGlobalThis.__AddDataset(element0, 'testid', 'custom-element');
      mtsGlobalThis.__AppendElement(page, element0);
      mtsGlobalThis.__FlushElementTree();

      const el = rootDom.querySelector('[data-testid="custom-element"]');
      expect(el).not.toBeNull();
      expect(el?.tagName.toLowerCase()).toBe('custom-element');
      expect(mtsGlobalThis.__GetTag(element0)).toBe('custom-element');
    });

    test('should create and append text with raw text', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const view0 = mtsGlobalThis.__CreateView(0);
      mtsGlobalThis.__AppendElement(page, view0);

      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('Text Element');

      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__AppendElement(view0, text0);
      mtsGlobalThis.__FlushElementTree();

      const textElement = rootDom.querySelector('x-text');
      expect(textElement).not.toBeNull();
      expect(mtsGlobalThis.__GetTag(text0)).toBe('text');

      const rawText = textElement?.querySelector('raw-text');
      expect(rawText?.getAttribute('text')).toBe('Text Element');
    });

    test('should handle detached elements', () => {
      const detachedElement = mtsGlobalThis.__CreateElement(
        'custom-element',
        0,
      );
      expect(detachedElement).not.toBeNull();
      expect(mtsGlobalThis.__GetTag(detachedElement)).toBe('custom-element');

      // Should not be in DOM
      expect(rootDom.querySelectorAll('custom-element').length).toBe(0);
    });

    test('should add event listener', () => {
      // Spy on mtsBinding methods
      vi.spyOn(mtsBinding, 'addEventListener');
      vi.spyOn(mtsBinding, 'publishEvent');

      const page = mtsGlobalThis.__CreatePage('0', 0);
      const view0 = mtsGlobalThis.__CreateView(0);
      mtsGlobalThis.__AppendElement(page, view0);

      // Add event listener
      mtsGlobalThis.__AddEvent(view0, 'bindEvent', 'tap', '2:0:bindtap');
      mtsGlobalThis.__FlushElementTree();

      const viewElement = rootDom.querySelector('x-view');
      expect(viewElement).not.toBeNull();

      // Dispatch event
      viewElement?.dispatchEvent(new window.Event('click'));

      // Verify spies
      expect(mtsBinding.addEventListener).toBeCalledWith('tap');

      expect(mtsBinding.publishEvent).toBeCalled();
    });

    test('text should work with SetAttribute', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('raw-text');

      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__SetAttribute(rawText0, 'text', 'Hello World');

      mtsGlobalThis.__AppendElement(page, text0);
      mtsGlobalThis.__FlushElementTree();

      const textElement = rootDom.querySelector('x-text');
      expect(textElement).not.toBeNull();

      const rawText = textElement?.querySelector('raw-text');
      expect(rawText?.getAttribute('text')).toBe('Hello World');
    });

    test('should handle empty text content', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const text0 = mtsGlobalThis.__CreateText(0);
      mtsGlobalThis.__AppendElement(page, text0);
      mtsGlobalThis.__FlushElementTree();

      const textElement = rootDom.querySelector('x-text');
      expect(textElement).not.toBeNull();
      expect(textElement?.children.length).toBe(0);
      expect(textElement?.textContent).toBe('');
    });

    test('should be case sensitive', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('Sensitive text');
      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__AppendElement(page, text0);
      mtsGlobalThis.__FlushElementTree();

      const textElement = rootDom.querySelector('x-text');
      const rawText = textElement?.querySelector('raw-text');
      expect(rawText?.getAttribute('text')).toBe('Sensitive text');
      expect(rawText?.getAttribute('text')).not.toBe('sensitive text');
    });
  });

  describe('element-papi.test.js', () => {
    test('__RemoveElement should work', () => {
      const view = mtsGlobalThis.__CreateView(0);
      const childViews: any[] = [];
      for (let i = 0; i < 6; i++) {
        const child = mtsGlobalThis.__CreateView(0);
        mtsGlobalThis.__AppendElement(view, child);
        mtsGlobalThis.__SetID(child, `child-${i}`);
        childViews.push(child);
      }

      // We need to append view to a page to flush it to DOM?
      // Or just flush?
      // If view is not in rootDom, flush might not update rootDom, but the elements themselves might update.
      // But we want to check structure.
      const page = mtsGlobalThis.__CreatePage('0', 0);
      mtsGlobalThis.__AppendElement(page, view);
      mtsGlobalThis.__FlushElementTree();

      expect(rootDom.querySelectorAll('x-view[id^="child-"]').length).toBe(6);

      mtsGlobalThis.__RemoveElement(view, childViews[0]);
      mtsGlobalThis.__RemoveElement(view, childViews[4]);
      mtsGlobalThis.__FlushElementTree();

      expect(rootDom.querySelectorAll('x-view[id^="child-"]').length).toBe(4);
      expect(rootDom.querySelector('#child-0')).toBeNull();
      expect(rootDom.querySelector('#child-4')).toBeNull();
      expect(rootDom.querySelector('#child-1')).not.toBeNull();
    });
  });

  describe('to-have-text-content.test.js', () => {
    test('handles positive test cases', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('2');
      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__AppendElement(page, text0);
      mtsGlobalThis.__AddDataset(text0, 'testid', 'count-value');
      mtsGlobalThis.__FlushElementTree();

      const el = rootDom.querySelector('[data-testid="count-value"]');
      expect(el).not.toBeNull();
      // expect(el?.textContent).toBe('2');
      const rawText = el?.querySelector('raw-text');
      expect(rawText?.getAttribute('text')).toBe('2');
    });

    test('normalizes whitespace (attribute check)', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('  Step 1 of 4');
      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__AppendElement(page, text0);
      mtsGlobalThis.__FlushElementTree();

      const textElement = rootDom.querySelector('x-text');
      const rawText = textElement?.querySelector('raw-text');
      // Attributes preserve whitespace
      expect(rawText?.getAttribute('text')).toBe('  Step 1 of 4');
    });

    test('can handle multiple levels', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('Step 1 of 4');
      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__AppendElement(page, text0);
      mtsGlobalThis.__SetID(text0, 'parent');
      mtsGlobalThis.__FlushElementTree();

      const parent = rootDom.querySelector('#parent');
      const rawText = parent?.querySelector('raw-text');
      expect(rawText?.getAttribute('text')).toBe('Step 1 of 4');
    });

    test('can handle multiple levels with content spread across descendants', () => {
      const page = mtsGlobalThis.__CreatePage('0', 0);
      const view = mtsGlobalThis.__CreateView(0);
      const text0 = mtsGlobalThis.__CreateText(0);
      const rawText0 = mtsGlobalThis.__CreateRawText('Step');
      const text1 = mtsGlobalThis.__CreateText(0);
      const rawText1 = mtsGlobalThis.__CreateRawText('1');

      mtsGlobalThis.__AppendElement(text0, rawText0);
      mtsGlobalThis.__AppendElement(text1, rawText1);
      mtsGlobalThis.__AppendElement(view, text0);
      mtsGlobalThis.__AppendElement(view, text1);
      mtsGlobalThis.__AppendElement(page, view);
      mtsGlobalThis.__SetID(view, 'parent');
      mtsGlobalThis.__FlushElementTree();

      const parent = rootDom.querySelector('#parent');
      const rawTexts = parent?.querySelectorAll('raw-text');
      expect(rawTexts?.length).toBe(2);
      expect(rawTexts?.[0]!.getAttribute('text')).toBe('Step');
      expect(rawTexts?.[1]!.getAttribute('text')).toBe('1');
    });
  });
});
