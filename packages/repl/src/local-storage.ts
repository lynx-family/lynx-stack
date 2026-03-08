// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const STORAGE_KEY = 'lynx-repl-code';

interface CodeState {
  mainThread: string;
  background: string;
  css: string;
}

export function saveToLocalStorage(code: CodeState): void {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- localStorage is a browser API, not Node.js
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
  } catch {
    // Silently ignore quota errors
  }
}

export function loadFromLocalStorage(): CodeState | null {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- localStorage is a browser API, not Node.js
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CodeState>;
    if (typeof parsed.mainThread === 'string') {
      return {
        mainThread: parsed.mainThread,
        background: typeof parsed.background === 'string'
          ? parsed.background
          : '',
        css: typeof parsed.css === 'string' ? parsed.css : '',
      };
    }
  } catch {
    // Corrupted data — ignore
  }
  return null;
}

export function clearLocalStorage(): void {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- localStorage is a browser API, not Node.js
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore
  }
}
