// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XAudioTT
 *
 * `x-audio-tt` provides audio playback functionality.
 *
 * Attributes:
 * - `src`: JSON string containing audio source info (`{id, play_url}`).
 * - `loop`: 'true' | 'false', whether to loop playback.
 * - `pause-on-hide`: 'true' | 'false', whether to pause when document is hidden.
 *
 * Methods:
 * - `play()`: Starts playback.
 * - `pause()`: Pauses playback.
 * - `stop()`: Stops playback.
 * - `resume()`: Resumes playback.
 * - `seek({ currentTime })`: Seeks to time (in ms).
 * - `mute({ mute })`: Mutes/unmutes.
 * - `setVolume({ volume })`: Sets volume (0-1).
 * - `playerInfo()`: Returns current player state.
 */
export { XAudioTT } from './XAudioTT.js';
