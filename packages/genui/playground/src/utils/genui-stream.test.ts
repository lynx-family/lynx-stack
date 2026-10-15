// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { createParser } from '@openuidev/lang-core';
import { expect, test } from '@rstest/core';

import { createOpenUiChatPromptLibrary } from '@lynx-js/genui/openui/chat/agent';

import { splitOpenUiResponse } from '../../lynx-src/openui/inlineResponse.js';

const publicDirectory = new URL('../../public/', import.meta.url);
const html = readFileSync(
  new URL('lynx-genui-stream.html', publicDirectory),
  'utf8',
);
const script = /<script id="preview-core">([\s\S]*?)<\/script>/.exec(html)![1]!;
const trip = readFileSync(
  new URL('demos/openui/document/hokkaido-turbo-v12.openui', publicDirectory),
  'utf8',
);
const resources = JSON.parse(
  readFileSync(
    new URL('demos/openui/document/resources.json', publicDirectory),
    'utf8',
  ),
) as Record<string, string>;

interface Selection {
  protocol: 'openui' | 'a2ui';
  library: 'chat' | 'stack';
  id: string;
  inlineMode: boolean;
}
interface Storage {
  getItem(key: string): string | null;
}
interface Bridge {
  ready: boolean;
  reset(selection: Selection): void;
  render(messages: unknown[], replay?: boolean): void;
  dispose(): void;
}
interface Frame {
  src: string;
  contentWindow: { postMessage(message: unknown, origin: string): void };
}
interface Core {
  playPreview(
    bridge: Pick<Bridge, 'ready' | 'render'>,
    protocol: string,
    messages: unknown[],
    signal: AbortSignal,
    wait: (ms: number, signal: AbortSignal) => Promise<void>,
  ): Promise<void>;
  parsePreviewSource(source: string, protocol: string): unknown[];
  exampleText(selection: Selection, trip: string): string;
  readSelection(location: string, storage?: Storage): Selection;
  draftKey(selection: Selection): string;
  readDraft(storage: Storage, selection: Selection): string | null;
  resolveExampleAssets(
    source: string,
    base: URL,
    resources: Record<string, string>,
  ): string;
  renderUrl(location: string, token: string, selection: Selection): string;
  createRendererBridge(options: {
    frame: Frame;
    location: string;
    onReady(): void;
    onError(message: string): void;
    onAction(action: unknown): void;
  }): Bridge;
}
function loadCore() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const core = runInNewContext(
    `${script}\n({ parsePreviewSource, exampleText, readSelection, draftKey, readDraft, resolveExampleAssets, renderUrl, createRendererBridge, playPreview })`,
    {
      URL,
      URLSearchParams,
      crypto: { randomUUID },
      setTimeout(callback: () => void) {
        timers.set(++timerId, callback);
        return timerId;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
      window: {
        addEventListener(
          type: string,
          listener: (event: Record<string, unknown>) => void,
        ) {
          listeners.set(type, listener);
        },
        removeEventListener(type: string) {
          listeners.delete(type);
        },
      },
    },
  ) as Core;
  return { core, listeners, timers };
}
const chat: Selection = {
  protocol: 'openui',
  library: 'chat',
  id: 'doc-hokkaido-turbo-v12',
  inlineMode: false,
};

test.each([
  chat,
  { ...chat, inlineMode: true },
  { ...chat, id: 'basic' },
  { ...chat, id: 'basic', inlineMode: true },
])(
  'renders valid $library examples with inlineMode=$inlineMode and case=$id',
  selection => {
    const { core } = loadCore();
    const source = core.exampleText(selection, trip);
    const library = createOpenUiChatPromptLibrary();
    const parser = createParser(library.toJSONSchema(), library.root);
    const programs = selection.inlineMode
      ? splitOpenUiResponse(source).filter(part => part.kind === 'code').map(
        part => part.content,
      )
      : [source];
    expect(programs.length).toBeGreaterThan(0);
    for (const program of programs) {
      const result = parser.parse(program);
      expect(result.root).not.toBeNull();
      expect(result.meta.errors).toEqual([]);
      expect(result.meta.incomplete).toBe(false);
      expect(result.meta.unresolved).toEqual([]);
    }
    if (selection.inlineMode) {
      expect(splitOpenUiResponse(source).map(part => part.kind)).toEqual([
        'text',
        'code',
        'text',
      ]);
    }
  },
);

test('accepts A2UI arrays, wrappers, single messages and NDJSON in order', () => {
  const { core } = loadCore();
  const source = core.exampleText({ ...chat, protocol: 'a2ui' }, trip);
  const messages = JSON.parse(source) as unknown[];
  expect(core.parsePreviewSource(source, 'a2ui')).toEqual(messages);
  expect(core.parsePreviewSource(JSON.stringify({ messages }), 'a2ui')).toEqual(
    messages,
  );
  expect(
    core.parsePreviewSource(
      messages.map(message => JSON.stringify(message)).join('\n'),
      'a2ui',
    ),
  ).toEqual(messages);
  expect(core.parsePreviewSource(JSON.stringify(messages[0]), 'a2ui')).toEqual([
    messages[0],
  ]);
  expect(core.parsePreviewSource('', 'a2ui')).toEqual([]);
  expect(() =>
    core.parsePreviewSource(
      '{"version":"v0.8","createSurface":{"surfaceId":"demo"}}',
      'a2ui',
    )
  ).toThrow('v0.9');
  expect(() =>
    core.parsePreviewSource(`${JSON.stringify(messages[0])}\ninvalid`, 'a2ui')
  ).toThrow('第 2 行');
});

test('preserves Markdown whitespace and limits input size before rendering', () => {
  const { core } = loadCore();
  const source = '  # Markdown\n\n```openui\nroot = Card([])\n```\n\n';
  expect(core.parsePreviewSource(source, 'openui')).toEqual([{
    rawText: source,
    isStreaming: false,
  }]);
  expect(core.parsePreviewSource('', 'openui')).toEqual([{
    rawText: '',
    isStreaming: false,
  }]);
  expect(() => core.parsePreviewSource('a'.repeat(500_001), 'openui')).toThrow(
    '500,000',
  );
});

test('keeps protocol, catalog, case and inline drafts independent, including empty drafts', () => {
  const { core } = loadCore();
  const selections = [
    chat,
    { ...chat, protocol: 'a2ui' as const },
    { ...chat, library: 'stack' as const },
    { ...chat, id: 'basic' },
    { ...chat, inlineMode: true },
  ];
  const values = new Map(
    selections.map((
      selection,
      index,
    ) => [core.draftKey(selection), String(index)]),
  );
  expect(values.size).toBe(selections.length);
  for (const [index, selection] of selections.entries()) {
    expect(
      core.readDraft({ getItem: key => values.get(key) ?? null }, selection),
    ).toBe(String(index));
  }
  expect(core.readDraft({ getItem: () => '' }, chat)).toBe('');
  expect(core.readDraft({
    getItem: () => {
      throw new Error('Storage disabled');
    },
  }, chat)).toBeNull();
  const url = 'https://example.com/genui/lynx-genui-stream.html';
  expect(
    core.readSelection(
      `${url}?library=chat&case=doc-hokkaido-turbo-v12&inlineMode=1`,
    ),
  ).toEqual({ ...chat, id: 'doc-hokkaido-turbo-v12', inlineMode: true });
  expect(
    core.readSelection(`${url}?protocol=a2ui`, {
      getItem: () => JSON.stringify({ ...chat, id: 'doc-hokkaido-turbo-v12' }),
    }).protocol,
  ).toBe('a2ui');
});

test('restores basic and Hokkaido selections while explicit links override saved selections', () => {
  const { core } = loadCore();
  const url = 'https://example.com/genui/lynx-genui-stream.html';
  const basic = { ...chat, id: 'basic', inlineMode: true };
  const storage = { getItem: () => JSON.stringify(basic) };
  expect(core.readSelection(url, storage)).toEqual(basic);
  expect(core.readSelection(`${url}?case=basic&inlineMode=1`)).toEqual(basic);
  expect(core.readSelection(`${url}?library=chat&case=basic`)).toEqual({
    ...basic,
    inlineMode: false,
  });
  expect(core.readSelection(`${url}?case=${chat.id}`, storage)).toEqual(chat);
  expect(core.readSelection(`${url}?protocol=a2ui&case=${chat.id}`, storage))
    .toEqual({ ...chat, protocol: 'a2ui', id: 'basic' });
});

test('uses Hokkaido for default and retired OpenUI case links without loading their drafts', () => {
  const { core } = loadCore();
  const url = 'https://example.com/genui/lynx-genui-stream.html';
  const retired = { ...chat, library: 'stack' as const, id: 'basic' };
  const saved = new Map([
    ['lynx-genui-stream:selection:v1', JSON.stringify(retired)],
    [core.draftKey(retired), 'root = Stack([])'],
  ]);
  const storage = { getItem: (key: string) => saved.get(key) ?? null };
  expect(core.readSelection(url)).toEqual(chat);
  for (
    const href of [
      url,
      `${url}?library=stack&case=basic`,
      `${url}?library=chat&case=six-day-trip`,
    ]
  ) {
    const selection = core.readSelection(href, storage);
    expect(selection).toEqual(chat);
    expect(core.readDraft(storage, selection)).toBeNull();
    expect(core.exampleText(selection, trip)).toBe(trip);
  }
});

test('packages all itinerary image aliases and resolves only known resource literals', () => {
  const { core } = loadCore();
  for (const target of Object.values(resources)) {
    if (target.startsWith('./')) {
      expect(existsSync(new URL(target, publicDirectory))).toBe(true);
    }
  }
  const resolved = core.resolveExampleAssets(
    trip,
    new URL('https://example.com/genui/'),
    resources,
  );
  expect(resolved).not.toContain('"/api/assets/');
  expect(resolved).not.toContain('"/api/links/');
  expect(resolved).toContain(
    'https://example.com/genui/demos/openui/document/assets/',
  );
  const custom =
    'TextContent("Mention /api/assets/example in prose")\nImage("/custom.png")';
  expect(
    core.resolveExampleAssets(
      custom,
      new URL('https://example.com/genui/'),
      resources,
    ),
  ).toBe(custom);
});

test.each([
  'https://example.com/genui/lynx-genui-stream.html',
  'https://example.com/lynx-genui-stream.html',
])(
  'keeps catalog, inline mode, and assets on the deployment origin: %s',
  location => {
    const { core } = loadCore();
    const url = new URL(
      core.renderUrl(location, 'navigation', { ...chat, inlineMode: true }),
    );
    expect(url.href.startsWith(new URL('./render.html', location).href)).toBe(
      true,
    );
    expect(url.searchParams.get('openuiLibrary')).toBe('chat');
    expect(url.searchParams.get('inlineMode')).toBe('1');
    expect(url.searchParams.get('rawText')).toBe('');
    expect(url.searchParams.get('previewNavigationToken')).toBe('navigation');
    const a2ui = new URL(
      core.renderUrl(location, 'a2ui', { ...chat, protocol: 'a2ui' }),
    );
    expect(a2ui.searchParams.get('messages')).toBe('[]');
    expect(a2ui.searchParams.has('openuiLibrary')).toBe(false);
  },
);

test('coalesces startup updates, rejects stale readiness, and replaces A2UI sequences', () => {
  const { core, listeners, timers } = loadCore();
  const sent: Array<{ message: unknown; origin: string }> = [];
  const errors: string[] = [];
  let readyCount = 0;
  const frame: Frame = {
    src: '',
    contentWindow: {
      postMessage(message, origin) {
        sent.push({ message, origin });
      },
    },
  };
  const bridge = core.createRendererBridge({
    frame,
    location: 'https://example.com/genui/lynx-genui-stream.html',
    onReady() {
      readyCount++;
    },
    onError(message) {
      errors.push(message);
    },
    onAction() {/* Actions are displayed without executing them. */},
  });
  bridge.reset(chat);
  const staleToken = new URL(frame.src).searchParams.get(
    'previewNavigationToken',
  );
  bridge.render([{ rawText: 'obsolete' }]);
  bridge.reset({ ...chat, inlineMode: true });
  bridge.render([{ rawText: 'partial', isStreaming: true }]);
  bridge.render([{ rawText: 'complete', isStreaming: false }]);
  const token = new URL(frame.src).searchParams.get('previewNavigationToken');
  const onMessage = listeners.get('message')!;
  const data = {
    type: 'A2UI_RENDER_READY',
    runtimeReady: true,
    navigationToken: token,
    frameUrl: frame.src,
  };
  onMessage({
    origin: 'https://other.example',
    source: frame.contentWindow,
    data,
  });
  onMessage({ origin: 'https://example.com', source: {}, data });
  onMessage({
    origin: 'https://example.com',
    source: frame.contentWindow,
    data: { ...data, navigationToken: staleToken },
  });
  expect(sent).toEqual([]);
  onMessage({
    origin: 'https://example.com',
    source: frame.contentWindow,
    data,
  });
  expect(sent).toEqual([{
    origin: 'https://example.com',
    message: {
      type: 'A2UI_LIVE_MESSAGES',
      messages: [{ rawText: 'complete', isStreaming: false }],
    },
  }]);
  expect(readyCount).toBe(1);
  expect(timers.size).toBe(0);
  bridge.render([], true);
  expect(sent[sent.length - 1]?.message).toEqual({
    type: 'A2UI_REPLAY_MESSAGES',
    messages: [],
  });
  onMessage({
    origin: 'https://example.com',
    source: frame.contentWindow,
    data: {
      type: 'OPENUI_RENDER_ERRORS',
      navigationToken: staleToken,
      errors: [{ message: 'stale' }],
    },
  });
  expect(errors).toEqual([]);
  bridge.dispose();
  expect(listeners.size).toBe(0);
});

test('streams cumulative Unicode text and sends completion only after the full response', async () => {
  const { core } = loadCore();
  const sent: unknown[][] = [];
  const response = '# Trip 🌏\n'.repeat(9);
  const final = [{ rawText: response, isStreaming: false }];
  const bridge = {
    ready: false,
    render(messages: unknown[]) {
      sent.push(messages);
    },
  };
  await core.playPreview(
    bridge,
    'openui',
    final,
    new AbortController().signal,
    ms => {
      if (ms === 50) {
        expect(sent).toEqual([]);
        bridge.ready = true;
      }
      return Promise.resolve();
    },
  );
  expect(sent[0]).toEqual([{
    rawText: Array.from(response).slice(0, 24).join(''),
    isStreaming: true,
  }]);
  expect(sent[sent.length - 1]).toEqual(final);
});

test('does not finalize an interrupted OpenUI reply or continue a cancelled A2UI sequence', async () => {
  const { core } = loadCore();
  for (const protocol of ['openui', 'a2ui']) {
    const sent: unknown[][] = [];
    const controller = new AbortController();
    const messages = protocol === 'openui'
      ? [{ rawText: 'content '.repeat(10), isStreaming: false }]
      : [{ id: 'first' }, { id: 'second' }];
    const bridge = {
      ready: true,
      render(messages: unknown[]) {
        sent.push(messages);
      },
    };
    await expect(
      core.playPreview(
        bridge,
        protocol,
        messages,
        controller.signal,
        () => {
          controller.abort();
          return Promise.resolve();
        },
      ),
    ).rejects.toThrow();
    expect(sent.length).toBe(1);
    if (protocol === 'openui') {
      expect(sent[0]).toEqual([{
        rawText: 'content '.repeat(3),
        isStreaming: true,
      }]);
    } else expect(sent[0]).toEqual([{ id: 'first' }]);
  }
});

test('preserves query parameters and hashes on the extensionless route', () => {
  const alias = readFileSync(
    new URL('lynx-genui-stream/index.html', publicDirectory),
    'utf8',
  );
  const code = /<script>([\s\S]*?)<\/script>/.exec(alias)![1]!;
  let destination = '';
  runInNewContext(code, {
    URL,
    location: {
      href:
        'https://example.com/genui/lynx-genui-stream/?library=chat&inlineMode=1#source',
      replace(value: string) {
        destination = value;
      },
    },
  });
  expect(destination).toBe(
    'https://example.com/genui/lynx-genui-stream.html?library=chat&inlineMode=1#source',
  );
});
