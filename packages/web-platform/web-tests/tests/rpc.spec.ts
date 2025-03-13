import { test, expect } from '@playwright/test';

function waitImpl(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(() => resolve(), ms);
  return promise;
}

test.describe('rpc tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rpc-test.html');
    await waitImpl(100);
  });

  test('addAsync', async ({ page }) => {
    const worker = page.workers().pop()!;
    const ret = await worker.evaluate(async () => {
      // @ts-ignore
      const ret = globalThis.addAsync(2, 3);
      return typeof ret === 'object' ? await ret : undefined;
    });
    expect(ret).toBe(5);
  });
  test('addSync', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=1752287',
    );
    const worker = page.workers().pop()!;
    const ret = await worker.evaluate(async () => {
      // @ts-ignore
      const ret = globalThis.addSync(2, 3);
      return ret;
    });
    expect(ret).toBe(5);
  });
  test('console.log async', async ({ page }) => {
    const consoleLogs: string[] = [];
    await page.on('console', (consoleMsg) => {
      consoleLogs.push(consoleMsg.text());
    });
    const worker = page.workers().pop()!;
    await worker.evaluate(async () => {
      // @ts-ignore
      const ret = await globalThis.consoleLog('hello world');
    });
    expect(consoleLogs).toContain('hello world');
  });

  test('console.log sync', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=1752287',
    );
    const consoleLogs: string[] = [];
    await page.on('console', (consoleMsg) => {
      consoleLogs.push(consoleMsg.text());
    });
    const worker = page.workers().pop()!;
    await worker.evaluate(async () => {
      // @ts-ignore
      const ret = globalThis.consoleLogSync('hello world');
    });
    expect(consoleLogs).toContain('hello world');
  });

  test('throwError async', async ({ page }) => {
    const worker = page.workers().pop()!;
    const result = await worker.evaluate(async () => {
      const result: string[] = [];
      // @ts-ignore
      const ret = globalThis.throwError() as Promise;
      result.push(typeof ret);
      result.push(ret.then ? 'then' : 'no then');
      try {
        await ret;
      } catch {
        result.push('success');
      }
      return result;
    });
    expect(result).toStrictEqual([
      'object',
      'then',
      'success',
    ]);
  });

  test('throwError sync', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=1752287',
    );
    const worker = page.workers().pop()!;
    const result = await worker.evaluate(async () => {
      const result: string[] = [];
      try {
        // @ts-ignore
        const ret = globalThis.throwErrorSync();
      } catch {
        result.push('success');
      }
      return result;
    });
    expect(result[0]).toStrictEqual('success');
  });

  test('wait async', async ({ page }) => {
    const consoleLogs: number[] = [];
    await page.on('console', (msg) => {
      const msgValue = msg.text();
      if (msgValue === 'stamp') {
        consoleLogs.push(performance.now());
      }
    });
    const worker = page.workers().pop()!;
    await worker.evaluate(async () => {
      console.log('stamp');
      // @ts-expect-error
      globalThis.wait(1000);
      console.log('stamp');
      // @ts-expect-error
      await globalThis.wait(1000);
      console.log('stamp');
    });
    expect(consoleLogs[1]! - consoleLogs[0]!).toBeLessThan(200);
    expect(consoleLogs[2]! - consoleLogs[1]!).toBeGreaterThan(800);
  });

  test('wait sync', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=1752287',
    );
    const consoleLogs: number[] = [];
    await page.on('console', (msg) => {
      const msgValue = msg.text();
      if (msgValue === 'stamp') {
        consoleLogs.push(performance.now());
      }
    });
    const worker = page.workers().pop()!;
    await worker.evaluate(async () => {
      console.log('stamp');
      // @ts-expect-error
      globalThis.waitSync(1000);
      console.log('stamp');
      // @ts-expect-error
      await globalThis.waitSync(1000);
      console.log('stamp');
    });
    expect(consoleLogs[1]! - consoleLogs[0]!).toBeGreaterThan(800);
    expect(consoleLogs[2]! - consoleLogs[1]!).toBeGreaterThan(800);
  });
  test('lazy handler', async ({ page }) => {
    const worker = page.workers().pop()!;
    const ret = await worker.evaluate(async () => {
      // @ts-ignore
      const ret = globalThis.testLazy(2, 3);
      return typeof ret === 'object' ? await ret : undefined;
    });
    expect(ret).toBe(5);
  });
  test('lazy handler change object handler', async ({ page }) => {
    const worker = page.workers().pop()!;
    const ret = await worker.evaluate(async () => {
      // @ts-ignore
      const ret = globalThis.testLazy(2, 3);
      return typeof ret === 'object' ? await ret : undefined;
    });
    expect(ret).toBe(5);
    await page.evaluate(async () => {
      // @ts-expect-error
      globalThis.emptyObj.testLazy = () => 100;
      return;
    });
    const ret2 = await worker.evaluate(async () => {
      // @ts-ignore
      const ret = globalThis.testLazy(2, 3);
      return typeof ret === 'object' ? await ret : undefined;
    });
    expect(ret2).toBe(100);
  });

  test('async return with transfer', async ({ page }) => {
    const worker = page.workers().pop()!;
    await worker.evaluate(async () => {
      // @ts-ignore
      const offscreen = await globalThis.addAsyncWithTransfer();
      offscreen.width = 100;
      offscreen.height = 100;
      const ctx = offscreen.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
    });
    await waitImpl(100);
    expect(
      await page.evaluate(() => {
        return document.querySelector('canvas')?.width === 100;
      }),
    ).toBeTruthy;
    expect(
      await page.evaluate(() => {
        return document.querySelector('canvas')?.height === 100;
      }),
    ).toBeTruthy;
  });
});
