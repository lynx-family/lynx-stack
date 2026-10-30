// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { encodeLynxXML } from '@lynx-js/web-core/encode';
import { expect, test } from '@lynx-js/playwright-fixtures';

// Control the document viewport explicitly; mobile layout-viewport expansion
// can otherwise make the horizontal-scroll scenario unscrollable.
test.use({ isMobile: false });

const encoded = encodeLynxXML(
  readFileSync(
    new URL('./fixtures/event-coordinates.xml', import.meta.url),
    'utf8',
  ),
);
if (!encoded.success) throw new Error(encoded.message);
const bundle = Buffer.from(encoded.buffer);

interface CoordinateRecord {
  type: string;
  x: number;
  pageX: number;
  pageY: number;
  clientX: number;
  clientY: number;
  detail: { x?: number; y?: number } | number;
  bounds: { left: number; top: number; width: number; height: number };
}

for (const iframe of [false, true]) {
  for (
    const scenario of [
      { name: 'origin', offset: 0, scroll: 0, scale: 1 },
      { name: 'offset', offset: 160, scroll: 0, scale: 1 },
      { name: 'scrolled', offset: 160, scroll: 100, scale: 1 },
      { name: 'scaled', offset: 160, scroll: 0, scale: 0.8 },
    ]
  ) {
    test(`event page coordinates: ${iframe ? 'iframe' : 'direct'} ${scenario.name}`, async ({ page, browserName }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const records: CoordinateRecord[] = [];
      page.on('console', message => {
        const prefix = 'EVENT_COORDINATES ';
        if (message.text().startsWith(prefix)) {
          records.push(JSON.parse(message.text().slice(prefix.length)));
        }
      });
      await page.route(
        '**/event-coordinates.web.bundle',
        route =>
          route.fulfill({
            body: bundle,
            contentType: 'application/octet-stream',
          }),
      );
      await page.route('**/event-coordinates.html', route =>
        route.fulfill({
          contentType: 'text/html',
          body:
            `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
            body { margin: 0; min-width: 2000px; }
            lynx-view { display: block; position: absolute; left: ${scenario.offset}px;
              top: 120px; width: 640px; height: 300px;
              transform: scale(${scenario.scale}); transform-origin: 0 0; }
          </style>
          <link rel="stylesheet" href="/node_modules/@lynx-js/web-core/dist/client_prod/static/css/client.css">
          </head><body><lynx-view url="/event-coordinates.web.bundle"></lynx-view>
          <script type="module" src="/node_modules/@lynx-js/web-core/dist/client_prod/static/js/client.js"></script>
          </body></html>`,
        }));
      if (iframe) {
        await page.route(
          '**/event-coordinates-frame.html',
          route =>
            route.fulfill({
              contentType: 'text/html',
              body:
                '<iframe style="position:absolute;left:100px;top:0;width:1100px;height:700px;border:0" src="/event-coordinates.html"></iframe>',
            }),
        );
      }
      await page.goto(
        iframe ? '/event-coordinates-frame.html' : '/event-coordinates.html',
      );
      const target = iframe
        ? page.frameLocator('iframe').locator('#coordinate-target')
        : page.locator('#coordinate-target');
      await expect(target).toBeVisible();
      await expect.poll(() =>
        target.evaluate((element, scroll) => {
          const window = element.ownerDocument.defaultView!;
          window.scrollTo(scroll, 0);
          return window.scrollX;
        }, scenario.scroll)
      ).toBe(scenario.scroll);
      // Allow the host-rect service's existing idle invalidation to pick up
      // scrolling before comparing viewport and LynxView coordinates.
      if (scenario.scroll) await page.waitForTimeout(300);
      await target.click();
      await expect.poll(() => records.length).toBe(1);
      // Touch emulation is unavailable in Firefox. The same touch conversion
      // is covered by unit tests for all three touch lists and all phases.
      if (browserName !== 'firefox') {
        await target.tap();
        await expect.poll(() => records.map(record => record.type)).toContain(
          'touchstart',
        );
      }
      for (const record of records) {
        expect(record.pageX).toBeCloseTo(320 * scenario.scale);
        expect(record.pageY).toBeCloseTo(140 * scenario.scale);
        expect(record.clientX).toBeCloseTo(
          scenario.offset - scenario.scroll + 320 * scenario.scale,
        );
        expect(record.clientY).toBeCloseTo(120 + 140 * scenario.scale);
        expect(record.x).toBeCloseTo(record.pageX);
        expect((record.pageX - record.bounds.left) / record.bounds.width)
          .toBeCloseTo(0.5);
        if (record.type === 'touchstart') {
          expect(record.detail).toEqual({ x: record.pageX, y: record.pageY });
        }
      }
    });
  }
}
