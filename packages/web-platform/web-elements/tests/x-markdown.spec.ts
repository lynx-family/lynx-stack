import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page, fixtureName: string) => {
  await page.goto(`tests/fixtures/${fixtureName}.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
};

const getShadowText = async (page: Page, selector: string) =>
  page.evaluate((value) => {
    const element = document.querySelector('x-markdown');
    return element?.shadowRoot?.querySelector(value)?.textContent ?? '';
  }, selector);

const getShadowCount = async (page: Page, selector: string) =>
  page.evaluate((value) => {
    const element = document.querySelector('x-markdown');
    return element?.shadowRoot?.querySelectorAll(value).length ?? 0;
  }, selector);

const appendContent = async (page: Page, suffix: string) => {
  await page.evaluate((value) => {
    const element = document.querySelector('x-markdown');
    const content = element?.getAttribute('content') ?? '';
    element?.setAttribute('content', `${content}${value}`);
  }, suffix);
};

const captureFirstChild = async (page: Page) => {
  await page.evaluate(() => {
    const element = document.querySelector('x-markdown');
    const root = element?.shadowRoot?.querySelector('#markdown-root');
    (window as any).__markdown_first_child = root?.firstElementChild ?? null;
  });
};

const isFirstChildSame = async (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector('x-markdown');
    const root = element?.shadowRoot?.querySelector('#markdown-root');
    return root?.firstElementChild === (window as any).__markdown_first_child;
  });

const selectShadowText = async (
  page: Page,
  selector: string,
  startOffset: number,
  endOffset: number,
) => {
  await page.evaluate(
    ({ value, start, end }) => {
      (window as any)._selectShadowText(value, start, end);
    },
    { value: selector, start: startOffset, end: endOffset },
  );
};

const selectShadowTextByMouseup = async (
  page: Page,
  selector: string,
  startOffset: number,
  endOffset: number,
) => {
  await page.evaluate(
    ({ value, start, end }) => {
      (window as any)._selectShadowTextByMouseup(value, start, end);
    },
    { value: selector, start: startOffset, end: endOffset },
  );
};

const setTextSelection = async (
  page: Page,
  selector: string,
  startOffset: number,
  endOffset: number,
) => {
  await page.evaluate(
    ({ value, start, end }) => {
      (window as any)._setTextSelection(value, start, end);
    },
    { value: selector, start: startOffset, end: endOffset },
  );
};

const clearShadowText = async (page: Page) => {
  await page.evaluate(() => {
    (window as any)._clearShadowText?.();
  });
};

test.describe('x-markdown', () => {
  test('should render basic markdown', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const markdown = page.locator('x-markdown');

    await expect(markdown.locator('h1')).toHaveText('Title');
    await expect(markdown.locator('strong')).toHaveText('bold');
    await expect(markdown.locator('em')).toHaveText('italic');
    await expect(markdown.locator('li')).toHaveCount(2);
    await expect(markdown.locator('code').first()).toContainText('code');
  });

  test('should apply markdown-style updates', async ({ page }) => {
    await goto(page, 'x-markdown/style');
    const markdown = page.locator('x-markdown');
    await page.waitForFunction(() => {
      const element = document.querySelector('x-markdown');
      return element?.shadowRoot?.querySelector('a')?.textContent === 'link';
    });

    const link = markdown.locator('a');
    await expect(link).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(link).toHaveCSS('line-height', '24px');

    const inlineCode = markdown.locator('code').first();
    await expect(inlineCode).toHaveCSS('color', 'rgb(0, 0, 255)');
    await expect(inlineCode).toHaveCSS(
      'background-color',
      'rgb(238, 238, 238)',
    );

    await markdown.evaluate((el) => {
      el.setAttribute(
        'markdown-style',
        JSON.stringify({ link: { color: '0000ff' } }),
      );
    });
    await expect(link).toHaveCSS('color', 'rgb(0, 0, 255)');
  });

  test('should support markdown-style property updates', async ({ page }) => {
    await goto(page, 'x-markdown/style');
    const markdown = page.locator('x-markdown');

    const link = markdown.locator('a');
    const propertyValue = await markdown.evaluate((el: any) => {
      el['markdown-style'] = { link: { color: '00ff00' } };
      return el.markdownStyle;
    });

    expect(propertyValue).toEqual({ link: { color: '00ff00' } });
    await expect(link).toHaveCSS('color', 'rgb(0, 255, 0)');
    await expect(markdown).toHaveAttribute(
      'markdown-style',
      JSON.stringify({ link: { color: '00ff00' } }),
    );
  });

  test('should render image', async ({ page }) => {
    await goto(page, 'x-markdown/image');
    const markdown = page.locator('x-markdown');

    const image = markdown.locator('img');
    await expect(image).toHaveAttribute(
      'src',
      '/tests/fixtures/resources/firefox-logo.png',
    );
  });

  test('should update content on attribute change', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const markdown = page.locator('x-markdown');

    await markdown.evaluate((el) => {
      el.setAttribute('content', '# Updated');
    });
    await expect(markdown.locator('h1')).toHaveText('Updated');
  });

  test('should only allow span and p html tags in markdown content', async ({ page }) => {
    await goto(page, 'x-markdown/html-tags');
    const markdown = page.locator('x-markdown');

    const span = markdown.locator('span.mark-red');
    await expect(span).toHaveText('World');
    await expect(span).not.toHaveAttribute('style', /.+/);
    await expect(span).not.toHaveAttribute('onclick', /.+/);

    const p = markdown.locator('p.mark-help');
    await expect(p).toHaveText('Paragraph');
    await expect(p).not.toHaveAttribute('style', /.+/);

    await expect(markdown.locator('div.not-allowed')).toHaveCount(0);
    await expect(markdown).toContainText(
      '<div class="not-allowed">Not allowed</div>',
    );
  });

  test('should fire bindlink and bindimageTap events', async ({ page }) => {
    await goto(page, 'x-markdown/events');
    const markdown = page.locator('x-markdown');

    await markdown.locator('a').click();
    await page.waitForFunction(() => (window as any)._bindlink_detail !== null);
    const linkDetail = await page.evaluate(() =>
      (window as any)._bindlink_detail
    );
    expect(linkDetail.url).toBe('https://example.com');
    expect(linkDetail.content).toBe('link');
    expect(linkDetail.contentId).toBe('case-1');

    await markdown.locator('img').click();
    await page.waitForFunction(() =>
      (window as any)._bindimage_detail !== null
    );
    const imageDetail = await page.evaluate(() =>
      (window as any)._bindimage_detail
    );
    expect(imageDetail.url).toContain(
      '/tests/fixtures/resources/firefox-logo.png',
    );
    expect(imageDetail.contentId).toBe('case-1');
  });

  test.describe('programmatic shadow selection', () => {
    test.beforeEach(async ({ browserName }) => {
      test.skip(
        browserName === 'webkit',
        'programmatic shadow selection is unsupported in webkit',
      );
    });

    test('should enable text selection and fire selectionchange', async ({ page }) => {
      await goto(page, 'x-markdown/text-selection');
      await page.evaluate(() => {
        (window as any)._resetSelectionState();
        document.querySelector('x-markdown')?.setAttribute(
          'text-selection',
          'true',
        );
      });

      const selectionStateBeforeSelect = await page.evaluate(() =>
        (window as any)._getSelectionState()
      );
      expect(selectionStateBeforeSelect.styleText).toContain(
        'user-select: text;',
      );

      await selectShadowText(page, 'h1', 0, 5);
      await page.waitForFunction(() =>
        (window as any)._selection_detail !== null
      );

      const selectionState = await page.evaluate(() =>
        (window as any)._getSelectionState()
      );

      expect(selectionState.detail).toMatchObject({
        start: 0,
        end: 5,
        direction: 'forward',
      });
      expect(selectionState.selectedText).toBe('Title');
      expect(selectionState.rect?.width ?? 0).toBeGreaterThan(0);
      expect(selectionState.rect?.height ?? 0).toBeGreaterThan(0);
    });

    test('should fire selectionchange on mouseup in web', async ({ page }) => {
      await goto(page, 'x-markdown/text-selection');
      await page.evaluate(() => {
        (window as any)._resetSelectionState();
        document.querySelector('x-markdown')?.setAttribute(
          'text-selection',
          'true',
        );
      });

      await selectShadowTextByMouseup(page, 'h1', 0, 5);
      await page.waitForFunction(() =>
        (window as any)._selection_detail?.end === 5
      );

      const selectionState = await page.evaluate(() =>
        (window as any)._getSelectionState()
      );

      expect(selectionState.detail).toMatchObject({
        start: 0,
        end: 5,
        direction: 'forward',
      });
      expect(selectionState.selectedText).toBe('Title');
    });

    test('should show and position menu on selectionchange', async ({ page }) => {
      await goto(page, 'x-markdown/menu');

      const initialMenuState = await page.evaluate(() =>
        (window as any)._getMenuState()
      );
      expect(initialMenuState.visibility).toBe('hidden');
      expect(initialMenuState.labels).toEqual(['全选', '复制']);

      await selectShadowText(page, 'h1', 0, 5);
      await page.waitForFunction(() =>
        (window as any)._getMenuState().visibility === 'visible'
      );

      const menuState = await page.evaluate(() =>
        (window as any)._getMenuState()
      );
      expect(menuState.detail).toMatchObject({
        start: 0,
        end: 5,
        direction: 'forward',
      });
      expect(Number.parseFloat(menuState.left)).toBeGreaterThan(0);
      expect(Number.parseFloat(menuState.top)).toBeGreaterThan(0);

      await clearShadowText(page);
      await page.waitForFunction(() =>
        (window as any)._getMenuState().visibility === 'hidden'
      );
    });

    test('should defer menu display until mouseup during pointer selection', async ({ page }) => {
      await goto(page, 'x-markdown/menu');

      await page.locator('x-markdown').dispatchEvent('mousedown');
      await selectShadowText(page, 'h1', 0, 5);

      const menuStateWhileSelecting = await page.evaluate(() =>
        (window as any)._getMenuState()
      );
      expect(menuStateWhileSelecting.visibility).toBe('hidden');

      await page.evaluate(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      await page.waitForFunction(() =>
        (window as any)._getMenuState().visibility === 'visible'
      );
    });

    test('should clear selection when selection extends outside markdown', async ({ page }) => {
      await goto(page, 'x-markdown/menu');

      await selectShadowText(page, 'h1', 0, 5);
      await page.waitForFunction(() =>
        (window as any)._getMenuState().visibility === 'visible'
      );

      await page.evaluate(() => {
        (window as any)._selectShadowTextToMenu();
      });
      await page.waitForFunction(() => {
        const menuState = (window as any)._getMenuState();
        return (
          menuState.visibility === 'hidden'
          && menuState.detail?.start === -1
          && menuState.detail?.end === -1
        );
      });

      const menuState = await page.evaluate(() =>
        (window as any)._getMenuState()
      );
      expect(menuState.selectedText).toBe('');
    });
  });

  test('should not fire selectionchange when text-selection is false', async ({ page }) => {
    await goto(page, 'x-markdown/text-selection');
    await page.evaluate(() => {
      (window as any)._resetSelectionState();
      document.querySelector('x-markdown')?.setAttribute(
        'text-selection',
        'false',
      );
    });

    const selectionStateBeforeSelect = await page.evaluate(() =>
      (window as any)._getSelectionState()
    );
    expect(selectionStateBeforeSelect.styleText).not.toContain(
      'user-select: text;',
    );

    await selectShadowText(page, 'h1', 0, 5);
    await page.waitForTimeout(50);

    const selectionState = await page.evaluate(() =>
      (window as any)._getSelectionState()
    );
    expect(selectionState.count).toBe(0);
  });

  test.describe('selection methods', () => {
    test.beforeEach(async ({ browserName }) => {
      test.skip(browserName !== 'chromium', 'selection automation is flaky');
    });

    test('should getSelectedText return current selection text', async ({ page }) => {
      await goto(page, 'x-markdown/text-selection');
      await page.evaluate(() => {
        (window as any)._resetSelectionState();
      });

      await selectShadowText(page, 'h1', 0, 5);
      await page.waitForFunction(() =>
        (window as any)._selection_detail?.end === 5
      );

      const selectedText = await page.evaluate(() => {
        const el = document.querySelector('x-markdown') as any;
        return el.getSelectedText();
      });

      expect(selectedText).toBe('Title');
    });

    test('should setTextSelection update current selection', async ({ page }) => {
      await goto(page, 'x-markdown/text-selection');
      await setTextSelection(page, 'h1', 0, 5);
      await page.waitForFunction(() => {
        const el = document.querySelector('x-markdown') as any;
        return el?.getSelectedText() === 'Title';
      });

      const selectionState = await page.evaluate(() => {
        const el = document.querySelector('x-markdown') as any;
        return {
          selectedText: el.getSelectedText(),
          nativeSelectedText: el.shadowRoot?.getSelection?.()?.toString()
            ?? document.getSelection()?.toString()
            ?? '',
        };
      });

      expect(selectionState.selectedText).toBe('Title');
      expect(selectionState.nativeSelectedText).toBe('Title');
    });
  });

  test('should append content incrementally', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    expect(await getShadowText(page, 'h1')).toBe('Title');
    await captureFirstChild(page);
    await appendContent(page, '\n\n## More');
    await page.waitForFunction(() => {
      const element = document.querySelector('x-markdown');
      const root = element?.shadowRoot;
      return root?.querySelector('h2')?.textContent === 'More';
    });
    expect(await isFirstChildSame(page)).toBe(true);
  });

  test('should re-render when content diverges', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    await captureFirstChild(page);
    await page.evaluate(() => {
      const element = document.querySelector('x-markdown');
      element?.setAttribute('content', '# Title\n\nReplaced');
    });
    await page.waitForFunction(() => {
      const element = document.querySelector('x-markdown');
      return element?.shadowRoot?.querySelector('p')?.textContent
        === 'Replaced';
    });
    expect(await isFirstChildSame(page)).toBe(false);
  });

  test('should batch append by newline boundary', async ({ page }) => {
    await goto(page, 'x-markdown/incremental');
    expect(await getShadowCount(page, 'p')).toBe(1);
    await appendContent(page, 'Line 2');
    await page.waitForTimeout(20);
    expect(await getShadowCount(page, 'p')).toBe(1);
    await page.waitForTimeout(80);
    expect(await getShadowCount(page, 'p')).toBe(2);
  });

  test('should render tables', async ({ page }) => {
    await goto(page, 'x-markdown/table');
    const markdown = page.locator('x-markdown');
    await expect(markdown.locator('table')).toHaveCount(1);
  });

  test('should support basic methods', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const content = await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as any;
      return el.getContent({ start: 0, end: 6 }).content;
    });
    expect(content).toBe('# Title');
    const images = await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as any;
      return el.getImages();
    });
    expect(Array.isArray(images)).toBeTruthy();
  });

  test('should return full text ranges for nested markdown tags', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const content = [
      'Hello <span>nested only</span>',
      '',
      'Hello **bold** tail',
    ].join('\n');

    await page.evaluate((value) => {
      const el = document.querySelector('x-markdown') as any;
      el.setAttribute('content', value);
    }, content);
    await page.waitForFunction(() => {
      const el = document.querySelector('x-markdown');
      const root = el?.shadowRoot?.querySelector('#markdown-root');
      return root?.textContent?.includes('Hello nested only')
        && root?.textContent?.includes('Hello bold tail');
    });

    const ranges = await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as any;
      const rendered = el.shadowRoot?.querySelector('#markdown-root')
        ?.textContent ?? '';
      return {
        rendered,
        result: el.getParseResult({ tags: ['p', 'strong', 'span'] }),
      };
    });

    const firstParagraphText = 'Hello nested only';
    const secondParagraphText = 'Hello bold tail';
    const boldText = 'bold';
    const nestedSpanText = 'nested only';

    expect(ranges.result.p).toHaveLength(2);
    expect(
      ranges.rendered.slice(ranges.result.p[0].start, ranges.result.p[0].end),
    ).toBe(firstParagraphText);
    expect(
      ranges.rendered.slice(ranges.result.p[1].start, ranges.result.p[1].end),
    ).toBe(secondParagraphText);

    expect(ranges.result.strong).toHaveLength(1);
    expect(
      ranges.rendered.slice(
        ranges.result.strong[0].start,
        ranges.result.strong[0].end,
      ),
    ).toBe(boldText);

    expect(ranges.result.span).toHaveLength(1);
    expect(
      ranges.rendered.slice(
        ranges.result.span[0].start,
        ranges.result.span[0].end,
      ),
    ).toBe(nestedSpanText);
    expect(ranges.result.span[0].end).toBeGreaterThan(
      ranges.result.span[0].start,
    );
  });

  test('should support source indices in getTextBoundingRect', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const rects = await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as any;
      const source = el.getAttribute('content') ?? '';
      const rendered = el.shadowRoot?.querySelector('#markdown-root')
        ?.textContent ?? '';
      const sourceToken = '**bold**';
      const renderedToken = 'bold';
      const sourceStart = source.indexOf(sourceToken);
      const charStart = rendered.indexOf(renderedToken);
      const toPlainRect = (rect: DOMRect | undefined | null) =>
        rect
          ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
          : null;

      return {
        sourceRect: toPlainRect(
          el.getTextBoundingRect({
            start: sourceStart,
            end: sourceStart + sourceToken.length,
            indexType: 'source',
          })?.boundingRect,
        ),
        charRect: toPlainRect(
          el.getTextBoundingRect({
            start: charStart,
            end: charStart + renderedToken.length,
            indexType: 'char',
          })?.boundingRect,
        ),
      };
    });

    expect(rects.sourceRect).not.toBeNull();
    expect(rects.charRect).not.toBeNull();
    expect(rects.sourceRect?.width).toBeGreaterThan(0);
    expect(rects.sourceRect?.height).toBeGreaterThan(0);
    expect(rects.sourceRect?.left).toBeCloseTo(rects.charRect?.left ?? 0, 3);
    expect(rects.sourceRect?.top).toBeCloseTo(rects.charRect?.top ?? 0, 3);
    expect(rects.sourceRect?.width).toBeCloseTo(rects.charRect?.width ?? 0, 3);
    expect(rects.sourceRect?.height).toBeCloseTo(
      rects.charRect?.height ?? 0,
      3,
    );
  });

  test('should getImages return image sources', async ({ page }) => {
    await goto(page, 'x-markdown/image');
    const images = await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as any;
      return el.getImages();
    });
    expect(images).toEqual([
      '/tests/fixtures/resources/firefox-logo.png',
    ]);
  });

  test('should inject inline view and keep vertical-align', async ({ page }) => {
    await goto(page, 'x-markdown/inlineview');
    await page.waitForFunction(() => {
      const el = document.querySelector('x-markdown');
      const root = el && (el as any).shadowRoot;
      return !!root && !!root.querySelector('.md-inline-view');
    });
    const va = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const inline = root.querySelector('.md-inline-view') as
        | HTMLElement
        | null;
      return inline ? getComputedStyle(inline).verticalAlign : '';
    });
    expect(va).toBe('middle');
  });

  test('should apply class styles to inline view', async ({ page }) => {
    await goto(page, 'x-markdown/inlineview-class');
    await page.waitForFunction(() => {
      const el = document.querySelector('x-markdown');
      const slot = el?.shadowRoot?.querySelector(
        '.md-inline-view slot',
      ) as HTMLSlotElement | null;
      return slot?.assignedElements().some((node) =>
        (node as HTMLElement).id === 'content-view'
      ) ?? false;
    });

    const inlineView = page.locator('#content-view');
    await expect(inlineView).toHaveCSS('background-color', 'rgb(255, 0, 0)');
    await expect(inlineView).toHaveCSS('width', '24px');
    await expect(inlineView).toHaveCSS('height', '24px');
  });

  test('should clamp and append truncation marker', async ({ page }) => {
    await goto(page, 'x-markdown/truncate');
    const markerText = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const marker = root.querySelector('.md-truncation');
      return marker?.textContent || '';
    });
    expect(markerText).toBe('Read more');
  });

  test('should fire typewriter drawStart/drawEnd', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter');
    await page.waitForFunction(() => (window as any)._drawStart === true);
    await page.waitForFunction(() => (window as any)._drawEnd === true);
    await expect(page.locator('x-markdown').locator('h1')).toHaveText('Title');
  });

  test('should pause and resume typewriter animation', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter-pause-resume');
    await page.waitForFunction(
      () => ((window as any)._animationSteps?.length ?? 0) >= 2,
    );

    const pausedStep = await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as
        | (HTMLElement & { pauseAnimation: () => void })
        | null;
      el?.pauseAnimation();
      const steps = (window as any)._animationSteps ?? [];
      return steps[steps.length - 1] ?? 0;
    });

    await page.waitForTimeout(300);

    const stepAfterPause = await page.evaluate(() => {
      const steps = (window as any)._animationSteps ?? [];
      return steps[steps.length - 1] ?? 0;
    });
    expect(stepAfterPause).toBe(pausedStep);

    await page.evaluate(() => {
      const el = document.querySelector('x-markdown') as
        | (HTMLElement & { resumeAnimation: () => void })
        | null;
      el?.resumeAnimation();
    });

    await page.waitForFunction(
      (step) => {
        const steps = (window as any)._animationSteps ?? [];
        return (steps[steps.length - 1] ?? 0) > step;
      },
      pausedStep,
    );
  });

  test('should reset typewriter state when content is cleared and reassigned', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter-reset-content');
    await page.waitForFunction(() => (window as any)._reassigned === true);
    await page.waitForFunction(
      () => ((window as any)._newAnimationSteps?.length ?? 0) >= 1,
    );

    const state = await page.evaluate(() => ({
      textAfterReassign: (window as any)._textAfterReassign,
      firstNewStep: (window as any)._newAnimationSteps?.[0] ?? null,
    }));

    expect(state.textAfterReassign).toBe('');
    expect(state.firstNewStep).toBe(1);
  });

  test('should render custom typewriter cursor', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter-cursor');
    await page.waitForFunction(() => (window as any)._drawStart === true);
    await page.waitForTimeout(1500);

    const cursorRendered = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const cursor = root.querySelector('#cursor');
      return !!cursor;
    });
    expect(cursorRendered).toBe(true);
    await page.waitForTimeout(1000);
    const cursor = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const cursor = root.querySelector('#cursor');
      return cursor;
    });
    expect(cursor).toBeNull();
  });

  test('should render typewriter cursor after trailing text node', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter-trailing-text');
    await page.waitForTimeout(500);

    const isCorrectParent = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const cursor = root.querySelector('.md-typewriter-cursor');
      if (!cursor) return false;

      const parent = cursor.parentElement;
      return parent && parent.tagName === 'P';
    });

    expect(isCorrectParent).toBe(true);
  });

  test('should not hide cursor when content-complete is false', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter-keep-cursor');
    await page.waitForFunction(() => (window as any)._drawStart === true);
    await page.waitForFunction(() =>
      (window as any)._animationComplete === true
    );
    const isComplete = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      return el.getAttribute('content-complete');
    });
    expect(isComplete).toBe('false');
    const cursorRendered = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const cursor = root.querySelector('.md-typewriter-cursor');
      return !!cursor;
    });
    expect(cursorRendered).toBe(true);
  });

  test('should render markdown effect', async ({ page }) => {
    await goto(page, 'x-markdown/typewriter-effect');
    await page.waitForFunction(() => (window as any)._drawStart === true);
    await page.waitForFunction(() =>
      (window as any)._animationComplete === true
    );

    const effectState = await page.evaluate(() => {
      const el = document.querySelector('x-markdown')!;
      const root = el.shadowRoot as ShadowRoot;
      const effects = Array.from(
        root.querySelectorAll('.md-text-mask-effect'),
      ) as HTMLElement[];
      const overlays = Array.from(
        root.querySelectorAll('.md-text-mask-effect-overlay'),
      ) as HTMLElement[];
      const contents = Array.from(
        root.querySelectorAll('.md-text-mask-effect-content'),
      ) as HTMLElement[];
      return {
        rendered: effects.length > 0,
        effectCount: effects.length,
        overlayText: overlays.map((overlay) => overlay.textContent ?? '').join(
          '',
        ),
        contentText: contents.map((content) => content.textContent ?? '').join(
          '',
        ),
        overlayBackgrounds: overlays.map((overlay) => {
          const styles = getComputedStyle(overlay);
          return {
            backgroundImage: styles.backgroundImage,
            backgroundSize: styles.backgroundSize,
            backgroundPosition: styles.backgroundPosition,
          };
        }),
      };
    });
    expect(effectState.rendered).toBe(true);
    expect(effectState.effectCount).toBeGreaterThan(0);
    expect(effectState.overlayText).toBe('TTTT');
    expect(effectState.contentText).toBe('TTTT');
    expect(effectState.overlayBackgrounds.length).toBeGreaterThan(0);
    expect(effectState.overlayBackgrounds[0]?.backgroundImage).toContain(
      'linear-gradient',
    );
    if (effectState.overlayBackgrounds.length > 1) {
      expect(
        new Set(
          effectState.overlayBackgrounds.map(
            (overlay) => overlay.backgroundSize,
          ),
        ).size,
      ).toBe(1);
      expect(
        new Set(
          effectState.overlayBackgrounds.map(
            (overlay) => overlay.backgroundPosition,
          ),
        ).size,
      ).toBeGreaterThan(1);
    }
  });
});
