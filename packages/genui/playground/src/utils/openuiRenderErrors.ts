// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { RENDER_NAVIGATION_TOKEN_QUERY_PARAM } from './renderUrl.js';
import {
  OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
  readOpenUIRenderErrors,
} from '../../lynx-src/openui/renderErrors.js';
import type { OpenUIRenderError } from '../../lynx-src/openui/renderErrors.js';

/** Accept diagnostics only from the current preview document in this panel. */
export function readOpenUIRenderErrorEvent(
  event: { data: unknown; origin: string; source: unknown },
  frameSrc: string,
  frames: readonly { src: string; contentWindow: unknown }[],
): OpenUIRenderError[] | null {
  let url: URL;
  try {
    url = new URL(frameSrc);
  } catch {
    return null;
  }
  const token = url.searchParams.get(RENDER_NAVIGATION_TOKEN_QUERY_PARAM);
  if (!token || event.origin !== url.origin || !event.source) return null;
  if (
    !frames.some((frame) =>
      frame.src === frameSrc && frame.contentWindow === event.source
    )
  ) return null;
  const data = event.data;
  if (!data || typeof data !== 'object') return null;
  if (
    !('type' in data) || data.type !== OPENUI_RENDER_ERRORS_MESSAGE_TYPE
    || !('navigationToken' in data) || data.navigationToken !== token
  ) return null;
  return readOpenUIRenderErrors(data);
}
