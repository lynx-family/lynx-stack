// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { samples } from './samples.js';

export interface CodeState {
  mainThread: string;
  background: string;
  css: string;
}

type InitialState =
  | { type: 'custom'; code: CodeState }
  | { type: 'sample'; sampleIndex: number }
  | null;

/**
 * Base64-encode a CodeState object (UTF-8 safe via TextEncoder).
 */
export function encodeCode(code: CodeState): string {
  const json = JSON.stringify({
    mainThread: code.mainThread,
    background: code.background,
    css: code.css,
  });
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Base64-decode a CodeState object. Returns null on failure.
 */
function decodeCode(encoded: string): CodeState | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CodeState>;
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
    console.error('Failed to decode URL code');
  }
  return null;
}

/**
 * Read the initial state from the URL hash.
 * Priority: #c= (custom code) > #s= (sample index) > null (fallback).
 */
export function getInitialState(): InitialState {
  const params = new URLSearchParams(window.location.hash.slice(1));

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
 * Update the URL hash with encoded custom code (replaceState to avoid history spam).
 */
export function saveToUrl(code: CodeState): void {
  const encoded = encodeCode(code);
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.delete('s');
  params.set('c', encoded);
  const url = new URL(window.location.href);
  url.hash = params.toString();
  window.history.replaceState({}, '', url);
}

/**
 * Update the URL hash with a sample index.
 */
export function saveSampleToUrl(sampleIndex: number): void {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.delete('c');
  params.set('s', String(sampleIndex));
  const url = new URL(window.location.href);
  url.hash = params.toString();
  window.history.replaceState({}, '', url);
}
