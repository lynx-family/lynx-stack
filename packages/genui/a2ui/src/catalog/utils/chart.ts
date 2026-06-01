// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEFAULT_CHART_COLORS = [
  '#0057d9',
  '#0a8f8f',
  '#8a5cf6',
  '#d92d20',
  '#2d6a4f',
  '#b26a00',
] as const;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value) >= 1000
    ? Math.round(value)
    : Number(value.toFixed(1));
  return String(rounded);
}
