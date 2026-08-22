import './jsdom.js';
import { describe, expect, test } from '@rstest/core';

import { loadDynamicWebElement } from '../ts/client/webElementsDynamicLoader.js';

describe('web elements dynamic loader', () => {
  test('loads and registers animax-view only when requested', async () => {
    expect(customElements.get('animax-view')).toBeUndefined();

    const firstLoad = loadDynamicWebElement('animax-view');
    const concurrentLoad = loadDynamicWebElement('animax-view');

    expect(firstLoad).toBeDefined();
    expect(concurrentLoad).toBe(firstLoad);
    await firstLoad;
    expect(customElements.get('animax-view')).toBeDefined();
  });

  test('ignores elements without a built-in dynamic loader', () => {
    expect(loadDynamicWebElement('third-party-view')).toBeUndefined();
  });
});
