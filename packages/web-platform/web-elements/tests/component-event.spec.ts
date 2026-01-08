import { test, expect } from '@lynx-js/playwright-fixtures';

const gotoWebComponentPage = async (page: any, testname: string) => {
  await page.goto(`/tests/fixtures/${testname}.html`, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('Component Event Logic', () => {
  test('enableEvent and disableEvent should trigger status changes correctly', async ({ page }) => {
    await gotoWebComponentPage(page, 'component-event-test');

    // Check initial state
    const initialEvents = await page.evaluate(() =>
      (window as any).eventEvents
    );
    expect(initialEvents).toBeUndefined();

    // Wait for custom element to be defined
    await page.evaluate(() => customElements.whenDefined('x-event-test'));

    // Check availability
    const isDefined = await page.evaluate(() =>
      !!customElements.get('x-event-test')
    );
    expect(isDefined).toBe(true);

    // Call enableEvent
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      if (!el) throw new Error('x-event-test not found in DOM');
      el.enableEvent('custom-event');
    });

    // Check events: should be enabled
    let events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'custom-event', status: true });

    // Call enableEvent again
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      el.enableEvent('custom-event');
    });

    // Check events: should not have changed
    events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(1);

    // Call disableEvent (count was 2, now 1)
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      el.disableEvent('custom-event');
    });

    // Check events: should stay enabled
    events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(1);

    // Call disableEvent again (count was 1, now 0)
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      el.disableEvent('custom-event');
    });

    // Check events: should be disabled
    events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: 'custom-event', status: false });
  });

  test('addEventListener and removeEventListener should trigger status changes', async ({ page }) => {
    await gotoWebComponentPage(page, 'component-event-test');

    // Reset events
    await page.evaluate(() => ((window as any).eventEvents = []));

    // addEventListener
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      const handler = () => {};
      (window as any).__handler = handler;
      el.addEventListener('custom-event', handler);
    });

    // Check enabled
    let events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'custom-event', status: true });

    // addEventListener (same event, different handler)
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      const handler2 = () => {};
      (window as any).__handler2 = handler2;
      el.addEventListener('custom-event', handler2);
    });

    // Check no change
    events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(1);

    // removeEventListener (first handler)
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      el.removeEventListener('custom-event', (window as any).__handler);
    });

    // Check no change
    events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(1);

    // removeEventListener (second handler)
    await page.evaluate(() => {
      const el = document.querySelector('x-event-test') as any;
      el.removeEventListener('custom-event', (window as any).__handler2);
    });

    // Check disabled
    events = await page.evaluate(() => (window as any).eventEvents);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: 'custom-event', status: false });
  });
});
