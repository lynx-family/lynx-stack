// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';

import type { DemosListSource } from './DemosList.js';
import type { DemosPageSource } from './type.js';
import {
  DYNAMIC_PRESETS,
  EXTENDED_STATIC_DEMOS,
  OFFICIAL_STATIC_DEMOS,
  STATIC_DEMOS,
  STATIC_DEMO_JSON_IDS,
} from '../../demos.js';
import type { DynamicPreset, StaticDemo } from '../../demos.js';
import { DEFAULT_A2UI_DEMO_URL } from '../../utils/demoUrl.js';
import { publishA2UIPayload } from '../../utils/publishPayload.js';
import { buildRenderUrl } from '../../utils/renderUrl.js';

type A2UIDemoScenario = DynamicPreset | StaticDemo;

interface A2UIDetailScenario {
  id: string;
  title: string;
  badge?: string;
  tags: string[];
  messages: unknown;
  actionMocks?: Record<string, unknown>;
}

interface A2UIPreviewInput {
  messages: unknown;
  messagesUrl?: string;
  actionMocks?: Record<string, unknown>;
  actionMocksUrl?: string;
  demoId?: string;
}

interface A2UICommitMeta {
  messages: unknown;
  actionMocks?: Record<string, unknown>;
  shouldPublish: boolean;
}

declare const __A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__: boolean;

const jsonExtensions = [json()];

const A2UI_DETAIL_SCENARIOS: A2UIDetailScenario[] = [
  ...STATIC_DEMOS.map((demo) => ({ ...demo, actionMocks: undefined })),
  ...DYNAMIC_PRESETS,
];

const EXTENDED_EXAMPLES: readonly A2UIDemoScenario[] = EXTENDED_STATIC_DEMOS;
const OFFICIAL_EXAMPLES: readonly A2UIDemoScenario[] = OFFICIAL_STATIC_DEMOS;
const DYNAMIC_EXAMPLES: readonly A2UIDemoScenario[] = DYNAMIC_PRESETS;
const ALL_EXAMPLES: readonly A2UIDemoScenario[] = [
  ...EXTENDED_EXAMPLES,
  ...OFFICIAL_EXAMPLES,
  ...DYNAMIC_EXAMPLES,
];

export const A2UI_DEMOS_LIST_SOURCE = {
  title: 'Showcase',
  description:
    'Browse playground examples and the curated A2UI gallery in one place. Click any card to jump into the full detail workspace.',
  scenarios: ALL_EXAMPLES,
  sections: [
    {
      id: 'playground',
      title: 'Playground Examples',
      scenarios: EXTENDED_EXAMPLES,
      layout: 'flow',
    },
    {
      id: 'gallery',
      title: 'A2UI Gallery',
      titleHref: 'https://a2ui-composer.ag-ui.com/gallery',
      scenarios: OFFICIAL_EXAMPLES,
      badge: 'From A2UI Gallery',
    },
  ],
  createPreviewUrl({ baseUrl, protocol, scenario, theme }) {
    return buildRenderUrl(
      {
        protocol,
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        messages: scenario.messages,
        theme,
        demoId: STATIC_DEMO_JSON_IDS.has(scenario.id)
          ? scenario.id
          : undefined,
        instant: true,
      },
      baseUrl,
    );
  },
  createResetKey({ protocol, theme }) {
    return `${protocol.name}|${theme}`;
  },
} satisfies DemosListSource<A2UIDemoScenario>;

function findDetailScenario(id?: string): A2UIDetailScenario | undefined {
  if (!id) return undefined;
  return A2UI_DETAIL_SCENARIOS.find((scenario) => scenario.id === id);
}

function getStaticJsonDemoId(
  scenario?: A2UIDetailScenario,
): string | undefined {
  return scenario && STATIC_DEMO_JSON_IDS.has(scenario.id)
    ? scenario.id
    : undefined;
}

function createScenarioPreviewInput(
  scenario: A2UIDetailScenario,
): A2UIPreviewInput {
  return {
    messages: scenario.messages,
    actionMocks: scenario.actionMocks,
    demoId: getStaticJsonDemoId(scenario),
  };
}

export const A2UI_DEMOS_PAGE_SOURCE = {
  scenarios: A2UI_DETAIL_SCENARIOS,
  findScenario: findDetailScenario,
  getEditorValue(scenario) {
    return JSON.stringify(scenario.messages ?? [], null, 2);
  },
  createScenarioPreviewInput,
  commit({ editorEdited, editorValue, scenario }) {
    let messages: unknown;
    try {
      messages = JSON.parse(editorValue) as unknown;
    } catch (error) {
      return { error: `Invalid JSON: ${String(error)}` };
    }

    const isKnownDemo = !editorEdited
      && A2UI_DETAIL_SCENARIOS.some((item) => item.id === scenario?.id);
    const actionMocks = scenario?.actionMocks;
    return {
      value: {
        previewInput: {
          messages,
          actionMocks,
          demoId: isKnownDemo ? getStaticJsonDemoId(scenario) : undefined,
        },
        playbackChunks: Array.isArray(messages) ? messages : [],
        meta: {
          messages,
          actionMocks,
          shouldPublish: !isKnownDemo
            && !__A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__,
        },
      },
    };
  },
  shouldPreparePreview(commit) {
    return commit.meta.shouldPublish;
  },
  async preparePreviewInput(commit) {
    const published = await publishA2UIPayload(
      commit.meta.messages,
      commit.meta.actionMocks,
    );
    return {
      messages: commit.meta.messages,
      messagesUrl: published.messagesUrl,
      actionMocks: commit.meta.actionMocks,
      actionMocksUrl: published.actionMocksUrl,
    };
  },
  createPreviewSource({ input, isPlaybackActive, protocol, theme }) {
    return {
      kind: 'a2ui',
      protocol,
      theme,
      demoUrl: DEFAULT_A2UI_DEMO_URL,
      messages: input.messages,
      messagesUrl: input.messagesUrl,
      actionMocks: input.actionMocks,
      actionMocksUrl: input.actionMocksUrl,
      demoId: input.demoId,
      playbackMode: isPlaybackActive,
    };
  },
  formatPlaybackChunk(chunk) {
    return JSON.stringify(chunk, null, 2);
  },
  emptyEditorValue: '[]',
  emptyPlaybackError: 'Nothing to play: messages list is empty.',
  editor: {
    title: 'A2UI Messages',
    badge: 'JSON',
    extensions: jsonExtensions,
    basicSetup: {
      lineNumbers: true,
      foldGutter: true,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: true,
    },
    renderPendingLabel: 'Publishing...',
    splitterAriaLabel: 'Resize Playback and Messages panels',
    panelResizeAriaLabel: 'Resize JSON and preview panels',
    emptyPreviewTitle: 'Select a demo to preview',
  },
} satisfies DemosPageSource<
  A2UIDetailScenario,
  A2UIPreviewInput,
  unknown,
  A2UICommitMeta
>;
