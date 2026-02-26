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
    const page = await lynx.newPage();

    await page.goto(
      'https://lynxjs.org/next/lynx-examples/hello-world/dist/main.lynx.bundle',
    );

    const content = await page.content();
    expect(content).toContain('have fun');

    const rootElement = await page.locator('view');
    expect(rootElement).toBeDefined();

    if (rootElement) {
      const styles = await rootElement.computedStyleMap();
      expect(styles.size).toBeGreaterThan(0);

      // Perform a tap action to verify the method executes successfully
      await expect(rootElement.tap()).resolves.toBeUndefined();
    }
  }, 30000); // Increase timeout to 30s as connecting/launching emulator app can be slow
});
