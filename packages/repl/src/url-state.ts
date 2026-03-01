import { samples } from './samples.js';

export type CodeState = {
  mainThread: string;
  background: string;
  css: string;
};

type InitialState =
  | { type: 'custom'; code: CodeState }
  | { type: 'sample'; sampleIndex: number }
  | null;

/**
 * Base64-encode a CodeState object (UTF-8 safe).
 */
export function encodeCode(code: CodeState): string {
  const json = JSON.stringify({
    mainThread: code.mainThread,
    background: code.background,
    css: code.css,
  });
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Base64-decode a CodeState object. Returns null on failure.
 */
function decodeCode(encoded: string): CodeState | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as CodeState;
    if (typeof parsed.mainThread === 'string') {
      return {
        mainThread: parsed.mainThread,
        background: parsed.background ?? '',
        css: parsed.css ?? '',
      };
    }
  } catch {
    console.error('Failed to decode URL code');
  }
  return null;
}

/**
 * Read the initial state from the URL.
 * Priority: ?c= (custom code) > ?s= (sample index) > null (fallback).
 */
export function getInitialState(): InitialState {
  const params = new URLSearchParams(window.location.search);

  const encodedCode = params.get('c');
  if (encodedCode) {
    const code = decodeCode(encodedCode);
    if (code) return { type: 'custom', code };
  }

  const sampleParam = params.get('s');
  if (sampleParam !== null) {
    const index = Number(sampleParam);
    if (Number.isInteger(index) && index >= 0 && index < samples.length) {
      return { type: 'sample', sampleIndex: index };
    }
  }

  return null;
}

/**
 * Update the URL with encoded custom code (replaceState to avoid history spam).
 */
export function saveToUrl(code: CodeState): void {
  const encoded = encodeCode(code);
  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  url.searchParams.set('c', encoded);
  window.history.replaceState({}, '', url);
}

/**
 * Update the URL with a sample index.
 */
export function saveSampleToUrl(sampleIndex: number): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('c');
  url.searchParams.set('s', String(sampleIndex));
  window.history.replaceState({}, '', url);
}
