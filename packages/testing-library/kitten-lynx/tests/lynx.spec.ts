import { Lynx } from '../src/Lynx.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('kitten-lynx testing framework', () => {
  let lynx: Lynx;

  beforeAll(async () => {
    lynx = await Lynx.connect();
  });

  afterAll(async () => {
    await lynx?.close();
  });

  it('can navigate to a page and read the DOM', async () => {
    console.log('[test] creating new page...');
    const page = await lynx.newPage();
    console.log('[test] page created.');

    console.log('[test] navigating to hello-world bundle...');
    await page.goto(
      'https://lynxjs.org/next/lynx-examples/hello-world/dist/main.lynx.bundle',
    );
    console.log('[test] navigation complete.');

    console.log('[test] getting page content...');
    const content = await page.content();
    console.log(`[test] page content received, length: ${content.length}`);
    expect(content).toContain('have fun');

    console.log('[test] locator view...');
    const rootElement = await page.locator('view');
    expect(rootElement).toBeDefined();

    if (rootElement) {
      console.log('[test] getting computed styles...');
      const styles = await rootElement.computedStyleMap();
      expect(styles.size).toBeGreaterThan(0);

      // Perform a tap action to verify the method executes successfully
      console.log('[test] tapping root element...');
      await expect(rootElement.tap()).resolves.toBeUndefined();
    }
    console.log('[test] finished successfully');
  }, 90000); // Increase timeout to 90s as connecting/launching emulator app can be slow
});
