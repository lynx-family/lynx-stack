// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIMessage } from './a2ui-validator';

interface ImagePathRef {
  surfaceId: string;
  path: string;
  fallbackQuery: string;
}

interface PexelsPhoto {
  src?: {
    large2x?: string;
    large?: string;
    medium?: string;
    original?: string;
  };
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
}

const IMAGE_CACHE_MAX_ENTRIES = readPositiveIntegerEnv(
  'A2UI_IMAGE_CACHE_MAX_ENTRIES',
  1000,
);
const PEXELS_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
  'A2UI_PEXELS_REQUEST_TIMEOUT_MS',
  5000,
);

class LruCache<K, V> {
  private readonly entries = new Map<K, V>();

  public constructor(private readonly maxEntries: number) {}

  public get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  public set(key: K, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, value);

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }
}

const imageCache = new LruCache<string, Promise<string>>(
  IMAGE_CACHE_MAX_ENTRIES,
);

export async function resolveA2UIImageUrls(
  messages: A2UIMessage[],
): Promise<A2UIMessage[]> {
  const cloned = cloneMessages(messages);
  const imagePathRefs: ImagePathRef[] = [];

  const staticResolutions: Promise<void>[] = [];
  for (const message of cloned) {
    if (!('updateComponents' in message) || !message.updateComponents) {
      continue;
    }
    const { surfaceId, components } = message.updateComponents;
    for (const component of components) {
      if (component.component !== 'Image') continue;
      const record = component as Record<string, unknown>;
      const url = record.url;
      const fallbackQuery = queryFromComponent(component.id);
      if (typeof url === 'string') {
        staticResolutions.push(
          resolveImageUrl(url, fallbackQuery).then((resolved) => {
            record.url = resolved;
          }),
        );
      } else if (isRecord(url) && typeof url.path === 'string') {
        imagePathRefs.push({
          surfaceId,
          path: url.path,
          fallbackQuery,
        });
      }
    }
  }

  await Promise.all(staticResolutions);

  const dataResolutions: Promise<void>[] = [];
  for (const message of cloned) {
    if (!('updateDataModel' in message) || !message.updateDataModel) {
      continue;
    }
    const dataModel = message.updateDataModel as
      & typeof message.updateDataModel
      & { value?: unknown };
    if (!('value' in dataModel)) continue;

    const updatePath = dataModel.path ?? '/';
    const refs = imagePathRefs.filter(
      (ref) =>
        ref.surfaceId === dataModel.surfaceId
        && pathContains(updatePath, ref.path),
    );
    const resolvedPaths = new Set<string>();
    for (const ref of refs) {
      const relativePath = relativeJsonPointer(updatePath, ref.path);
      resolvedPaths.add(normalizePointer(relativePath));
      const current = getAtPointer(dataModel.value, relativePath);
      const query = typeof current === 'string' ? current : ref.fallbackQuery;
      dataResolutions.push(
        resolveImageUrl(query, ref.fallbackQuery).then((resolved) => {
          dataModel.value = setAtPointer(
            dataModel.value,
            relativePath,
            resolved,
          );
        }),
      );
    }
    addImageLikeDataResolutions(
      dataModel.value,
      dataModel.value,
      '/',
      resolvedPaths,
      dataResolutions,
    );
  }

  await Promise.all(dataResolutions);
  return cloned;
}

async function resolveImageUrl(
  rawQuery: string,
  fallbackQuery: string,
): Promise<string> {
  const query = normalizeImageQuery(rawQuery, fallbackQuery);
  const cacheKey = query.toLowerCase();
  let cached = imageCache.get(cacheKey);
  if (!cached) {
    cached = resolvePexelsImage(query).then(
      (url) => url ?? picsumUrl(query),
      () => picsumUrl(query),
    );
    imageCache.set(cacheKey, cached);
  }
  return cached;
}

async function resolvePexelsImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', 'landscape');

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PEXELS_REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = await res.json() as PexelsSearchResponse;
    const src = data.photos?.[0]?.src;
    return src?.large2x ?? src?.large ?? src?.medium ?? src?.original ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function picsumUrl(query: string): string {
  return `https://picsum.photos/seed/${
    encodeURIComponent(hashSeed(query))
  }/1024/768`;
}

function normalizeImageQuery(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  try {
    const url = new URL(trimmed);
    const tokens = [
      url.hostname.replace(/\.(?:com|org|net|cn)$/u, ''),
      ...url.pathname.split('/'),
    ];
    const query = tokens.join(' ');
    return cleanupQuery(query) || fallback;
  } catch {
    return cleanupQuery(trimmed) || fallback;
  }
}

function cleanupQuery(value: string): string {
  return value
    .replace(/https?:\/\//giu, ' ')
    .replace(/\.(?:jpg|jpeg|png|webp|gif|avif)\b/giu, ' ')
    .replace(/[_\-./?=&%]+/gu, ' ')
    .replace(/\b\d{2,}\b/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 80);
}

function queryFromComponent(id: string): string {
  return cleanupQuery(id) || 'app interface illustration';
}

function addImageLikeDataResolutions(
  root: unknown,
  value: unknown,
  path: string,
  resolvedPaths: Set<string>,
  resolutions: Promise<void>[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      addImageLikeDataResolutions(
        root,
        item,
        appendPointer(path, String(index)),
        resolvedPaths,
        resolutions,
      )
    );
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = appendPointer(path, key);
    const normalizedChildPath = normalizePointer(childPath);
    if (
      typeof child === 'string'
      && isImageLikeKey(key)
      && !resolvedPaths.has(normalizedChildPath)
    ) {
      resolvedPaths.add(normalizedChildPath);
      resolutions.push(
        resolveImageUrl(child, cleanupQuery(key) || 'image').then(
          (resolved) => {
            setAtPointer(root, childPath, resolved);
          },
        ),
      );
      continue;
    }

    addImageLikeDataResolutions(
      root,
      child,
      childPath,
      resolvedPaths,
      resolutions,
    );
  }
}

function isImageLikeKey(key: string): boolean {
  return /(?:^|[-_])(?:image|photo|picture|avatar|cover|poster|artwork|thumbnail)(?:$|[-_])/iu
    .test(key);
}

function appendPointer(path: string, segment: string): string {
  const encoded = segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
  return path === '/' ? `/${encoded}` : `${path}/${encoded}`;
}

function hashSeed(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return `a2ui-${Math.abs(hash).toString(36)}`;
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cloneMessages(messages: A2UIMessage[]): A2UIMessage[] {
  return JSON.parse(JSON.stringify(messages)) as A2UIMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizePointer(path: string): string {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function pathContains(parent: string, child: string): boolean {
  const normalizedParent = normalizePointer(parent);
  const normalizedChild = normalizePointer(child);
  return normalizedParent === '/'
    || normalizedParent === normalizedChild
    || normalizedChild.startsWith(`${normalizedParent}/`);
}

function relativeJsonPointer(parent: string, child: string): string {
  const normalizedParent = normalizePointer(parent);
  const normalizedChild = normalizePointer(child);
  if (normalizedParent === '/') return normalizedChild;
  if (normalizedParent === normalizedChild) return '/';
  return normalizedChild.slice(normalizedParent.length) || '/';
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
}

function pointerParts(path: string): string[] {
  return normalizePointer(path)
    .split('/')
    .slice(1)
    .filter(Boolean)
    .map((segment) => decodePointerSegment(segment));
}

function getAtPointer(value: unknown, path: string): unknown {
  if (path === '/' || path === '') return value;
  let cursor = value;
  for (const part of pointerParts(path)) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function setAtPointer(
  value: unknown,
  path: string,
  nextValue: unknown,
): unknown {
  if (path === '/' || path === '') return nextValue;
  if (!isRecord(value) && !Array.isArray(value)) return value;

  let cursor = value as Record<string, unknown>;
  const parts = pointerParts(path);
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) return value;
    const child = cursor[part];
    if (!isRecord(child) && !Array.isArray(child)) return value;
    cursor = child as Record<string, unknown>;
  }

  const last = parts[parts.length - 1];
  if (last) cursor[last] = nextValue;
  return value;
}
