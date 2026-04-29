// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  A2UI,
  Button,
  Card,
  CheckBox,
  Column,
  Divider,
  Image,
  List,
  RadioGroup,
  Row,
  Text,
  createMessageStore,
} from '@lynx-js/a2ui-reactlynx';
import type {
  CatalogInput,
  MessageStore,
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/a2ui-reactlynx';
import buttonManifest from '@lynx-js/a2ui-reactlynx/catalog/Button/catalog.json';
import cardManifest from '@lynx-js/a2ui-reactlynx/catalog/Card/catalog.json';
import checkBoxManifest from '@lynx-js/a2ui-reactlynx/catalog/CheckBox/catalog.json';
import columnManifest from '@lynx-js/a2ui-reactlynx/catalog/Column/catalog.json';
import dividerManifest from '@lynx-js/a2ui-reactlynx/catalog/Divider/catalog.json';
import imageManifest from '@lynx-js/a2ui-reactlynx/catalog/Image/catalog.json';
import listManifest from '@lynx-js/a2ui-reactlynx/catalog/List/catalog.json';
import radioGroupManifest from '@lynx-js/a2ui-reactlynx/catalog/RadioGroup/catalog.json';
import rowManifest from '@lynx-js/a2ui-reactlynx/catalog/Row/catalog.json';
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json';
import {
  useEffect,
  useGlobalProps,
  useInitData,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

import { createMockAgent } from '../examples/io-mock/mockAgent.js';

// Compose every built-in. There is intentionally no all-in-one aggregate
// shipped from the package — this list makes the cost of "everything"
// visible and lets the bundler tree-shake when you only need a few.
//
// Schemas are not attached because the playground doesn't perform an
// agent handshake. To include schemas, pair each component with its
// `catalog.json` manifest — see
// `packages/genui/a2ui/src/catalog/README.md`.
const ALL_BUILTINS: readonly CatalogInput[] = [
  [Text, textManifest],
  [Image, imageManifest],
  [Row, rowManifest],
  [Column, columnManifest],
  [List, listManifest],
  [Card, cardManifest],
  [Button, buttonManifest],
  [Divider, dividerManifest],
  [CheckBox, checkBoxManifest],
  [RadioGroup, radioGroupManifest],
];

interface InitData {
  messagesUrl?: string;
  messages?: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
}

type A2uiMessage = Record<string, unknown> & { messageId?: string };
type ResponseMessages = A2uiMessage[];
type ActionMocks = Record<
  string,
  | ServerToClientMessage[]
  | ((ctx: UserActionPayload) => ServerToClientMessage[])
>;

function parseJsonLikeString(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    // ignore
  }

  // Query params may arrive URL-encoded one or more times in native
  // globalProps.
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
  if (payload === null || payload === undefined) return [];
  if (Array.isArray(payload)) return payload as ResponseMessages;
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

async function loadActionMocks(
  initData: InitData,
): Promise<Record<string, unknown>> {
  if (initData.actionMocksUrl) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await fetch(initData.actionMocksUrl, { cache: 'no-store' });
    const text = await res.text();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (initData.actionMocks && typeof initData.actionMocks === 'object') {
    return initData.actionMocks as Record<string, unknown>;
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

  // Native in-app preview passes A2UI payload via `globalProps` (often
  // from URL query). Web preview may still provide `initData`, so keep the
  // fallback for compatibility.
  const effectiveData = useMemo(
    () => mergeInitDataPreferLeft(globalPropsData, initData),
    [globalPropsData, initData],
  );

  const storeRef = useRef<MessageStore | null>(null);
  const agentRef = useRef<ReturnType<typeof createMockAgent> | null>(null);
  const [store, setStore] = useState<MessageStore | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError('');

      const [rawMessages, rawActionMocks] = await Promise.all([
        loadMessages(effectiveData ?? {}),
        loadActionMocks(effectiveData ?? {}),
      ]);

      const initialMessages = rawMessages as ServerToClientMessage[];
      const actionMocks: ActionMocks = {};
      for (const [name, value] of Object.entries(rawActionMocks)) {
        actionMocks[name] = normalizePayloadToMessages(
          value,
        ) as ServerToClientMessage[];
      }

      const next = createMessageStore();
      const agent = createMockAgent(next, {
        initialMessages,
        actionMocks,
        delayMs: 800,
      });

      // Begin streaming the demo's initial messages into the buffer.
      void agent.start();

      if (cancelled) {
        agent.stop();
        return;
      }
      agentRef.current?.stop();
      storeRef.current = next;
      agentRef.current = agent;
      setStore(next);
    };

    run().catch((e) => {
      if (!cancelled) setError(String(e));
    });

    return () => {
      cancelled = true;
      agentRef.current?.stop();
      storeRef.current = null;
      agentRef.current = null;
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
      {store
        ? (
          <scroll-view scroll-y style={{ height: '100%' }}>
            <A2UI
              messageStore={store}
              catalogs={ALL_BUILTINS}
              onAction={(action) => {
                // Forward user actions to the mock agent — it pushes the
                // canned response messages back into the same store.
                void agentRef.current?.onAction(action);
              }}
              wrapSurface={(c) => <view className='luna-light'>{c}</view>}
              renderEmpty={() => (
                <view style={{ padding: '12px' }}>
                  <text>Loading...</text>
                </view>
              )}
              renderFallback={() => (
                <view style={{ padding: '12px' }}>
                  <text>Streaming...</text>
                </view>
              )}
            />
          </scroll-view>
        )
        : (
          <view style={{ padding: '12px' }}>
            <text>Loading...</text>
          </view>
        )}
    </view>
  );
}
