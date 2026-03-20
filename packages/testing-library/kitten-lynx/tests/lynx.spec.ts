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
  });

  afterAll(async () => {
    await lynx?.close();
  });

  it('can navigate to a page and read the DOM', async () => {
    const page = await lynx.newPage();

    await page.goto('http://127.0.0.1:3001/react-example.lynx.bundle', {
      timeout: 15000,
    });

    const content = await page.content();
    expect(content).toContain('have fun');

    const rootElement = await page.locator('view');
    expect(rootElement).toBeDefined();

    if (rootElement) {
      const styles = await rootElement.computedStyleMap();
      expect(styles.size).toBeGreaterThan(0);
    }
  }, 90000); // Increase timeout to 90s as connecting/launching emulator app can be slow
});
