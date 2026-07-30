// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type BenchLocale = 'en-US' | 'zh-CN';

export const DEFAULT_BENCH_LOCALE: BenchLocale = 'zh-CN';
export const BENCH_LOCALE_STORAGE_KEY = 'lynx-genui-bench-locale';

export function parseBenchLocale(value: unknown): BenchLocale | null {
  return value === 'en-US' || value === 'zh-CN' ? value : null;
}

export function readBenchLocale(): BenchLocale {
  try {
    return parseBenchLocale(
      window.localStorage.getItem(BENCH_LOCALE_STORAGE_KEY),
    ) ?? DEFAULT_BENCH_LOCALE;
  } catch {
    return DEFAULT_BENCH_LOCALE;
  }
}

export function writeBenchLocale(locale: BenchLocale): void {
  try {
    window.localStorage.setItem(BENCH_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore localStorage errors and keep the in-memory preference.
  }
}
