import { Lynx } from '../src/Lynx.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRspeedy, loadConfig } from '@lynx-js/rspeedy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { AdbServerClient } from '@yume-chan/adb';
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp';

// Using Rspeedy Node API resolving instead of child_process

describe('kitten-lynx testing framework', () => {
  let lynx: Lynx;
  let devServer: any;
  let adb: any;
  let bundleUrl: string;
  let devPort: number;

  beforeAll(async () => {
    const cwd = path.resolve(__dirname, '../test-fixture');
    const { content } = await loadConfig({ cwd });
    content.server = content.server || {};
    content.server.host = '0.0.0.0';
    content.mode = 'development';

    let bundlePath = '/main.lynx.bundle';
    content.plugins = [
      ...(content.plugins || []),
      {
        name: 'capture-bundle-path',
        setup(api) {
          api.onAfterStartDevServer(() => {
            const config = api.getNormalizedConfig();
            const { filename } = config.output ?? {};
            let name = '[name].[platform].bundle';
            if (typeof filename === 'string') name = filename;
            const entries = config.source?.entry || { index: '' };
            const entryName = Object.keys(entries)[0] || 'main';
            bundlePath = '/'
              + name.replace('[name]', entryName).replace('[platform]', 'lynx');
            console.log(bundlePath);
          });
        },
      },
    ];

    const rspeedy = await createRspeedy({
      cwd,
      rspeedyConfig: content,
    });
    const result = await rspeedy.startDevServer();
    devServer = result.server;

    devPort = result.port;

    // Use ADB port forwarding
    try {
      const client = new AdbServerClient(
        new AdbServerNodeTcpConnector({ port: 5037 }),
      );
      const devices = await client.getDevices();
      const connectedDevice = devices.find(d => d.state === 'device')
        || devices[0];
      if (connectedDevice) {
        adb = await client.createAdb({ serial: connectedDevice.serial });
        await adb.reverse.addExternal(`tcp:${devPort}`, `tcp:${devPort}`);
      }
    } catch (e) {
      console.warn(`Failed to run adb reverse for port ${devPort}`, e);
    }

    bundleUrl = `http://127.0.0.1:${devPort}${bundlePath}`;

    lynx = await Lynx.connect();
  });

  afterAll(async () => {
    try {
      if (adb) {
        await adb.reverse.remove(`tcp:${devPort}`);
        await adb.close();
      }
    } catch (e) {
      // Ignore
    }
    await devServer?.close();
    await lynx?.close();
  });

  it('can navigate to a page and read the DOM', async () => {
    console.log('Navigating to', bundleUrl);
    const page = await lynx.newPage();

    try {
      await page.goto(bundleUrl, { timeout: 15000 });
    } catch (e) {
      throw new Error(`Failed to navigate to URL: ${bundleUrl}. Error: ${e}`);
    }

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
