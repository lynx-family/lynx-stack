// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XVideo
 *
 * `x-video` plays online video resources by wrapping an HTML5 `<video>` element
 * inside its shadow DOM.
 *
 * Attributes:
 * - `src`: Video URL.
 * - `loop`: Whether to loop playback.
 * - `volume`: Playback volume from `0` to `1`.
 * - `muted`: Whether the video is muted.
 * - `speed`: Playback speed from `0.1` to `2.0`.
 * - `object-fit`: `'contain' | 'cover' | 'fill'`.
 * - `timeupdate-interval`: Minimum interval (sec) for `timeupdate` dispatch.
 *
 * Events: `firstframe`, `playing`, `paused`, `stopped`, `timeupdate`, `ended`,
 *   `looped`, `error`, `buffering`.
 *
 * Methods: `play()`, `pause()`, `stop()`, `seek({ position })`.
 */
export { XVideo } from './XVideo.js';
