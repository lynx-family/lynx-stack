// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
/* eslint-disable n/no-unsupported-features/node-builtins -- Tests use browser APIs in jsdom. */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import { toBlob } from 'html-to-image';

import { createBenchReportImage } from './benchReportImage.js';

rstest.mock('html-to-image', () => ({ toBlob: rstest.fn() }));

describe('local report image capture', () => {
  let source: HTMLDivElement;
  let height: number;
  const png = new Blob(['PNG'], { type: 'image/png' });

  beforeEach(() => {
    height = 2000;
    source = document.createElement('div');
    source.className = 'publishedReportContent';
    source.innerHTML =
      '<h1>Bench report</h1><button data-report-image-exclude>Export</button>'
      + '<details open><summary>Run evidence</summary><p>Saved result</p></details>'
      + '<details><summary>Plan</summary><p>Collapsed content</p></details>'
      + '<div class="publishedReportTableWrap"><table><tr><td>Score</td></tr></table></div>';
    document.body.append(source);
    rstest.spyOn(source, 'getBoundingClientRect').mockReturnValue(
      { width: 900 } as DOMRect,
    );
    rstest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(() => height);
    rstest.mocked(toBlob).mockReset().mockResolvedValue(png);
    rstest.stubGlobal('fetch', rstest.fn());
  });

  afterEach(() => {
    source.remove();
    rstest.restoreAllMocks();
    rstest.unstubAllGlobals();
    rstest.useRealTimers();
  });

  test('captures the complete cloned page and screenshots without changing the live report', async () => {
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,cG5n';
    source.append(img);
    const decode = rstest.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: decode,
    });
    const before = source.innerHTML;
    source.scrollTop = 400;
    rstest.mocked(toBlob).mockImplementationOnce(async (clone, options) => {
      expect(clone).not.toBe(source);
      expect(clone.isConnected).toBe(true);
      expect(clone.textContent).toContain('Saved result');
      expect(clone.querySelector('button')).toBeNull();
      expect(
        [...clone.querySelectorAll('details')].map((details) => details.open),
      ).toEqual([true, false]);
      expect(clone.querySelector('img')?.src).toBe(img.src);
      expect(options).toMatchObject({
        width: 900,
        height: 2000,
        pixelRatio: 2,
        skipFonts: true,
      });
      return png;
    });
    expect(await createBenchReportImage(source)).toBe(png);
    expect(decode).toHaveBeenCalled();
    expect(source.innerHTML).toBe(before);
    expect(source.scrollTop).toBe(400);
    expect(document.querySelector('.publishedReportPage')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
  });

  test('expands wide tables and bounds the output pixel count for long pages', async () => {
    height = 16000;
    rstest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
      1200,
    );
    await createBenchReportImage(source);
    const [clone, options] = rstest.mocked(toBlob).mock.calls[0]!;
    expect(options?.width).toBe(1296);
    expect(options?.height).toBe(height);
    expect(options!.width! * height * options!.pixelRatio! ** 2)
      .toBeLessThanOrEqual(16_000_001);
    expect(
      clone.querySelector<HTMLElement>('.publishedReportTableWrap')?.style
        .overflow,
    ).toBe('visible');
  });

  test('rejects screenshots that would require a network request', async () => {
    const img = document.createElement('img');
    img.src = 'https://example.test/screenshot.png';
    source.append(img);
    await expect(createBenchReportImage(source)).rejects.toThrow(
      'cannot be exported locally',
    );
    expect(toBlob).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('.publishedReportPage')).toBeNull();
  });

  test('rejects reports that exceed canvas limits without attempting rasterization', async () => {
    height = 100000;
    await expect(createBenchReportImage(source)).rejects.toThrow('too long');
    expect(toBlob).not.toHaveBeenCalled();
    expect(document.querySelector('.publishedReportPage')).toBeNull();
  });

  test('cleans up after failed rasterization', async () => {
    rstest.mocked(toBlob).mockResolvedValueOnce(null);
    await expect(createBenchReportImage(source)).rejects.toThrow(
      'could not create a PNG',
    );
    expect(document.querySelector('.publishedReportPage')).toBeNull();
  });

  test('times out stalled capture and removes its offscreen DOM', async () => {
    rstest.useFakeTimers();
    rstest.mocked(toBlob).mockImplementationOnce(() =>
      new Promise(() => {
        // Deliberately stalled rasterizer.
      })
    );
    const assertion = expect(createBenchReportImage(source)).rejects.toThrow(
      'timed out',
    );
    await rstest.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(document.querySelector('.publishedReportPage')).toBeNull();
  });
});
