// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard = window.navigator?.clipboard;
    if (clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the legacy DOM copy path below.
  }

  try {
    if (!document.body) return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
