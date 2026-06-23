import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { AdbServerClient, type Adb } from '@yume-chan/adb';
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp';
import { execa } from 'execa';
import jpeg from 'jpeg-js';
import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';

import { Lynx } from '../src/Lynx.js';
import type { KittenLynxView } from '../src/KittenLynxView.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.dirname(__dirname);
const fixtureDistDir = path.resolve(cwd, 'test-fixture/.generated');

async function buildFixture() {
  await execa('pnpm', ['run', 'build:fixture'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    cwd,
    stdio: 'inherit',
    cleanup: true,
  });
}

async function startFixtureServer(): Promise<Server> {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const filePath = path.resolve(
        fixtureDistDir,
        requestUrl.pathname.replace(/^\/+/, ''),
      );
      const relativePath = path.relative(fixtureDistDir, filePath);
      if (
        relativePath.startsWith('..')
        || path.isAbsolute(relativePath)
      ) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const content = await readFile(filePath);
      response.setHeader('Content-Type', getContentType(filePath));
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(3001, '0.0.0.0', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  return server;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.bundle') || filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }
  return 'application/octet-stream';
}

async function closeFixtureServer(server: Server | undefined) {
  if (!server) {
    return;
  }
  server.closeAllConnections();
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }
      resolveClose();
    });
  });
}

describe('kitten-lynx testing framework', () => {
  let lynx: Lynx;
  let adb: Adb;
  let page: KittenLynxView;
  let fixtureServer: Server | undefined;

  beforeAll(async () => {
    await buildFixture();
    fixtureServer = await startFixtureServer();

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
    await closeFixtureServer(fixtureServer);
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
    const buffer = await page.screenshot();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Assert the screenshot is not a completely white image
    const rawImageData = jpeg.decode(buffer, { useTArray: true });
    let hasNonWhite = false;
    for (let i = 0; i < rawImageData.data.length; i += 4) {
      if (
        rawImageData.data[i] !== 255
        || rawImageData.data[i + 1] !== 255
        || rawImageData.data[i + 2] !== 255
      ) {
        hasNonWhite = true;
        break;
      }
    }
    expect(hasNonWhite).toBe(true);
  });
});
