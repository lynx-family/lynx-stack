// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  A2UI,
  Button,
  Card,
  CheckBox,
  ChoicePicker,
  Column,
  DateTimeInput,
  Divider,
  Icon,
  Image,
  LineChart,
  List,
  Modal,
  PieChart,
  RadioGroup,
  Row,
  Slider,
  Tabs,
  Text,
  TextField,
  basicFunctions,
  createMessageStore,
  normalizePayloadToMessages as normalizeProtocolMessages,
} from '@lynx-js/genui/a2ui';
import type {
  CatalogComponent,
  CatalogInput,
  CatalogManifest,
  MessageStore,
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/genui/a2ui';
import {
  useCallback,
  useEffect,
  useGlobalProps,
  useInitData,
  useLynxGlobalEventListener,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

import buttonManifest from '../../.generated/a2ui/catalog/Button/catalog.json';
import cardManifest from '../../.generated/a2ui/catalog/Card/catalog.json';
import checkBoxManifest from '../../.generated/a2ui/catalog/CheckBox/catalog.json';
import choicePickerManifest from '../../.generated/a2ui/catalog/ChoicePicker/catalog.json';
import columnManifest from '../../.generated/a2ui/catalog/Column/catalog.json';
import dateTimeInputManifest from '../../.generated/a2ui/catalog/DateTimeInput/catalog.json';
import dividerManifest from '../../.generated/a2ui/catalog/Divider/catalog.json';
import iconManifest from '../../.generated/a2ui/catalog/Icon/catalog.json';
import imageManifest from '../../.generated/a2ui/catalog/Image/catalog.json';
import lineChartManifest from '../../.generated/a2ui/catalog/LineChart/catalog.json';
import listManifest from '../../.generated/a2ui/catalog/List/catalog.json';
import modalManifest from '../../.generated/a2ui/catalog/Modal/catalog.json';
import pieChartManifest from '../../.generated/a2ui/catalog/PieChart/catalog.json';
import radioGroupManifest from '../../.generated/a2ui/catalog/RadioGroup/catalog.json';
import rowManifest from '../../.generated/a2ui/catalog/Row/catalog.json';
import sliderManifest from '../../.generated/a2ui/catalog/Slider/catalog.json';
import tabsManifest from '../../.generated/a2ui/catalog/Tabs/catalog.json';
import textManifest from '../../.generated/a2ui/catalog/Text/catalog.json';
import textFieldManifest from '../../.generated/a2ui/catalog/TextField/catalog.json';
import { createMockAgent } from '../../examples/io-mock/mockAgent.js';
import type { MockAgentProgress } from '../../examples/io-mock/mockAgent.js';

const DEFAULT_STREAM_DELAY_MS = 800;

// Compose every built-in. There is intentionally no all-in-one aggregate
// shipped from the package — this list makes the cost of "everything"
// visible and lets the bundler tree-shake when you only need a few.
//
// Function entries are included because the gallery payloads use A2UI
// basic-catalog calls such as `formatDate` in dynamic props and checks.
//
// To include component schemas, pair each component with its `catalog.json`
// manifest — see
// `packages/genui/a2ui/src/catalog/README.md`.
function manifestEntry(
  component: unknown,
  manifest: CatalogManifest,
): readonly [CatalogComponent, CatalogManifest] {
  return [component as CatalogComponent, manifest];
}

const ALL_BUILTINS: readonly CatalogInput[] = [
  manifestEntry(Text, textManifest),
  manifestEntry(Image, imageManifest),
  manifestEntry(Row, rowManifest),
  manifestEntry(Column, columnManifest),
  manifestEntry(List, listManifest),
  manifestEntry(Card, cardManifest),
  manifestEntry(Modal, modalManifest),
  manifestEntry(Button, buttonManifest),
  manifestEntry(Divider, dividerManifest),
  manifestEntry(Icon, iconManifest),
  manifestEntry(CheckBox, checkBoxManifest),
  manifestEntry(ChoicePicker, choicePickerManifest),
  manifestEntry(DateTimeInput, dateTimeInputManifest),
  manifestEntry(LineChart, lineChartManifest),
  manifestEntry(PieChart, pieChartManifest),
  manifestEntry(RadioGroup, radioGroupManifest),
  manifestEntry(Slider, sliderManifest),
  manifestEntry(TextField, textFieldManifest),
  manifestEntry(Tabs, tabsManifest),
  ...basicFunctions,
];

interface InitData {
  messagesUrl?: string;
  messages?: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
  instant?: boolean;
  playbackMode?: boolean;
  theme?: 'light' | 'dark';
  playbackPaused?: boolean;
  liveAction?: boolean;
}

type Theme = 'light' | 'dark';
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

function decodeUrlString(input: string): string {
  let current = input;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function normalizeInitDataLike(raw: unknown): InitData {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object') return {};

  const obj = raw as Record<string, unknown>;
  const out: InitData = {};

  const messagesUrl = obj.messagesUrl;
  if (typeof messagesUrl === 'string') {
    out.messagesUrl = decodeUrlString(messagesUrl);
  }

  const actionMocksUrl = obj.actionMocksUrl;
  if (typeof actionMocksUrl === 'string') {
    out.actionMocksUrl = decodeUrlString(actionMocksUrl);
  }

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

  const instant = obj.instant;
  if (instant !== undefined) {
    out.instant = instant === true || instant === '1' || instant === 1;
  }

  const playbackMode = obj.playbackMode;
  if (playbackMode !== undefined) {
    out.playbackMode = playbackMode === true || playbackMode === '1'
      || playbackMode === 1;
  }

  const playbackPaused = obj.playbackPaused;
  if (typeof playbackPaused === 'boolean') {
    out.playbackPaused = playbackPaused;
  }

  const theme = obj.theme;
  if (theme === 'light' || theme === 'dark') {
    out.theme = theme;
  } else if (theme === 'Dark' || theme === 'Light') {
    out.theme = theme.toLowerCase() as Theme;
  }

  const liveAction = obj.liveAction;
  if (liveAction !== undefined) {
    out.liveAction = liveAction === true || liveAction === '1'
      || liveAction === 1;
  }

  return out;
}

function mergeInitDataPreferLeft(a: InitData, b: InitData): InitData {
  return {
    messagesUrl: a.messagesUrl ?? b.messagesUrl,
    messages: a.messages ?? b.messages,
    actionMocksUrl: a.actionMocksUrl ?? b.actionMocksUrl,
    actionMocks: a.actionMocks ?? b.actionMocks,
    instant: a.instant ?? b.instant,
    playbackMode: a.playbackMode ?? b.playbackMode,
    playbackPaused: a.playbackPaused ?? b.playbackPaused,
    theme: a.theme ?? b.theme,
    liveAction: a.liveAction ?? b.liveAction,
  };
}

async function loadMessages(
  initData: InitData,
): Promise<ServerToClientMessage[]> {
  if (initData.messagesUrl) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await fetch(initData.messagesUrl, { cache: 'no-store' });
    const text = await res.text();
    try {
      return normalizeProtocolMessages(JSON.parse(text));
    } catch {
      return normalizeProtocolMessages(text);
    }
  }
  if (initData.messages !== undefined) {
    return normalizeProtocolMessages(initData.messages);
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

  const streamConfig = useMemo(
    () => ({
      messagesUrl: effectiveData.messagesUrl,
      messages: effectiveData.messages,
      actionMocksUrl: effectiveData.actionMocksUrl,
      actionMocks: effectiveData.actionMocks,
      instant: effectiveData.instant,
      playbackMode: effectiveData.playbackMode,
      theme: effectiveData.theme,
    }),
    [
      effectiveData.actionMocks,
      effectiveData.actionMocksUrl,
      effectiveData.instant,
      effectiveData.messages,
      effectiveData.messagesUrl,
      effectiveData.playbackMode,
      effectiveData.theme,
    ],
  );

  const storeRef = useRef<MessageStore | null>(null);
  const agentRef = useRef<ReturnType<typeof createMockAgent> | null>(null);
  const pendingLiveMessagesRef = useRef<unknown[] | null>(null);
  const [store, setStore] = useState<MessageStore | null>(null);
  const [error, setError] = useState<string>('');
  const playbackMode = useMemo(
    () => streamConfig.playbackMode === true,
    [streamConfig.playbackMode],
  );
  const [playbackTargetCount, setPlaybackTargetCount] = useState(0);
  const playbackPausedRef = useRef(false);
  const playbackTargetCountRef = useRef(0);

  // Per-batch delay (ms) the mock agent waits between successive
  // protocol messages. Configurable via `?speed=2` (faster);
  // `?speed=0` paints the full stream with no delay.
  const streamDelay = useMemo(() => {
    const raw = (globalProps as Record<string, unknown> | null)?.speed
      ?? (rawInitData as Record<string, unknown> | null)?.speed;
    const speed = typeof raw === 'string'
      ? Number(raw)
      : (typeof raw === 'number' ? raw : 1);
    if (!Number.isFinite(speed) || speed < 0) return DEFAULT_STREAM_DELAY_MS;
    if (speed === 0) return 0;
    return DEFAULT_STREAM_DELAY_MS / speed;
  }, [globalProps, rawInitData]);

  // `?instant=1` (or `instant: true`) paints the final state with no
  // pacing — used by the examples-list thumbnails.
  const isInstantPreview = useMemo(
    () => effectiveData.instant === true,
    [effectiveData.instant],
  );
  const theme = useMemo<Theme>(
    () => streamConfig.theme ?? 'light',
    [streamConfig.theme],
  );
  const themeClassName = theme === 'dark'
    ? 'luna-dark'
    : 'luna-light';
  const surfaceThemeClassName = theme === 'dark' ? ' a2ui-dark' : ' a2ui-light';
  const isPlaybackPaused = useMemo(
    () => effectiveData.playbackPaused === true,
    [effectiveData.playbackPaused],
  );
  const pushLiveMessagesToStore = useCallback(
    (targetStore: MessageStore, messages: unknown) => {
      const normalized = normalizeProtocolMessages(messages);
      for (const msg of normalized) {
        targetStore.push(msg);
      }
    },
    [],
  );
  const postPlaybackSync = useCallback((state: MockAgentProgress) => {
    NativeModules.bridge?.call?.(
      'A2UI_PLAYBACK_SYNC',
      state as unknown as Record<string, unknown>,
      () => {
        // jsb callback
      },
    );
  }, []);

  const syncPlaybackAgent = useCallback(() => {
    const agent = agentRef.current;
    if (!agent) return;
    if (!playbackMode) return;
    const currentCount = storeRef.current?.getSnapshot().length ?? 0;
    const targetCount = playbackTargetCountRef.current;
    if (playbackPausedRef.current || currentCount >= targetCount) {
      agent.pause();
      return;
    }
    agent.resume();
  }, []);

  useLynxGlobalEventListener(
    'A2UI_PLAYBACK_CONTROL',
    (action: unknown) => {
      const agent = agentRef.current;
      if (!agent) return;
      if (action === 'pause') {
        agent.pause();
        return;
      }
      if (action === 'resume') {
        agent.resume();
      }
    },
  );

  useLynxGlobalEventListener(
    'A2UI_PLAYBACK_PROGRESS',
    (payload: unknown) => {
      if (!playbackMode) return;
      if (!payload || typeof payload !== 'object') return;
      const next = (payload as { deliveredCount?: unknown }).deliveredCount;
      const nextCount = typeof next === 'number'
        ? next
        : (typeof next === 'string' ? Number(next) : Number.NaN);
      if (!Number.isFinite(nextCount) || nextCount < 0) return;
      setPlaybackTargetCount(Math.floor(nextCount));
    },
  );

  useLynxGlobalEventListener(
    'A2UI_ACTION_RESPONSE',
    (messages: unknown) => {
      const currentStore = storeRef.current;
      if (!currentStore) return;
      const normalized = normalizeProtocolMessages(messages);
      for (const msg of normalized) {
        currentStore.push(msg);
      }
    },
  );

  useLynxGlobalEventListener(
    'A2UI_LIVE_MESSAGES',
    (messages: unknown) => {
      const currentStore = storeRef.current;
      if (!currentStore) {
        pendingLiveMessagesRef.current = Array.isArray(messages)
          ? messages
          : [messages];
        return;
      }
      pushLiveMessagesToStore(currentStore, messages);
      agentRef.current?.stop();
      agentRef.current = null;
    },
  );

  useEffect(() => {
    playbackPausedRef.current = isPlaybackPaused;
  }, [isPlaybackPaused]);

  useEffect(() => {
    playbackTargetCountRef.current = playbackTargetCount;
  }, [playbackTargetCount]);

  useEffect(() => {
    syncPlaybackAgent();
  }, [isPlaybackPaused, playbackTargetCount, syncPlaybackAgent]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError('');

      const [rawMessages, rawActionMocks] = await Promise.all([
        loadMessages(streamConfig as InitData),
        loadActionMocks(streamConfig as InitData),
      ]);

      const initialMessages = rawMessages;
      const actionMocks: ActionMocks = {};
      for (const [name, value] of Object.entries(rawActionMocks)) {
        actionMocks[name] = normalizeProtocolMessages(value);
      }

      const next = createMessageStore();
      const agent = createMockAgent(next, {
        initialMessages,
        actionMocks,
        // `delayMs: 0` makes `agent.start()` push every message into the
        // buffer in a tight loop, effectively a static "final state"
        // paint that matches upstream's `isInstantPreview` mode.
        delayMs: streamConfig.instant ? 0 : streamDelay,
        onProgress: (state) => {
          postPlaybackSync(state);
          syncPlaybackAgent();
        },
      });

      if (cancelled) {
        agent.stop();
        return;
      }
      agentRef.current?.stop();
      storeRef.current = next;
      agentRef.current = agent;
      setStore(next);
      const pendingLiveMessages = pendingLiveMessagesRef.current;
      if (pendingLiveMessages) {
        pendingLiveMessagesRef.current = null;
        pushLiveMessagesToStore(next, pendingLiveMessages);
        agent.stop();
        agentRef.current = null;
      }
      syncPlaybackAgent();
      // Begin streaming the demo's initial messages into the buffer.
      if (agentRef.current === agent) {
        void agent.start();
      }
    };

    run()
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setStore(null);
        }
      });

    return () => {
      cancelled = true;
      agentRef.current?.stop();
      storeRef.current = null;
      agentRef.current = null;
    };
  }, [
    isInstantPreview,
    postPlaybackSync,
    pushLiveMessagesToStore,
    streamConfig,
    streamDelay,
  ]);

  return (
    <view
      className={`page ${themeClassName}`}
    >
      {error
        ? (
          <view style={{ padding: '12px' }}>
            <text style={{ color: '#c40000' }}>{error}</text>
          </view>
        )
        : (
          <view className='a2ui-root-container'>
            {!isInstantPreview && store === null && error === ''
              ? (
                <view className='a2ui-loadingOverlay'>
                  <text className='a2ui-loadingText'>loading ...</text>
                </view>
              )
              : null}
            {store
              ? (
                <scroll-view
                  scroll-y
                  style={{ flex: 1, minHeight: 0 }}
                  className={isPlaybackPaused ? 'a2ui-scrollPaused' : ''}
                >
                  <A2UI
                    messageStore={store}
                    catalogs={ALL_BUILTINS}
                    onAction={(action) => {
                      if (effectiveData.liveAction) {
                        NativeModules.bridge.call(
                          'A2UI_USER_ACTION',
                          action as unknown as Record<string, unknown>,
                          () => undefined,
                        );
                        return;
                      }
                      // Forward user actions to the mock agent — it pushes
                      // the canned response messages back into the same store.
                      void agentRef.current?.onAction(action);
                    }}
                    wrapSurface={(c) => (
                      <view className={surfaceThemeClassName}>{c}</view>
                    )}
                    renderFallback={() => (
                      <view style={{ padding: '12px' }}>
                        <text>Streaming...</text>
                      </view>
                    )}
                    className='a2ui-container'
                  />
                </scroll-view>
              )
              : null}
          </view>
        )}
    </view>
  );
}
