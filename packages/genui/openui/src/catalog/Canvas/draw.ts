// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

interface Drawing {
  chunks: string[];
  width: number;
  height: number;
  pixelRatio: number;
}

export function drawCanvas(
  chunks: string[],
  width: number,
  height: number,
  name: string,
): void {
  'main thread';
  const root = globalThis.frameElement?.getRootNode() as ShadowRoot | undefined;
  const canvas = root?.getElementById(name) as HTMLCanvasElement | null;
  if (!canvas) return;
  const pixelRatio = globalThis.devicePixelRatio || 1;
  // Keep state on the main-thread node instead of capturing a module WeakMap.
  const target = canvas as HTMLCanvasElement & { __openUIDrawing?: Drawing };
  const previous = target.__openUIDrawing;
  const append = previous !== undefined
    && previous.width === width && previous.height === height
    && previous.pixelRatio === pixelRatio
    && previous.chunks.length <= chunks.length
    && previous.chunks.every((chunk, index) => chunk === chunks[index]);
  const start = append ? previous.chunks.length : 0;
  if (append && start === chunks.length) return;

  if (!append) {
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (!append) ctx.scale(canvas.width / width, canvas.height / height);
  // A failing chunk may have already painted pixels. Force a clean replay on
  // the next update instead of appending to a partially executed drawing.
  delete target.__openUIDrawing;
  for (let index = start; index < chunks.length; index++) {
    eval(chunks[index]!);
  }
  target.__openUIDrawing = { chunks: [...chunks], width, height, pixelRatio };
}
