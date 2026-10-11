/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import {
  type AttributeReactiveClass,
  bindToAttribute,
  bindToStyle,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';
import type { XVideo } from './XVideo.js';

export class XVideoAttribute
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'src',
    'loop',
    'volume',
    'muted',
    'speed',
    'object-fit',
  ];

  #dom: XVideo;

  #getVideoElement = genDomGetter<HTMLVideoElement>(
    () => this.#dom.shadowRoot!,
    '#video',
  );

  @registerAttributeHandler('src', true)
  _handleSrc = bindToAttribute(this.#getVideoElement, 'src');

  @registerAttributeHandler('loop', true)
  _handleLoop = bindToAttribute(this.#getVideoElement, 'loop');

  @registerAttributeHandler('muted', true)
  _handleMuted = bindToAttribute(this.#getVideoElement, 'muted');

  @registerAttributeHandler('volume', true)
  _handleVolume(newValue: string | null) {
    const video = this.#getVideoElement();
    const parsed = newValue === null ? 1 : Number(newValue);
    if (Number.isFinite(parsed)) {
      video.volume = Math.min(1, Math.max(0, parsed));
    }
  }

  @registerAttributeHandler('speed', true)
  _handleSpeed(newValue: string | null) {
    const video = this.#getVideoElement();
    const parsed = newValue === null ? 1 : Number(newValue);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(2.0, Math.max(0.1, parsed));
      // The HTML media load algorithm (triggered by src changes) resets
      // playbackRate to defaultPlaybackRate, so set both to survive loads.
      video.defaultPlaybackRate = clamped;
      video.playbackRate = clamped;
    }
  }

  @registerAttributeHandler('object-fit', true)
  _handleObjectFit = bindToStyle(this.#getVideoElement, 'object-fit');

  constructor(dom: XVideo) {
    this.#dom = dom;
  }
}
