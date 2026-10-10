// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import {
  benchHtmlCaptureDocument,
  benchPixelsToBmp,
  startBenchHtmlCapture,
} from './benchHtmlCapture.js';

afterEach(() => {
  rstest.useRealTimers();
  rstest.unstubAllGlobals();
});

const HTML = '<!doctype html><html><head></head><body>Hello</body></html>';

test('installs capture policy ahead of generated content and rejects partial HTML', () => {
  expect(benchHtmlCaptureDocument(HTML)).toMatch(
    /^<!doctype html><meta http-equiv="Content-Security-Policy"/u,
  );
  expect(benchHtmlCaptureDocument(HTML)).toContain('default-src \'none\'');
  expect(() => benchHtmlCaptureDocument('<!doctype html><html>')).toThrow(
    'complete',
  );
});

test('browser pixels match the existing BMP fixture including alpha and row order', async () => {
  const bmp = benchPixelsToBmp({
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255,
      0,
      0,
      255,
      0,
      255,
      0,
      128,
      0,
      0,
      255,
      0,
      20,
      40,
      60,
      255,
    ]),
    colorSpace: 'srgb',
  });
  const bytes = new Uint8Array(await bmp.arrayBuffer());
  expect(bmp.type).toBe('image/bmp');
  expect(new DataView(bytes.buffer).getInt32(22, true)).toBe(-2);
  expect(Array.from(bytes.slice(122))).toEqual([
    0,
    0,
    255,
    255,
    0,
    255,
    0,
    128,
    255,
    0,
    0,
    0,
    60,
    40,
    20,
    255,
  ]);
  expect(() =>
    benchPixelsToBmp({
      width: 8192,
      height: 8192,
      data: new Uint8ClampedArray(),
      colorSpace: 'srgb',
    })
  ).toThrow('dimensions');
});

function mockBrowser() {
  const track = Object.assign(new EventTarget(), {
    stop: rstest.fn(),
    getSettings: () => ({ displaySurface: 'browser' }),
    restrictTo: rstest.fn().mockResolvedValue(undefined),
  });
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const getDisplayMedia = rstest.fn().mockResolvedValue(stream);
  const remove = rstest.fn();
  const iframe = {
    style: {},
    setAttribute: rstest.fn(),
    onload: undefined as (() => void) | null | undefined,
  };
  const drawImage = rstest.fn();
  rstest.stubGlobal('window', {
    addEventListener: rstest.fn(),
    removeEventListener: rstest.fn(),
    RestrictionTarget: { fromElement: () => Promise.resolve({}) },
    BrowserCaptureMediaStreamTrack: {
      prototype: { restrictTo: track.restrictTo },
    },
  });
  rstest.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });
  rstest.stubGlobal('HTMLVideoElement', {
    prototype: { requestVideoFrameCallback: rstest.fn() },
  });
  rstest.stubGlobal('innerWidth', 800);
  rstest.stubGlobal('innerHeight', 600);
  rstest.stubGlobal('document', {
    createElement: (name: string) => {
      if (name === 'iframe') return iframe;
      if (name === 'canvas') {
        return {
          getContext: () => ({
            drawImage,
            getImageData: () => ({
              width: 1,
              height: 1,
              data: new Uint8ClampedArray(4),
            }),
          }),
        };
      }
      if (name !== 'video') return { style: {}, remove, append: rstest.fn() };
      let onFrame: (() => void) | undefined;
      return {
        videoWidth: 1,
        videoHeight: 1,
        pause: rstest.fn(),
        play: () => {
          // A static source delivers exactly one frame, as playback starts.
          onFrame?.();
          return Promise.resolve();
        },
        requestVideoFrameCallback: (callback: () => void) => {
          onFrame = callback;
          return 1;
        },
        cancelVideoFrameCallback: rstest.fn(),
      };
    },
    body: { append: rstest.fn() },
  });
  return { getDisplayMedia, track, stream, remove, iframe, drawImage };
}

test.each([undefined, 0, 500])(
  'waits for iframe load and screenshot delay %s before reading pixels',
  async screenshotSettleMs => {
    rstest.useFakeTimers();
    const { iframe, drawImage, track } = mockBrowser();
    const controller = new AbortController();
    const capture = await startBenchHtmlCapture(controller.signal);
    const pending = capture({
      source: HTML,
      width: 1,
      height: 1,
      screenshotSettleMs,
    }, controller.signal);
    await rstest.advanceTimersByTimeAsync(1000);
    expect(drawImage).not.toHaveBeenCalled();
    iframe.onload?.();
    await rstest.advanceTimersByTimeAsync(0);
    const delay = screenshotSettleMs ?? 100;
    if (delay > 0) {
      await rstest.advanceTimersByTimeAsync(delay - 1);
      expect(drawImage).not.toHaveBeenCalled();
      expect(track.restrictTo).toHaveBeenCalledTimes(1);
      await rstest.advanceTimersByTimeAsync(1);
    }
    const result = await pending;
    expect(result.type).toBe('image/bmp');
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(track.restrictTo).toHaveBeenCalledTimes(2);
    controller.abort();
  },
);

test('cancels a long settle delay and releases the timer and capture target', async () => {
  rstest.useFakeTimers();
  const { iframe, drawImage, remove, track } = mockBrowser();
  const controller = new AbortController();
  const capture = await startBenchHtmlCapture(controller.signal);
  const pending = capture({
    source: HTML,
    width: 1,
    height: 1,
    screenshotSettleMs: Number.MAX_SAFE_INTEGER,
  }, controller.signal);
  await rstest.advanceTimersByTimeAsync(0);
  iframe.onload?.();
  await rstest.advanceTimersByTimeAsync(1000);
  expect(drawImage).not.toHaveBeenCalled();
  const rejection = expect(pending).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await rejection;
  expect(rstest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledTimes(2);
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(drawImage).not.toHaveBeenCalled();
});

test('requests native capture synchronously, validates this tab and stops on cancellation', async () => {
  const { getDisplayMedia, track, remove } = mockBrowser();
  const controller = new AbortController();
  const pending = startBenchHtmlCapture(controller.signal);
  expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  await pending;
  expect(track.restrictTo).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  controller.abort();
  expect(track.stop).toHaveBeenCalledTimes(1);
});

test('rejects another tab and releases its media track before a job starts', async () => {
  const { track, remove } = mockBrowser();
  track.restrictTo.mockRejectedValue(new Error('Not self-capture'));
  await expect(startBenchHtmlCapture(new AbortController().signal)).rejects
    .toThrow('current Bench tab');
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});

test('stops a stream granted after the permission request was cancelled', async () => {
  const { getDisplayMedia, track, stream } = mockBrowser();
  let grant!: (value: unknown) => void;
  getDisplayMedia.mockImplementation(() =>
    new Promise((resolve) => {
      grant = resolve;
    })
  );
  const controller = new AbortController();
  const pending = startBenchHtmlCapture(controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  grant(stream);
  await Promise.resolve();
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(track.restrictTo).not.toHaveBeenCalled();
});

test('permission denial does not create a capture target', async () => {
  const { getDisplayMedia, track } = mockBrowser();
  getDisplayMedia.mockRejectedValue(new Error('Permission denied'));
  await expect(startBenchHtmlCapture(new AbortController().signal)).rejects
    .toThrow('Permission denied');
  expect(track.restrictTo).not.toHaveBeenCalled();
});

test('unsupported browsers fail before requesting sharing', async () => {
  const { getDisplayMedia } = mockBrowser();
  rstest.stubGlobal('window', {});
  await expect(startBenchHtmlCapture(new AbortController().signal)).rejects
    .toThrow('Element Capture');
  expect(getDisplayMedia).not.toHaveBeenCalled();
});
