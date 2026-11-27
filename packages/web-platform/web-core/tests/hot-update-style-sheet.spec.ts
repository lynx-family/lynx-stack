import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';

import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../ts/constants.js';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import {
  createStyleSheetResourceFromBundle,
  readBundleSection,
} from '../ts/client/mainthread/hotUpdateStyleSheet.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { encode } from '../ts/encode/webEncoder.js';
import { createTestLynxViewInstance } from './createTestLynxViewInstance.js';

/** A CSS hot update bundle, as `@lynx-js/css-extract-webpack-plugin` emits it. */
function hotUpdateBundle(backgroundColor: string): Uint8Array {
  return encode(
    {
      styleInfo: {
        '0': [
          {
            type: 'StyleRule',
            selectorText: { value: '.test' },
            style: [{ name: 'background-color', value: backgroundColor }],
            variables: {},
          },
        ],
      },
      manifest: {},
      cardType: 'react',
      appType: 'card',
      pageConfig: {},
      lepusCode: {},
      customSections: {},
      elementTemplates: {},
    } as unknown as Parameters<typeof encode>[0],
  );
}

describe('CSS hot update style sheets', () => {
  test('readBundleSection finds a section of an encoded web bundle', () => {
    const bundle = hotUpdateBundle('red');
    expect(
      readBundleSection(bundle, TemplateSectionLabel.StyleInfo)?.byteLength,
    ).toBeGreaterThan(0);
    expect(readBundleSection(bundle, 99)).toBeUndefined();
    expect(() =>
      readBundleSection(new Uint8Array(16), TemplateSectionLabel.StyleInfo)
    ).toThrow('Not an encoded web bundle');
  });

  test('readBundleSection rejects a section longer than the bundle', () => {
    const bundle = new Uint8Array(12 + 8 + 4);
    const view = new DataView(bundle.buffer);
    view.setUint32(0, MagicHeader0, true);
    view.setUint32(4, MagicHeader1, true);
    view.setUint32(8, 1, true);
    view.setUint32(12, TemplateSectionLabel.StyleInfo, true);
    // The section claims 10 bytes; 4 are left.
    view.setUint32(16, 10, true);
    // Whether it is the section asked for or one to skip.
    for (const label of [TemplateSectionLabel.StyleInfo, 99]) {
      expect(() => readBundleSection(bundle, label)).toThrow(
        'Unexpected EOF reading section content. Expected 10 bytes.',
      );
    }
  });

  test('createStyleSheetResourceFromBundle decodes the bundle\'s StyleInfo', () => {
    const rootDom = (document.createElement('div') as HTMLElement)
      .attachShadow({ mode: 'open' });
    const binding = new WASMJSBinding(createTestLynxViewInstance(rootDom));
    createElementAPI(rootDom, binding, true, true, true);

    const resource = createStyleSheetResourceFromBundle(
      Buffer.from(hotUpdateBundle('blue')).toString('base64'),
      undefined,
      true,
      false,
      false,
      false,
      false,
    )!;
    binding.wasmContext!.replace_style_sheet(resource, undefined);
    resource.free();

    const text = Array.from(
      rootDom.querySelectorAll('style'),
      style => style.textContent ?? '',
    ).join('\n');
    expect(text).toContain('.test');
    expect(text).toContain('background-color:blue');
  });

  test('lynx.getDevtool().replaceStyleSheetByIdWithBase64 replaces the entry', () => {
    // `createMainThreadGlobalAPIs` captures these, and jsdom has neither.
    rstest.stubGlobal('requestAnimationFrame', rstest.fn());
    rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
    const lynxViewInstance = {
      templateUrl: 'app.web.bundle',
      globalprops: {},
      systemInfo: {},
      backgroundThread: {
        markTiming: rstest.fn(),
        jsContext: { dispatchEvent: rstest.fn() },
      },
      i18nManager: { _I18nResourceTranslation: rstest.fn() },
      replaceStyleSheetWithBase64: rstest.fn(),
    } as unknown as LynxViewInstance;
    const { lynx } = createMainThreadGlobalAPIs(lynxViewInstance);

    lynx.getDevtool().replaceStyleSheetByIdWithBase64(1, 'bundle', '__Card__');

    expect(lynxViewInstance.replaceStyleSheetWithBase64).toHaveBeenCalledWith(
      'bundle',
      '__Card__',
    );
  });
});
