import { test, expect, describe } from 'vitest';
// @ts-expect-error
import { genTemplate } from '../server.js';

describe('server-tests', () => {
  for (
    const testName of [
      'basic-performance-div-10',
      'basic-performance-nest-level-100',
    ]
  ) {
    test(testName, async () => {
      const html = await genTemplate(testName);
      expect(html).toMatchSnapshot();
    });
  }
});
