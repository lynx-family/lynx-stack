import { bench, expect, describe } from 'vitest';
// @ts-expect-error
import { SSR, loadTemplate } from '../server.js';

const cases = {
  'basic-performance-div-10000': await loadTemplate(
    'basic-performance-div-10000',
  ),
  'basic-performance-div-1000': await loadTemplate(
    'basic-performance-div-1000',
  ),
  'basic-performance-div-100': await loadTemplate('basic-performance-div-100'),
  'basic-performance-div-10': await loadTemplate('basic-performance-div-10'),
  'basic-performance-nest-level-100': await loadTemplate(
    'basic-performance-nest-level-100',
  ),
  'basic-performance-image-100': await loadTemplate(
    'basic-performance-image-100',
  ),
  'basic-performance-scroll-view-100': await loadTemplate(
    'basic-performance-scroll-view-100',
  ),
  'basic-performance-text-200': await loadTemplate(
    'basic-performance-text-200',
  ),
};
describe('server-tests', async () => {
  for (const [testName, rawTemplate] of Object.entries(cases)) {
    bench(testName, async () => {
      const html = await SSR(rawTemplate, testName);
    });
  }
});
