// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { setTimeout as sleep } from 'node:timers/promises';

import type { DeviceAction, Size } from '@midscene/core';
import {
  defineActionSwipe,
  defineActionTap,
  normalizeMobileSwipeParam,
} from '@midscene/core/device';

import type { KittenLynxJudgePage } from '../types.js';
import { getImageFormat, getImageSize } from './image-size.js';

interface KittenLynxChannel {
  send(method: string, params: Record<string, unknown>): Promise<unknown>;
}

type KittenLynxViewWithChannel = KittenLynxJudgePage & {
  _channel?: KittenLynxChannel;
};

type TouchEventType = 'mousePressed' | 'mouseMoved' | 'mouseReleased';

interface TouchPoint {
  x: number;
  y: number;
}

interface ScreenshotSnapshot {
  base64: string;
  size: Size;
}

export class KittenLynxMidscenePage {
  interfaceType = 'lynx-android';

  private screenshotSnapshot: Promise<ScreenshotSnapshot> | undefined;

  constructor(private readonly page: KittenLynxJudgePage) {}

  actionSpace(): DeviceAction[] {
    return [
      defineActionTap(async ({ locate }) => {
        await this.tapAt({
          x: locate.center[0],
          y: locate.center[1],
        });
      }),
      defineActionSwipe(async (param) => {
        const swipe = normalizeMobileSwipeParam(param, await this.size());
        for (let index = 0; index < swipe.repeatCount; index++) {
          await this.swipe(swipe.startPoint, swipe.endPoint, swipe.duration);
        }
      }),
    ];
  }

  async screenshotBase64(): Promise<string> {
    const screenshot = await this.captureScreenshot();
    return screenshot.base64;
  }

  async size(): Promise<Size> {
    const screenshot = await this.captureScreenshot();
    return screenshot.size;
  }

  url(): string {
    return this.page.url();
  }

  describe(): string {
    return this.page.url();
  }

  beforeInvokeAction(): Promise<void> {
    this.screenshotSnapshot = undefined;
    return Promise.resolve();
  }

  afterInvokeAction(): Promise<void> {
    this.screenshotSnapshot = undefined;
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    this.screenshotSnapshot = undefined;
    return Promise.resolve();
  }

  private async captureScreenshot(): Promise<ScreenshotSnapshot> {
    this.screenshotSnapshot ??= this.page.screenshot({ format: 'png' }).then(
      (buffer: Buffer) => {
        const format = getImageFormat(buffer);
        return {
          base64: `data:image/${format};base64,${buffer.toString('base64')}`,
          size: getImageSize(buffer, format),
        };
      },
    ).catch((error: unknown) => {
      this.screenshotSnapshot = undefined;
      throw error;
    });

    return await this.screenshotSnapshot;
  }

  private async tapAt(point: TouchPoint): Promise<void> {
    await this.touch('mousePressed', point);
    await sleep(50);
    await this.touch('mouseReleased', point);
  }

  private async swipe(
    startPoint: TouchPoint,
    endPoint: TouchPoint,
    duration: number,
  ): Promise<void> {
    const clampedDuration = Math.max(0, Math.min(duration, 1000));
    const phaseDuration = clampedDuration / 2;

    await this.touch('mousePressed', startPoint);
    await sleep(phaseDuration);
    await this.touch('mouseMoved', endPoint);
    await sleep(phaseDuration);
    await this.touch('mouseReleased', endPoint);
  }

  private async touch(type: TouchEventType, point: TouchPoint): Promise<void> {
    await this.getChannel().send('Input.emulateTouchFromMouseEvent', {
      button: 'left',
      type,
      x: point.x,
      y: point.y,
    });
  }

  private getChannel(): KittenLynxChannel {
    const channel = (this.page as KittenLynxViewWithChannel)._channel;
    if (!channel) {
      throw new Error(
        'Kitten-Lynx page is not attached yet. Call page.goto() before judgeAndroidAgent().',
      );
    }

    return channel;
  }
}

export function isKittenLynxPage(page: unknown): page is KittenLynxJudgePage {
  return typeof page === 'object'
    && page !== null
    && 'screenshot' in page
    && 'url' in page
    && typeof page.screenshot === 'function'
    && typeof page.url === 'function';
}

export function getKittenLynxPageUrl(
  page: KittenLynxJudgePage | undefined,
): string {
  try {
    return isKittenLynxPage(page) ? page.url() : '';
  } catch {
    return '';
  }
}
