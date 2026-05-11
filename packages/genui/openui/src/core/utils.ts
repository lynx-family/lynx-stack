// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
function generateRandomKey(): string {
  return `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getScalarLabel(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value);
    return text.length > 0 ? text : null;
  }
  return null;
}

function appendFallback(prefix: string, fallback: string): string {
  return prefix + '-' + fallback;
}

export function keyFrom(value: unknown, fallbackIndex?: number): string {
  const getFallback = () =>
    fallbackIndex === undefined ? generateRandomKey() : String(fallbackIndex);

  if (value === null || value === undefined) {
    return getFallback();
  }

  const t = typeof value;
  if (t === 'string') {
    const str = getScalarLabel(value);
    if (str && str.length > 0) {
      return appendFallback(str, getFallback());
    }
    return getFallback();
  }

  if (t === 'number') {
    const str = getScalarLabel(value);
    if (str && str.length > 0) {
      return appendFallback(str, getFallback());
    }
    return getFallback();
  }

  if (t === 'boolean') {
    const str = value ? 'true' : 'false';
    if (str && str.length > 0) {
      return appendFallback(str, getFallback());
    }
    return getFallback();
  }

  if (Array.isArray(value)) {
    const parts = value.map((v, i) => keyFrom(v, i)).filter(Boolean);
    return `arr-${parts.join('-')}-${getFallback()}`;
  }

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.type === 'element') {
      const typeName = typeof obj.typeName === 'string'
        ? obj.typeName
        : 'element';
      const props = (obj.props as Record<string, unknown> | undefined) ?? {};
      const label = props.label ?? props.title ?? props.text ?? props.value
        ?? props.name;
      const labelStr = getScalarLabel(label);
      if (labelStr) {
        return `${typeName}:${labelStr}-${getFallback()}`;
      }
      return `${typeName}-${getFallback()}`;
    }

    try {
      const str = JSON.stringify(obj);
      if (str && str.length > 0 && str !== '{}') {
        const base = str.length > 50 ? str.slice(0, 50) : str;
        return `obj-${base}-${getFallback()}`;
      }
    } catch {}
    return `obj-${getFallback()}`;
  }

  return getFallback();
}
