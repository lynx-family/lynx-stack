// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile } from 'node:fs/promises';

import type { Browser } from 'puppeteer';

/**
 * Lazy puppeteer singleton. The browser launches on the first `rasterizePreview`
 * call and is reused for the rest of the run. `--dry-run` paths never call
 * `rasterizePreview`, so puppeteer is not imported at module load time —
 * launching is gated behind dynamic `import('puppeteer')` to keep harness boot
 * cheap and to allow the dry-run smoke to pass even before puppeteer is
 * installed (it will pass through unused).
 */

let browserPromise: Promise<Browser> | null = null;
let registeredShutdown = false;

/**
 * Find a usable Chrome/Chromium executable. Priority:
 *   1. `PUPPETEER_EXECUTABLE_PATH` env (explicit override)
 *   2. macOS system Chrome at the standard install path
 *   3. fall through to puppeteer's bundled Chromium (requires postinstall)
 */
function resolveExecutablePath(): string | undefined {
  const fromEnv = process.env['PUPPETEER_EXECUTABLE_PATH'];
  if (fromEnv) return fromEnv;
  const macChrome =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  // existsSync would force a sync stat; instead we just hand the path to
  // puppeteer and let it fail loudly if missing — rasterize is best-effort.
  if (process.platform === 'darwin') return macChrome;
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;
  browserPromise = (async (): Promise<Browser> => {
    const { default: puppeteer } = await import('puppeteer');
    const executablePath = resolveExecutablePath();
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath ? { executablePath } : {}),
    });
  })();
  if (!registeredShutdown) {
    registeredShutdown = true;
    process.on('exit', () => {
      // Best-effort sync shutdown via fire-and-forget; node exits anyway.
      void closeBrowser();
    });
  }
  return browserPromise;
}

/**
 * Close the singleton browser, if any. Safe to call multiple times.
 * The harness invokes this in a finally block to release the Chromium
 * process at end of run.
 */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const p = browserPromise;
  browserPromise = null;
  try {
    const b = await p;
    await b.close();
  } catch {
    // Swallow shutdown errors — the process is exiting.
  }
}

export interface RasterizeOptions {
  width?: number;
  height?: number;
}

/**
 * Render the HTML at `htmlPath` and write a PNG to `outPngPath`.
 * Default viewport is 800×1200 per RUBRIC.md M4. Throws on failure;
 * the harness catches and degrades to `screenshot_path: null`.
 */
export async function rasterizePreview(
  htmlPath: string,
  outPngPath: string,
  opts: RasterizeOptions = {},
): Promise<void> {
  const width = opts.width ?? 800;
  const height = opts.height ?? 1200;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height });
    const html = await readFile(htmlPath, 'utf8');
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: outPngPath as `${string}.png`, type: 'png' });
  } finally {
    await page.close();
  }
}
