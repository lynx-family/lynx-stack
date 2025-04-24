// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Page, BrowserContext, CDPSession } from '@playwright/test';

import { test, expect } from './coverage-fixture.js';

const isCI = !!process.env['CI'];

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (
  playwrightContext: {
    page: Page;
    browserName: string;
    context: BrowserContext;
  },
  testname: string,
) => {
  const { page, browserName, context } = playwrightContext;
  test.skip(browserName !== 'chromium', 'cannot create cdp session');
  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Performance.enable');
  await page.goto(`/web-element-tests/performance/${testname}.html`, {
    waitUntil: 'load',
  });
  return cdpSession;
};

const usingMetrics = new Set(['LayoutCount', 'RecalcStyleCount']);

interface MerticsResult {
  LayoutCount: number;
  RecalcStyleCount: number;
  domComplete: number;
  longTaskEnd: number;
  firstPaint: number;
}

const getMetrics = async (cdpSession: CDPSession, page: Page) => {
  await wait(1000);
  const rawMetrics = await cdpSession.send('Performance.getMetrics');
  const performanceEvents =
    await (await page.evaluateHandle(() => globalThis.performanceResult))
      .jsonValue();
  const merticsResult = Object.fromEntries(
    rawMetrics.metrics.filter(({ name }) => usingMetrics.has(name)).map((
      { name, value },
    ) => [name, value]),
  ) as unknown as MerticsResult;
  merticsResult.domComplete = performanceEvents?.navigation.domComplete;
  merticsResult.longTaskEnd = performanceEvents?.longtask
    ? performanceEvents?.longtask.duration
      + performanceEvents?.longtask.startTime
    : undefined;
  merticsResult.firstPaint = performanceEvents?.paint?.startTime;
  return merticsResult;
};

test.describe('performance', () => {
  test.describe.configure({ mode: 'serial', retries: 5 });
  test('simple-one-div', async ({ page, browserName, context }, { title }) => {
    /**
     * Baseline test.
     */
    const cdpSession = await goto({ page, browserName, context }, title);
    const metrics = await getMetrics(cdpSession, page);
    expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(2);
    expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(3);
  });
  test('simple-one-dom', async ({ page, browserName, context }, { title }) => {
    const cdpSession = await goto({ page, browserName, context }, title);
    const metrics = await getMetrics(cdpSession, page);
    expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(2);
    expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(3);
  });
  test('simple-two-dom', async ({ page, browserName, context }, { title }) => {
    const cdpSession = await goto({ page, browserName, context }, title);
    const metrics = await getMetrics(cdpSession, page);
    expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(2);
    expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(3);
  });
  test(
    'simple-append-two-dom',
    async ({ page, browserName, context }, { title }) => {
      const cdpSession = await goto({ page, browserName, context }, title);
      await wait(200);
      const metrics = await getMetrics(cdpSession, page);
      await expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(2);
      await expect(metrics.RecalcStyleCount, 'recalc count')
        .toBeLessThanOrEqual(4);
      await expect(
        await page.locator('x-view').first(),
      ).toHaveCSS('flex-direction', 'column');
    },
  );
  test(
    'connected-x-text',
    async ({ page, browserName, context }, { title }) => {
      const cdpSession = await goto({ page, browserName, context }, title);
      const metrics = await getMetrics(cdpSession, page);
      expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(3);
      expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(3);
    },
  );
  test('div-10000', async ({ page, browserName, context }, { title }) => {
    const cdpSession = await goto({ page, browserName, context }, title);
    const metrics = await getMetrics(cdpSession, page);
    expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(3);
    expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(3);
  });
  test('x-view-10000', async ({ page, browserName, context }, { title }) => {
    const cdpSession = await goto({ page, browserName, context }, title);
    const metrics = await getMetrics(cdpSession, page);
    expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(3);
    expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(3);
    console.log(metrics);
  });
  test(
    'vs-react-10000-div',
    async ({ page, browserName, context }, { title }) => {
      const cdpSession2 = await goto(
        { page, browserName, context },
        'x-view-10000',
      );
      const webcomponentsMetrics = await getMetrics(cdpSession2, page);
      const cdpSession = await goto(
        { page, browserName, context },
        'react-10000-div',
      );
      const react18Metrics = await getMetrics(cdpSession, page);
      console.log(
        'web react',
        webcomponentsMetrics.domComplete,
        react18Metrics.domComplete,
      );
      expect(
        webcomponentsMetrics.domComplete / react18Metrics.domComplete,
      ).toBeLessThan(5);
    },
  );
  test(
    'vs-react-10000-div-with-layouteffect',
    async ({ page, browserName, context }, { title }) => {
      const cdpSession = await goto(
        { page, browserName, context },
        'react-10000-div-with-layouteffect',
      );
      const react18Metrics = await getMetrics(cdpSession, page);
      const cdpSession2 = await goto(
        { page, browserName, context },
        'x-view-10000-fp',
      );
      const webcomponentsMetrics = await getMetrics(cdpSession2, page);
      console.log(
        'web react',
        webcomponentsMetrics.firstPaint,
        react18Metrics.firstPaint,
      );
      expect(
        webcomponentsMetrics.firstPaint / react18Metrics.firstPaint,
        '-10%',
      ).toBeLessThan(0.9);
    },
  );

  isCI ?? test.describe.configure({ retries: 8 });
  test(
    'x-list-waterfall-1000',
    async ({ page, browserName, context }, { title }) => {
      const cdpSession = await goto({ page, browserName, context }, title);
      const metrics = await getMetrics(cdpSession, page);
      console.log(metrics.LayoutCount, metrics.RecalcStyleCount);
      expect(metrics.LayoutCount, 'layout count').toBeLessThanOrEqual(7);
      expect(metrics.RecalcStyleCount, 'recalc count').toBeLessThanOrEqual(8);
    },
  );
});
