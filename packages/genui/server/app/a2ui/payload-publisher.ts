// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_S3_ACCESS_KEY_ID = process.env.SUPABASE_S3_ACCESS_KEY_ID;
const SUPABASE_S3_SECRET_ACCESS_KEY = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET
  ?? 'genui';
const SUPABASE_STORAGE_PREFIX = process.env.SUPABASE_STORAGE_PREFIX ?? 'a2ui';
const SUPABASE_OPENUI_STORAGE_PREFIX =
  process.env.SUPABASE_OPENUI_STORAGE_PREFIX ?? 'openui';
const SUPABASE_STORAGE_REGION = process.env.SUPABASE_STORAGE_REGION
  ?? 'us-east-1';

export interface A2UIPublishedPayload {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export interface OpenUIPublishedPayload {
  rawTextUrl: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function buildSupabaseStoragePath(
  id: string,
  file: string,
  storagePrefix = SUPABASE_STORAGE_PREFIX,
): string {
  const prefix = trimSlashes(storagePrefix);
  return prefix ? `${prefix}/${id}/${file}` : `${id}/${file}`;
}

function buildSupabaseObjectUrl(path: string): string | null {
  if (!SUPABASE_URL) return null;

  const base = SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${path}`;
}

function createSupabaseS3Client(): S3Client {
  if (
    !SUPABASE_URL
    || !SUPABASE_S3_ACCESS_KEY_ID
    || !SUPABASE_S3_SECRET_ACCESS_KEY
  ) {
    throw new Error('Supabase Storage S3 is not configured');
  }

  const base = SUPABASE_URL.replace(/\/+$/, '');
  return new S3Client({
    region: SUPABASE_STORAGE_REGION,
    endpoint: `${base}/storage/v1/s3`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: SUPABASE_S3_ACCESS_KEY_ID,
      secretAccessKey: SUPABASE_S3_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadSupabaseJson(
  path: string,
  payload: unknown,
): Promise<void> {
  await uploadSupabaseObject(
    path,
    JSON.stringify(payload),
    'application/json; charset=utf-8',
  );
}

async function uploadSupabaseText(
  path: string,
  text: string,
): Promise<void> {
  await uploadSupabaseObject(
    path,
    text,
    'text/plain; charset=utf-8',
  );
}

async function uploadSupabaseObject(
  path: string,
  body: string,
  contentType: string,
): Promise<void> {
  const client = createSupabaseS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: SUPABASE_STORAGE_BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=1800',
    }),
  );
}

function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    SUPABASE_URL
      && SUPABASE_S3_ACCESS_KEY_ID
      && SUPABASE_S3_SECRET_ACCESS_KEY,
  );
}

export async function publishA2UIPayload(
  messages: unknown,
  actionMocks?: unknown,
): Promise<A2UIPublishedPayload | undefined> {
  if (messages === undefined) return undefined;

  if (!isSupabaseStorageConfigured()) {
    console.warn(
      '[a2ui:payload-publisher] Supabase Storage S3 is not configured',
    );
    return undefined;
  }

  try {
    const id = crypto.randomUUID();
    const messagesPath = buildSupabaseStoragePath(id, 'messages.json');
    await uploadSupabaseJson(messagesPath, messages);
    const messagesUrl = buildSupabaseObjectUrl(messagesPath);
    if (!messagesUrl) return undefined;

    if (actionMocks !== undefined) {
      const actionMocksPath = buildSupabaseStoragePath(id, 'actionMocks.json');
      await uploadSupabaseJson(actionMocksPath, actionMocks);
      const actionMocksUrl = buildSupabaseObjectUrl(actionMocksPath)
        ?? undefined;
      return { messagesUrl, actionMocksUrl };
    }

    return { messagesUrl };
  } catch (err) {
    console.warn(
      '[a2ui:payload-publisher] Supabase Storage upload failed',
      err,
    );
    return undefined;
  }
}

export async function publishOpenUIRawText(
  rawText: string,
): Promise<OpenUIPublishedPayload | undefined> {
  if (!isSupabaseStorageConfigured()) {
    console.warn(
      '[openui:payload-publisher] Supabase Storage S3 is not configured',
    );
    return undefined;
  }

  try {
    const id = crypto.randomUUID();
    const rawTextPath = buildSupabaseStoragePath(
      id,
      'raw.txt',
      SUPABASE_OPENUI_STORAGE_PREFIX,
    );
    await uploadSupabaseText(rawTextPath, rawText);
    const rawTextUrl = buildSupabaseObjectUrl(rawTextPath);
    if (!rawTextUrl) return undefined;
    return { rawTextUrl };
  } catch (err) {
    console.warn(
      '[openui:payload-publisher] Supabase Storage upload failed',
      err,
    );
    return undefined;
  }
}
