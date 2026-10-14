import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page) => {
  await page.goto('tests/fixtures/x-markdown/rapid-append.html', {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#reference').locator('table')).toHaveCount(1);
  await page.waitForFunction(() => (window as any).streamDone === true);
};

test(
  'rapid append should match rendering the same content once',
  async ({ page }, testInfo) => {
    await goto(page);
    const streamed = page.locator('#streamed');
    const reference = page.locator('#reference');
    const source = await reference.getAttribute('content');
    await expect(streamed).toHaveAttribute('content', source!);
    const html = await reference.locator('#markdown-root').innerHTML();

    await testInfo.attach('streaming-comparison', {
      body: await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath('streaming-comparison.png'),
      }),
      contentType: 'image/png',
    });
    await expect.poll(() => streamed.locator('#markdown-root').innerHTML())
      .toBe(html);
  },
);

test(
  'rapid append should preserve visible typewriter progress',
  async ({ page }, testInfo) => {
    await goto(page);
    const streamed = page.locator('#streamed');
    await streamed.evaluate((element) => {
      element.setAttribute('animation-type', 'typewriter');
      element.setAttribute('animation-velocity', '10');
      element.setAttribute('content-complete', 'false');
      element.setAttribute('content', 'Hello');
    });
    await expect(streamed.locator('#markdown-root')).toContainText('Hel');

    const samples = await streamed.evaluate(async (element) => {
      const texts: string[] = [];
      for (let index = 0; index < 40; index++) {
        element.setAttribute('content', `${element.getAttribute('content')}x`);
        // Input arrives faster than the 100ms typewriter tick.
        await new Promise(resolve => setTimeout(resolve, 5));
        const root = element.shadowRoot!.querySelector('#markdown-root')!;
        texts.push(root.querySelector('p')?.textContent ?? '');
      }
      return texts;
    });
    await testInfo.attach('visible-text-during-streaming', {
      body: JSON.stringify(samples),
      contentType: 'application/json',
    });
    expect(samples.every(text => text.startsWith('Hel'))).toBe(true);
    await expect(streamed.locator('p')).toContainText(
      `Hello${'x'.repeat(40)}`,
      {
        timeout: 10_000,
      },
    );
  },
);

test('should display appended text while input continues without newlines', async ({ page }) => {
  await goto(page);
  const streamed = page.locator('#streamed');
  await streamed.evaluate(element => element.setAttribute('content', 'Start'));
  await expect(streamed.locator('p')).toHaveText('Start');
  const samples = await streamed.evaluate(async (element) => {
    const samples: { content: string; text: string }[] = [];
    for (let index = 0; index < 40; index++) {
      const content = `${element.getAttribute('content')}x`;
      element.setAttribute('content', content);
      await new Promise(resolve => setTimeout(resolve, 5));
      samples.push({
        content,
        text: element.shadowRoot!.querySelector('p')?.textContent ?? '',
      });
    }
    return samples;
  });
  expect(samples.every(({ content, text }) => content === text)).toBe(true);
});

test('should resolve reference links defined in appended content', async ({ page }) => {
  await goto(page);
  const streamed = page.locator('#streamed');
  await streamed.evaluate(element =>
    element.setAttribute('content', '[link][target]\n\n')
  );
  await expect(streamed.locator('p')).toHaveText('[link][target]');
  await streamed.evaluate(element =>
    element.setAttribute(
      'content',
      `${element.getAttribute('content')}[target]: https://example.com\n`,
    )
  );
  await expect(streamed.locator('a')).toHaveAttribute(
    'href',
    'https://example.com',
  );
});

test('should respect content-range when content is appended', async ({ page }) => {
  await goto(page);
  const streamed = page.locator('#streamed');
  await streamed.evaluate(element => {
    element.setAttribute('content-range', '[0,5]');
    element.setAttribute('content', 'Hello');
  });
  await expect(streamed.locator('p')).toHaveText('Hello');
  await streamed.evaluate(element =>
    element.setAttribute('content', 'Hello world\n')
  );
  await expect(streamed.locator('#markdown-root')).toHaveText('Hello');
});

test('should resume typewriter after catching up with the stream', async ({ page }) => {
  await goto(page);
  const streamed = page.locator('#streamed');
  await streamed.evaluate(element => {
    element.setAttribute('animation-type', 'typewriter');
    element.setAttribute('animation-velocity', '100');
    element.setAttribute('content-complete', 'false');
    element.setAttribute(
      'markdown-style',
      JSON.stringify({
        typewriterCursor: { customCursor: 'none' },
      }),
    );
    element.setAttribute('content', 'Hello');
  });
  await expect(streamed.locator('#markdown-root')).toHaveText('Hello');
  await streamed.evaluate(element =>
    element.setAttribute('content', 'Hello world')
  );
  await expect(streamed.locator('#markdown-root')).toHaveText('Hello world');
});
