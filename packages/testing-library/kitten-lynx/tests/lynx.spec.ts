import { Lynx } from '../src/Lynx.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.dirname(__dirname);

import { AdbServerClient, type Adb } from '@yume-chan/adb';
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp';
import { execa } from 'execa';
import type { KittenLynxView } from '../src/KittenLynxView.js';
execa({
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
  cwd,
  stdio: 'inherit',
  shell: true,
  cleanup: true,
})`pnpm serve`;
// Using Rspeedy Node API resolving instead of child_process

describe('kitten-lynx testing framework', () => {
  let lynx: Lynx;
  let adb: Adb;
  let page: KittenLynxView;

  beforeAll(async () => {
    // Use ADB port forwarding
    const client = new AdbServerClient(
      new AdbServerNodeTcpConnector({ port: 5037 }),
    );
    const devices = await client.getDevices();
    if (devices.length === 0) {
      throw new Error(`no device connected`);
    }
    for (const device of devices) {
      adb = await client.createAdb({ serial: device.serial });
      await adb.reverse.addExternal(`tcp:3001`, `tcp:3001`);
      await adb.close();
    }

    lynx = await Lynx.connect();

    page = await lynx.newPage();
    await page.goto('http://127.0.0.1:3001/react-example.lynx.bundle', {
      timeout: 15000,
    });
  }, 90000);

  afterAll(async () => {
    await lynx?.close();
  });

  it('can navigate to a page and read the DOM', async () => {
    const content = await page.content();
    expect(content).toContain('have fun');
  });

  it('can get attributes from an element', async () => {
    const titleElement = await page.locator('.Title');
    expect(titleElement).toBeDefined();

    if (titleElement) {
      const classAttr = await titleElement.getAttribute('class');
      expect(classAttr).toBe('Title');

      const textAttr = await titleElement.getAttribute('text');
      expect(textAttr).toBe('React');
    }
  });

  it('can fetch computed style map of an element', async () => {
    const titleElement = await page.locator('.Title');
    expect(titleElement).toBeDefined();

    if (titleElement) {
      const styles = await titleElement.computedStyleMap();
      expect(styles.size).toBeGreaterThan(0);
      expect(styles.has('display')).toBe(true);
    }
  });

  it('can click', async () => {
    const logoParent = await page.locator('.Logo');
    expect(await page.locator('.Logo--lynx')).toBeDefined();
    await logoParent?.tap();
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(await page.locator('.Logo--react')).toBeDefined();
    expect(await page.locator('.Logo--lynx')).toBeUndefined();
    await logoParent?.tap();
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(await page.locator('.Logo--react')).toBeUndefined();
    expect(await page.locator('.Logo--lynx')).toBeDefined();
  });

  it('can take a screenshot', async () => {
    const fs = await import('node:fs/promises');
    const screenshotPath = path.join(__dirname, 'test-screenshot.png');

    // Clean up before test just in case
    await fs.rm(screenshotPath, { force: true });

    const buffer = await page.screenshot({ path: screenshotPath });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Check if file was created
    const stats = await fs.stat(screenshotPath);
    expect(stats.size).toBeGreaterThan(0);

    // Clean up after test
    await fs.rm(screenshotPath, { force: true });
  });
});
