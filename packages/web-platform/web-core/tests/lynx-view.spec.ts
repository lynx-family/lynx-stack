// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import { JSDOM } from 'jsdom';
import type { LynxViewElement } from '../ts/client/mainthread/LynxView.js';

// Property upgrades do not require a template, worker, or WASM runtime.
rstest.mock('../ts/client/mainthread/TemplateManager.js', () => ({
  templateManager: {},
}));
rstest.mock('../ts/client/mainthread/LynxViewInstance.js', () => ({
  LynxViewInstance: class {},
}));

const { window } = new JSDOM(undefined, { url: 'http://localhost/' });
const { document, customElements } = window;
let LynxView: typeof LynxViewElement;

beforeAll(async () => {
  rstest.stubGlobal('document', document);
  rstest.stubGlobal('HTMLElement', window.HTMLElement);
  rstest.stubGlobal('customElements', customElements);
  ({ LynxViewElement: LynxView } = await import(
    '../ts/client/mainthread/LynxView.js'
  ));
});

afterAll(() => {
  window.close();
  rstest.unstubAllGlobals();
});

describe('LynxView nativeModulesMap', () => {
  test.each([true, false])(
    'preserves properties assigned before upgrade (connected: %s)',
    (connected) => {
      const tag = `lynx-view-upgrade-${connected}`;
      const element = document.createElement(tag) as LynxViewElement;
      const modules = { MyModule: '/my-module.js' };
      element.nativeModulesMap = modules;
      if (connected) {
        document.body.appendChild(element);
      }

      class UpgradedLynxView extends LynxView {}
      customElements.define(tag, UpgradedLynxView);
      customElements.upgrade(element);

      expect(element).toBeInstanceOf(UpgradedLynxView);
      expect(element.nativeModulesMap).toBe(modules);

      document.body.appendChild(element);
      expect(element.nativeModulesMap).toBe(modules);
      element.remove();
    },
  );

  test('defaults to undefined when no modules were assigned', () => {
    const element = document.createElement('lynx-view') as LynxViewElement;
    expect(element.nativeModulesMap).toBeUndefined();
  });

  test('exposes the property for framework property detection', () => {
    const element = document.createElement('lynx-view') as LynxViewElement;
    expect('nativeModulesMap' in element).toBe(true);
  });

  test('allows assigning, replacing, and clearing modules after upgrade', () => {
    const element = document.createElement('lynx-view') as LynxViewElement;
    const initial = { MyModule: '/my-module.js' };
    const replacement = { OtherModule: '/other-module.js' };

    element.nativeModulesMap = initial;
    expect(element.nativeModulesMap).toBe(initial);
    element.nativeModulesMap = replacement;
    expect(element.nativeModulesMap).toBe(replacement);
    element.nativeModulesMap = undefined;
    expect(element.nativeModulesMap).toBeUndefined();
  });
});
