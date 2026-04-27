// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UIRender, BaseClient } from '@lynx-js/a2ui-reactlynx/core';
import type { Resource } from '@lynx-js/a2ui-reactlynx/core';
import '@lynx-js/a2ui-reactlynx/catalog/all';
import {
  useEffect,
  useGlobalProps,
  useInitData,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

interface InitData {
  messagesUrl?: string;
  messages?: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
}

type A2uiMessage = Record<string, unknown> & { messageId?: string };

type ActionMocks = Record<string, unknown>;

type ResponseMessages = A2uiMessage[];

const STREAM_MESSAGE_DELAY_MS = 800;

function randomId(prefix: string) {
  return prefix + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 10);
}

function parseJsonLikeString(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    // ignore
  }

  // Query params may arrive URL-encoded one or more times in native globalProps.
  let current = input;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
      try {
        return JSON.parse(current) as unknown;
      } catch {
        // keep decoding
      }
    } catch {
      break;
    }
  }

  return input;
}

function normalizeInitDataLike(raw: unknown): InitData {
  if (raw === null || raw === undefined) return {};

  if (typeof raw !== 'object') return {};

  const obj = raw as Record<string, unknown>;
  const out: InitData = {};

  const messagesUrl = obj.messagesUrl;
  if (typeof messagesUrl === 'string') out.messagesUrl = messagesUrl;

  const actionMocksUrl = obj.actionMocksUrl;
  if (typeof actionMocksUrl === 'string') out.actionMocksUrl = actionMocksUrl;

  const messages = obj.messages;
  if (messages !== undefined) {
    out.messages = typeof messages === 'string'
      ? parseJsonLikeString(messages)
      : messages;
  }

  const actionMocks = obj.actionMocks;
  if (actionMocks !== undefined) {
    out.actionMocks = typeof actionMocks === 'string'
      ? parseJsonLikeString(actionMocks)
      : actionMocks;
  }

  return out;
}

function mergeInitDataPreferLeft(a: InitData, b: InitData): InitData {
  return {
    messagesUrl: a.messagesUrl ?? b.messagesUrl,
    messages: a.messages ?? b.messages,
    actionMocksUrl: a.actionMocksUrl ?? b.actionMocksUrl,
    actionMocks: a.actionMocks ?? b.actionMocks,
  };
}

function normalizePayloadToMessages(payload: unknown): ResponseMessages {
  if (payload === null || payload === undefined) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload as ResponseMessages;
  }

  if (typeof payload === 'string') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(payload);
      return normalizePayloadToMessages(parsed);
    } catch {
      return [];
    }
  }

  if (
    typeof payload === 'object'
    && Array.isArray((payload as Record<string, unknown>).messages)
  ) {
    return (payload as Record<string, unknown>).messages as ResponseMessages;
  }

  return [];
}

async function loadMessages(initData: InitData): Promise<ResponseMessages> {
  if (initData.messagesUrl) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await fetch(initData.messagesUrl, { cache: 'no-store' });
    const text = await res.text();
    try {
      return normalizePayloadToMessages(JSON.parse(text));
    } catch {
      return normalizePayloadToMessages(text);
    }
  }

  if (initData.messages !== undefined) {
    return normalizePayloadToMessages(initData.messages);
  }

  return [];
}

async function loadActionMocks(initData: InitData): Promise<ActionMocks> {
  if (initData.actionMocksUrl) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await fetch(initData.actionMocksUrl, { cache: 'no-store' });
    const text = await res.text();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return parsed as ActionMocks;
      }
      return {};
    } catch {
      return {};
    }
  }

  if (initData.actionMocks && typeof initData.actionMocks === 'object') {
    return initData.actionMocks as ActionMocks;
  }

  return {};
}

export function App() {
  const globalProps = useGlobalProps();
  const rawInitData = useInitData();

  const initData = useMemo(() => {
    if (typeof rawInitData === 'string') {
      try {
        return JSON.parse(rawInitData) as InitData;
      } catch {
        return {} as InitData;
      }
    }
    return (rawInitData ?? {}) as InitData;
  }, [rawInitData]);

  const globalPropsData = useMemo(
    () => normalizeInitDataLike(globalProps),
    [globalProps],
  );

  // Native in-app preview passes A2UI payload via `globalProps` (often from URL query).
  // Web preview may still provide `initData`, so keep fallback for compatibility.
  const effectiveData = useMemo(
    () => mergeInitDataPreferLeft(globalPropsData, initData),
    [globalPropsData, initData],
  );

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const clientRef = useRef<any>(null);

  const [resource, setResource] = useState<Resource | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const [rawMessages, actionMocks] = await Promise.all([
        loadMessages(effectiveData ?? {}),
        loadActionMocks(effectiveData ?? {}),
      ]);

      const messageId = randomId('demo_');
      const messages = rawMessages.map((msg) => ({
        ...msg,
        messageId: messageId,
      }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const client = clientRef.current ?? new BaseClient('');

      clientRef.current ??= client;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.processUserAction = async (
        userAction: Record<string, unknown>,
      ) => {
        const name = userAction?.name as string | undefined;
        if (!name || !actionMocks[name]) {
          return [];
        }

        const rawResponseMessages = normalizePayloadToMessages(
          actionMocks[name],
        );
        const actionMessageId = randomId('action_');
        const responseMessages = rawResponseMessages.map((msg) => ({
          ...msg,
          messageId: actionMessageId,
        }));

        void (async () => {
          for (const msg of responseMessages) {
            if (cancelled) break;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            client.processor?.processMessages?.([msg]);
            await new Promise((resolve) =>
              setTimeout(resolve, STREAM_MESSAGE_DELAY_MS)
            );
          }
        })();

        return responseMessages;
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      client.processor?.clearSurfaces?.();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      client.resources?.clear?.();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const { resource: newResource } = await client.send(
        '' as unknown,
        messageId,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      client.resources?.set?.(messageId, newResource);

      if (!cancelled) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        setResource(newResource);
      }

      const simulateStream = async () => {
        for (const msg of messages) {
          if (cancelled) break;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          client.processor?.processMessages?.([msg]);
          await new Promise((resolve) =>
            setTimeout(resolve, STREAM_MESSAGE_DELAY_MS)
          );
        }
      };

      void simulateStream();
    };

    run()
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setResource(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveData]);

  return (
    <view
      className='luna-light'
      style={{ width: '100%', height: '100%', backgroundColor: '#fff' }}
    >
      {error
        ? (
          <view style={{ padding: '12px' }}>
            <text style={{ color: '#c40000' }}>{error}</text>
          </view>
        )
        : null}

      {loading
        ? (
          <view style={{ padding: '12px' }}>
            <text>Loading...</text>
          </view>
        )
        : null}

      {resource
        ? (
          <scroll-view scroll-y style={{ height: '100%' }}>
            <A2UIRender resource={resource} />
          </scroll-view>
        )
        : null}
    </view>
  );
}
