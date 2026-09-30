// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../../types/index.js';
import type {
  LynxClipboardModuleCallResult,
  LynxClipboardWriteTextData,
} from '../../nativeModules/LynxClipboardModule.js';

function toCloneableError(error: unknown): {
  name: string;
  message: string;
} {
  if (typeof error === 'object' && error !== null) {
    const errorLike = error as { name?: unknown; message?: unknown };
    if (
      typeof errorLike.name === 'string'
      && typeof errorLike.message === 'string'
    ) {
      return { name: errorLike.name, message: errorLike.message };
    }
  }
  return { name: 'Error', message: String(error) };
}

export async function handleLynxClipboardModuleCall(
  name: string,
  data: Cloneable,
  clipboard?: Clipboard,
): Promise<LynxClipboardModuleCallResult> {
  try {
    const targetClipboard = clipboard ?? globalThis.window?.navigator.clipboard;
    if (targetClipboard === undefined) {
      throw new Error('The browser Clipboard API is unavailable.');
    }

    switch (name) {
      case 'readText':
        return { ok: true, value: await targetClipboard.readText() };
      case 'writeText': {
        const { text } = data as unknown as LynxClipboardWriteTextData;
        await targetClipboard.writeText(text);
        return { ok: true, value: undefined };
      }
      default:
        throw new TypeError(
          `Unsupported LynxClipboardModule method: ${name}`,
        );
    }
  } catch (error) {
    return { ok: false, error: toCloneableError(error) };
  }
}
