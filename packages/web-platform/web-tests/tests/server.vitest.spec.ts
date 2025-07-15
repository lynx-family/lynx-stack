import { test, expect, describe } from 'vitest';
// @ts-expect-error
import { genTemplate } from '../server.js';

describe('server-tests', () => {
  for (
    const testName of [
      'basic-performance-div-10',
      'basic-performance-nest-level-100',
      'basic-performance-event-div-100',
    ]
  ) {
    test(testName, async () => {
      const html = await genTemplate(testName);
      expect(html).toMatchSnapshot();
    });
  }

  test('config-css-selector-false-exchange-class', async () => {
    const html = await genTemplate('config-css-selector-false-exchange-class');
    expect(html).toContain('[l-uid="2"]');
  });

  test('basic-bindtap-contains-bind-event', async () => {
    const html = await genTemplate('basic-bindtap');
    expect(html).toContain('bindEvent');
  });
});
