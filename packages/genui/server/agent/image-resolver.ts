// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIMessage } from './a2ui-validator';

interface ImagePathRef {
  surfaceId: string;
  path: string;
  fallbackQuery: string;
}

interface ImageDataPatch extends Record<string, unknown> {
  surfaceId: string;
  path: string;
  value: string;
}

type A2UIUpdateComponentsMessage = Extract<
  A2UIMessage,
  { updateComponents: unknown }
>;
type A2UIComponent = A2UIUpdateComponentsMessage['updateComponents'][
  'components'
][number];

type A2UIComponentRecord = A2UIComponent & Record<string, unknown>;

interface PendingImageLoadingResult {
  messages: A2UIMessage[];
  replacementCount: number;
}

interface ImageResolutionPlan {
  messages: A2UIMessage[];
  staticResolutions: StaticImageResolution[];
  dataResolutions: Promise<ImageDataPatch>[];
  pendingImageRestores: A2UIMessage[];
}

interface StaticImageResolution {
  surfaceId: string;
  componentId: string;
  promise: Promise<A2UIMessage>;
}

type ImageResolutionResult =
  | {
    kind: 'static';
    index: number;
    message: A2UIMessage;
  }
  | {
    kind: 'data';
    index: number;
    patch: ImageDataPatch;
  };

interface PendingImageResolution {
  promise: Promise<ImageResolutionResult>;
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

export function isLoadableImageSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const src = value.trim();
  if (!src) return false;
  if (/^(?:https?:|data:image\/|blob:|file:)/iu.test(src)) return true;
  if (/^(?:\/|\.\/|\.\.\/)/u.test(src)) return true;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(src);
}

export function isResolvableStaticA2UIImage(
  component: A2UIComponentRecord,
): boolean {
  if (component.component !== 'Image') return false;
  return typeof component.url === 'string'
    && !isLoadableImageSource(component.url);
}

export async function resolveStaticA2UIImageComponent(
  surfaceId: string,
  component: A2UIComponentRecord,
): Promise<A2UIMessage | undefined> {
  if (!isResolvableStaticA2UIImage(component)) return undefined;
  const resolved = await resolveImageUrl(
    component.url as string,
    queryFromComponent(component.id),
  );
  return {
    version: 'v0.9',
    updateComponents: {
      surfaceId,
      components: [
        {
          ...component,
          url: resolved,
        },
      ],
    },
  };
}

export function replacePendingA2UIImagesWithLoading(
  messages: A2UIMessage[],
): PendingImageLoadingResult {
  const cloned = cloneMessages(messages);
  let replacementCount = 0;

  for (const message of cloned) {
    if (!('updateComponents' in message) || !message.updateComponents) {
      continue;
    }
    const { components } = message.updateComponents;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (component.component !== 'Image') continue;
      const record = component as Record<string, unknown>;
      if (isLoadableImageSource(record.url)) continue;
      if (isRecord(record.url) && typeof record.url.path === 'string') continue;

      components[i] = {
        id: component.id,
        component: 'Loading',
        variant: 'block',
      };
      replacementCount++;
    }
  }

  return { messages: cloned, replacementCount };
}

export async function resolveA2UIImageUrls(
  messages: A2UIMessage[],
): Promise<A2UIMessage[]> {
  const plan = createImageResolutionPlan(messages);
  const staticMessages = await Promise.all(
    plan.staticResolutions.map((resolution) => resolution.promise),
  );
  const dataPatches = dedupeImageDataPatches(
    await Promise.all(plan.dataResolutions),
  );
  const appendedMessages: A2UIMessage[] = [];
  appendedMessages.push(
    ...dataPatches.map((patch) => createImageDataPatchMessage(patch)),
  );
  appendedMessages.push(...plan.pendingImageRestores);

  return [
    ...insertStaticImageMessages(
      plan.messages,
      plan.staticResolutions,
      staticMessages,
    ),
    ...appendedMessages,
  ];
}

export async function resolveA2UIImageUrlsIncrementally(
  messages: A2UIMessage[],
  onResolvedMessages: (messages: A2UIMessage[]) => void | Promise<void>,
): Promise<A2UIMessage[]> {
  const plan = createImageResolutionPlan(messages);
  const staticMessages: A2UIMessage[] = [];
  const dataPatches: ImageDataPatch[] = [];
  const yieldedDataPatches = new Set<string>();

  const pending: PendingImageResolution[] = [];
  pending.push(
    ...plan.staticResolutions.map((resolution, index) => ({
      promise: resolution.promise.then((message) => ({
        kind: 'static' as const,
        index,
        message,
      })),
    })),
  );
  pending.push(
    ...plan.dataResolutions.map((promise, index) => ({
      promise: promise.then((patch) => ({
        kind: 'data' as const,
        index,
        patch,
      })),
    })),
  );

  while (pending.length > 0) {
    const next = await Promise.race(
      pending.map(({ promise }, index) =>
        promise.then((result) => ({ result, index }))
      ),
    );
    pending.splice(next.index, 1);

    if (next.result.kind === 'static') {
      staticMessages[next.result.index] = next.result.message;
      await onResolvedMessages([next.result.message]);
      continue;
    }

    dataPatches[next.result.index] = next.result.patch;
    const key = imageDataPatchKey(next.result.patch);
    if (yieldedDataPatches.has(key)) continue;
    yieldedDataPatches.add(key);
    await onResolvedMessages([createImageDataPatchMessage(next.result.patch)]);
  }

  const finalDataPatches = dedupeImageDataPatches(
    dataPatches.filter((patch): patch is ImageDataPatch => Boolean(patch)),
  );
  if (plan.pendingImageRestores.length > 0 && finalDataPatches.length > 0) {
    await onResolvedMessages(plan.pendingImageRestores);
  }

  return [
    ...insertStaticImageMessages(
      plan.messages,
      plan.staticResolutions,
      staticMessages,
    ),
    ...finalDataPatches.map((patch) => createImageDataPatchMessage(patch)),
    ...plan.pendingImageRestores,
  ];
}

function createImageResolutionPlan(
  messages: A2UIMessage[],
): ImageResolutionPlan {
  const cloned = cloneMessages(messages);
  const imagePathRefs: ImagePathRef[] = [];

  const staticResolutions: StaticImageResolution[] = [];
  for (const message of cloned) {
    if (!('updateComponents' in message) || !message.updateComponents) {
      continue;
    }
    const { surfaceId, components } = message.updateComponents;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (!component) continue;
      if (component.component !== 'Image') continue;
      const record = component as Record<string, unknown>;
      const url = record.url;
      const fallbackQuery = queryFromComponent(component.id);
      if (typeof url === 'string' && !isLoadableImageSource(url)) {
        const originalComponent = { ...component };
        components[i] = createLoadingComponent(component.id) as A2UIComponent;
        staticResolutions.push({
          surfaceId,
          componentId: component.id,
          promise: resolveImageUrl(url, fallbackQuery).then((resolved) => ({
            version: 'v0.9',
            updateComponents: {
              surfaceId,
              components: [
                {
                  ...originalComponent,
                  url: resolved,
                },
              ],
            },
          })),
        });
      } else if (isRecord(url) && typeof url.path === 'string') {
        imagePathRefs.push({
          surfaceId,
          path: url.path,
          fallbackQuery,
        });
      }
    }
  }

  const dataResolutions: Promise<ImageDataPatch>[] = [];
  const pendingImagePathsBySurface = new Map<string, Set<string>>();
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
      resolvedPaths.add(normalizePointer(ref.path));
      const current = getAtPointer(dataModel.value, relativePath);
      if (isLoadableImageSource(current)) continue;
      markPendingImagePath(
        pendingImagePathsBySurface,
        dataModel.surfaceId,
        ref.path,
      );
      const query = typeof current === 'string' ? current : ref.fallbackQuery;
      dataResolutions.push(
        resolveImageUrl(query, ref.fallbackQuery).then((resolved) => ({
          surfaceId: dataModel.surfaceId,
          path: normalizePointer(ref.path),
          value: resolved,
        })),
      );
    }
    addImageLikeDataResolutions(
      dataModel.value,
      updatePath,
      dataModel.surfaceId,
      resolvedPaths,
      dataResolutions,
    );
  }

  const pendingImageRestores = replacePendingPathImagesWithLoading(
    cloned,
    pendingImagePathsBySurface,
  );

  return {
    messages: cloned,
    staticResolutions,
    dataResolutions,
    pendingImageRestores,
  };
}

function createImageDataPatchMessage(patch: ImageDataPatch): A2UIMessage {
  return {
    version: 'v0.9' as const,
    updateDataModel: patch,
  };
}

function insertStaticImageMessages(
  messages: A2UIMessage[],
  resolutions: StaticImageResolution[],
  resolvedMessages: Array<A2UIMessage | undefined>,
): A2UIMessage[] {
  const pendingByFirstComponentRef = new Map<number, A2UIMessage[]>();
  const appendMessages: A2UIMessage[] = [];

  for (let index = 0; index < resolvedMessages.length; index++) {
    const resolved = resolvedMessages[index];
    if (!resolved) continue;

    const resolution = resolutions[index];
    const insertAfter = resolution
      ? findFirstComponentMessageIndex(
        messages,
        resolution.surfaceId,
        resolution.componentId,
      )
      : -1;
    if (insertAfter === -1) {
      appendMessages.push(resolved);
      continue;
    }

    const bucket = pendingByFirstComponentRef.get(insertAfter) ?? [];
    bucket.push(resolved);
    pendingByFirstComponentRef.set(insertAfter, bucket);
  }

  const next: A2UIMessage[] = [];
  messages.forEach((message, index) => {
    next.push(message);
    const pending = pendingByFirstComponentRef.get(index);
    if (pending) next.push(...pending);
  });
  next.push(...appendMessages);
  return next;
}

function findFirstComponentMessageIndex(
  messages: A2UIMessage[],
  surfaceId: string,
  componentId: string,
): number {
  return messages.findIndex((message) =>
    'updateComponents' in message
    && message.updateComponents?.surfaceId === surfaceId
    && message.updateComponents.components.some((component) =>
      component.id === componentId
    )
  );
}

function imageDataPatchKey(patch: ImageDataPatch): string {
  return `${patch.surfaceId}\0${patch.path}\0${patch.value}`;
}

function createLoadingComponent(id: string): Record<string, unknown> {
  return {
    id,
    component: 'Loading',
    variant: 'block',
  };
}

function markPendingImagePath(
  pendingImagePathsBySurface: Map<string, Set<string>>,
  surfaceId: string,
  path: string,
): void {
  const paths = pendingImagePathsBySurface.get(surfaceId) ?? new Set<string>();
  paths.add(normalizePointer(path));
  pendingImagePathsBySurface.set(surfaceId, paths);
}

function hasPendingImagePath(
  pendingImagePathsBySurface: Map<string, Set<string>>,
  surfaceId: string,
  path: string,
): boolean {
  return pendingImagePathsBySurface.get(surfaceId)?.has(normalizePointer(path))
    ?? false;
}

function replacePendingPathImagesWithLoading(
  messages: A2UIMessage[],
  pendingImagePathsBySurface: Map<string, Set<string>>,
): A2UIMessage[] {
  const restores: A2UIMessage[] = [];

  for (const message of messages) {
    if (!('updateComponents' in message) || !message.updateComponents) {
      continue;
    }
    const { surfaceId, components } = message.updateComponents;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (!component || component.component !== 'Image') continue;
      const url = (component as Record<string, unknown>).url;
      if (!isRecord(url) || typeof url.path !== 'string') continue;
      if (
        !hasPendingImagePath(
          pendingImagePathsBySurface,
          surfaceId,
          url.path,
        )
      ) {
        continue;
      }

      const originalComponent = { ...component };
      components[i] = createLoadingComponent(component.id) as A2UIComponent;
      restores.push({
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [originalComponent],
        },
      });
    }
  }

  return restores;
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
      () => fallbackImageUrl(query),
    ).catch(
      () => fallbackImageUrl(query),
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

function fallbackImageUrl(query: string): string {
  const label = escapeSvgText(cleanupQuery(query) || 'image unavailable');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768"><rect width="1024" height="768" fill="#f2f4f7"/><rect x="88" y="88" width="848" height="592" rx="32" fill="#ffffff" stroke="#d0d5dd" stroke-width="8"/><path d="M224 536l176-176 120 120 88-88 192 192H224z" fill="#d0d5dd"/><circle cx="704" cy="264" r="72" fill="#e4e7ec"/><text x="512" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" fill="#667085">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
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
  value: unknown,
  path: string,
  surfaceId: string,
  resolvedPaths: Set<string>,
  resolutions: Promise<ImageDataPatch>[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      addImageLikeDataResolutions(
        item,
        appendPointer(path, String(index)),
        surfaceId,
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
      && !isLoadableImageSource(child)
    ) {
      resolvedPaths.add(normalizedChildPath);
      resolutions.push(
        resolveImageUrl(child, cleanupQuery(key) || 'image').then(
          (resolved) => ({
            surfaceId,
            path: normalizePointer(childPath),
            value: resolved,
          }),
        ),
      );
      continue;
    }

    addImageLikeDataResolutions(
      child,
      childPath,
      surfaceId,
      resolvedPaths,
      resolutions,
    );
  }
}

function isImageLikeKey(key: string): boolean {
  return /(?:^|[-_])(?:image|photo|picture|avatar|cover|poster|artwork|thumbnail)(?:$|[-_])/iu
    .test(key);
}

function dedupeImageDataPatches(patches: ImageDataPatch[]): ImageDataPatch[] {
  const seen = new Set<string>();
  const deduped: ImageDataPatch[] = [];
  for (const patch of patches) {
    const key = `${patch.surfaceId}\0${patch.path}\0${patch.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(patch);
  }
  return deduped;
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
