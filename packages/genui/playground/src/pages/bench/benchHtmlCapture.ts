// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Browser capture uses Web APIs. */

import { HTML_PREVIEW_SANDBOX } from '../../components/HtmlView.js';

interface ElementCaptureTrack extends MediaStreamTrack {
  restrictTo(target: unknown): Promise<void>;
}

type ElementCaptureWindow = Window & typeof globalThis & {
  RestrictionTarget?: { fromElement(element: Element): Promise<unknown> };
  BrowserCaptureMediaStreamTrack?: { prototype: Partial<ElementCaptureTrack> };
};

export interface BenchHtmlCaptureRequest {
  source: string;
  width: number;
  height: number;
}

export type BenchHtmlCapture = (
  request: BenchHtmlCaptureRequest,
  signal: AbortSignal,
) => Promise<Blob>;

/** Keep generated resources local while retaining inline HTML interactions. */
export function benchHtmlCaptureDocument(source: string): string {
  if (
    new TextEncoder().encode(source).byteLength > 10 * 1024 * 1024
    || !/^<!doctype\s+html\s*>/iu.test(source)
    || !source.trimEnd().toLowerCase().endsWith('</html>')
  ) throw new Error('HTML capture requires a complete, bounded HTML document.');
  const policy = [
    'default-src \'none\'',
    'script-src \'unsafe-inline\'',
    'style-src \'unsafe-inline\'',
    'img-src data:',
    'font-src data:',
    'base-uri \'none\'',
    'form-action \'none\'',
  ].join('; ');
  // Insert before any model-authored markup; a later policy cannot relax it.
  return source.replace(
    /^<!doctype\s+html\s*>/iu,
    `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">`,
  );
}

/** Match the existing capture transport's top-down, RGBA BITMAPV4HEADER. */
export function benchPixelsToBmp(pixels: ImageData): Blob {
  const { width, height, data } = pixels;
  if (
    !Number.isInteger(width) || !Number.isInteger(height)
    || width <= 0 || height <= 0 || width > 8192 || height > 8192
    || width * height * 4 > 10 * 1024 * 1024
    || data.length !== width * height * 4
  ) throw new Error('Invalid HTML screenshot dimensions.');
  const bytes = new Uint8Array(122 + data.length);
  const header = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4d]);
  header.setUint32(2, bytes.length, true);
  header.setUint32(10, 122, true);
  header.setUint32(14, 108, true);
  header.setInt32(18, width, true);
  header.setInt32(22, -height, true);
  header.setUint16(26, 1, true);
  header.setUint16(28, 32, true);
  header.setUint32(30, 3, true);
  header.setUint32(34, data.length, true);
  header.setUint32(54, 0x00ff0000, true);
  header.setUint32(58, 0x0000ff00, true);
  header.setUint32(62, 0x000000ff, true);
  header.setUint32(66, 0xff000000, true);
  header.setUint32(70, 0x73524742, true); // sRGB
  for (let offset = 0; offset < data.length; offset += 4) {
    bytes[122 + offset] = data[offset + 2]!;
    bytes[122 + offset + 1] = data[offset + 1]!;
    bytes[122 + offset + 2] = data[offset]!;
    bytes[122 + offset + 3] = data[offset + 3]!;
  }
  return new Blob([bytes], { type: 'image/bmp' });
}

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        abort = () =>
          reject(
            signal.reason instanceof Error
              ? signal.reason
              : new Error('HTML capture cancelled.'),
          );
        signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
}

async function firstFrame(video: HTMLVideoElement, signal: AbortSignal) {
  let callback = 0;
  try {
    const frame = new Promise<void>((resolve) => {
      callback = video.requestVideoFrameCallback(() => resolve());
    });
    // Static tabs need not produce another frame. Subscribe before playback,
    // otherwise play() can consume the only frame before we start waiting.
    await abortable(Promise.all([frame, video.play()]), signal);
  } finally {
    video.cancelVideoFrameCallback(callback);
  }
}

/** Invoke directly from Start run, before awaiting network or cancellation work. */
export async function startBenchHtmlCapture(
  signal: AbortSignal,
): Promise<BenchHtmlCapture> {
  signal.throwIfAborted();
  const host = window as ElementCaptureWindow;
  const targets = host.RestrictionTarget;
  if (
    !navigator.mediaDevices?.getDisplayMedia || !targets?.fromElement
    || !host.BrowserCaptureMediaStreamTrack?.prototype.restrictTo
    || !HTMLVideoElement.prototype.requestVideoFrameCallback
  ) {
    throw new Error(
      'HTML Judge needs a desktop browser with Element Capture (Chrome 132+), on HTTPS or localhost.',
    );
  }
  const displayOptions = {
    audio: false,
    video: { displaySurface: 'browser' },
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'exclude',
  };
  // The browser requires a user gesture and an explicit current-tab selection.
  const pendingStream = navigator.mediaDevices.getDisplayMedia(displayOptions);
  // A cancelled permission picker can still resolve later. Always stop that stream.
  void pendingStream.then((stream) => {
    if (signal.aborted) stream.getTracks().forEach((track) => track.stop());
  }, () => undefined);
  const stream = await abortable(pendingStream, signal);
  const keepAlive = document.createElement('video');
  keepAlive.muted = true;
  keepAlive.playsInline = true;
  const stop = () => {
    stream.getTracks().forEach((track) => track.stop());
    keepAlive.pause();
    keepAlive.srcObject = null;
  };
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) {
    stop();
    signal.throwIfAborted();
  }
  const track = stream.getVideoTracks()[0] as ElementCaptureTrack | undefined;
  if (!track?.restrictTo || track.getSettings().displaySurface !== 'browser') {
    stop();
    signal.removeEventListener('abort', stop);
    throw new Error(
      'Could not start HTML capture. Select the current Bench tab in the browser sharing dialog.',
    );
  }
  const probe = document.createElement('div');
  Object.assign(probe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '1px',
    height: '1px',
    isolation: 'isolate',
    background: 'white',
  });
  document.body.append(probe);
  const startupSignal = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  try {
    // restrictTo accepts only self-capture. Reject another tab before creating
    // a server job or making any model calls.
    const target = await abortable(targets.fromElement(probe), startupSignal);
    await abortable(track.restrictTo(target), startupSignal);
    // Keep a consumer attached between tasks. With no consumers Chromium can
    // suspend the track, leaving a subsequent restrictTo waiting for a frame.
    keepAlive.srcObject = stream;
    await firstFrame(keepAlive, startupSignal);
  } catch {
    stop();
    signal.removeEventListener('abort', stop);
    signal.throwIfAborted();
    throw new Error(
      'Could not start HTML capture. Select the current Bench tab in the browser sharing dialog.',
    );
  } finally {
    probe.remove();
  }
  const ended = new AbortController();
  track.addEventListener('ended', () => {
    ended.abort(
      new Error('HTML capture stopped. Start a new run and share this tab.'),
    );
  }, { once: true });

  // A stream has one restriction target at a time. Serialize HTML captures even
  // when generation or native capture runs concurrently, and recover after errors.
  let queue: Promise<unknown> = Promise.resolve();
  return (request, captureSignal) => {
    const taskSignal = AbortSignal.any([
      signal,
      captureSignal,
      ended.signal,
      AbortSignal.timeout(60_000),
    ]);
    const result = queue.then(async () => {
      taskSignal.throwIfAborted();
      const { width, height } = request;
      if (
        !Number.isInteger(width) || !Number.isInteger(height)
        || width < 1 || height < 1 || width > 8192 || height > 8192
        || width * height * 4 > 10 * 1024 * 1024
      ) throw new Error('Invalid HTML capture viewport.');
      const source = benchHtmlCaptureDocument(request.source);
      const target = document.createElement('div');
      const iframe = document.createElement('iframe');
      const video = document.createElement('video');
      Object.assign(target.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: `${width}px`,
        height: `${height}px`,
        isolation: 'isolate',
        background: 'white',
        overflow: 'hidden',
        zIndex: '2147483647',
        pointerEvents: 'none',
      });
      // Preserve the iframe's CSS viewport on smaller windows. Only its displayed
      // size changes; the output always uses the requested screenshot dimensions.
      const fit = () => {
        target.style.transformOrigin = 'top left';
        target.style.transform = `scale(${
          Math.min(1, innerWidth / width, innerHeight / height)
        })`;
      };
      fit();
      window.addEventListener('resize', fit);
      iframe.title = 'HTML Bench capture';
      iframe.setAttribute('sandbox', HTML_PREVIEW_SANDBOX);
      iframe.referrerPolicy = 'no-referrer';
      iframe.tabIndex = -1;
      Object.assign(iframe.style, {
        width: '100%',
        height: '100%',
        border: '0',
        display: 'block',
      });
      video.muted = true;
      video.playsInline = true;
      try {
        const loaded = new Promise<void>((resolve) => {
          iframe.onload = () => resolve();
        });
        iframe.srcdoc = source;
        target.append(iframe);
        document.body.append(target);
        await abortable(loaded, taskSignal);
        const restriction = await abortable(
          targets.fromElement(target),
          taskSignal,
        );
        try {
          await abortable(track.restrictTo(restriction), taskSignal);
        } catch {
          taskSignal.throwIfAborted();
          throw new Error(
            'Could not capture HTML. Share the current Bench tab.',
          );
        }
        // Attach only AFTER restriction. Never read an uncropped frame containing
        // the Playground or another tab, including stale frames from a prior task.
        video.srcObject = stream;
        await firstFrame(video, taskSignal);
        taskSignal.throwIfAborted();
        if (!video.videoWidth || !video.videoHeight) {
          throw new Error('HTML capture returned an empty frame.');
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('HTML screenshot canvas is unavailable.');
        context.drawImage(video, 0, 0, width, height);
        return benchPixelsToBmp(context.getImageData(0, 0, width, height));
      } finally {
        video.pause();
        video.srcObject = null;
        iframe.onload = null;
        target.remove();
        window.removeEventListener('resize', fit);
        // Keep the track restricted to the removed target between tasks.
      }
    });
    queue = result.catch(() => undefined);
    return abortable(result, taskSignal);
  };
}
