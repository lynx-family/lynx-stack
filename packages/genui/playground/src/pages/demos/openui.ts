// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { EditorView } from '@uiw/react-codemirror';

import type { DemosListSource } from './DemosList.js';
import type { DemosPageSource } from './type.js';
import {
  OPENUI_SCENARIOS,
  parseOpenUIScenarioRaw,
} from '../../mock/openui-scenarios.js';
import type { OpenUIScenario } from '../../mock/openui-scenarios.js';
import { buildOpenUIRenderUrl } from '../../utils/renderUrl.js';

interface OpenUIPreviewInput {
  rawText: string;
  inlineMode?: boolean;
  rawTextUrl?: string;
  openuiLibrary?: 'stack' | 'chat';
}

const OPENUI_PLAYBACK_CHUNK_SIZE = 240;
const OPENUI_CODE_EXTENSIONS = [EditorView.lineWrapping];

export const OPENUI_DEMOS_LIST_SOURCE = {
  title: 'OpenUI Showcase',
  description:
    'Explore OpenUI Lang examples rendered through the Lynx preview runtime.',
  scenarios: OPENUI_SCENARIOS,
  sections: [
    {
      id: 'chat',
      title: 'OpenUI Chat',
      hideScenarioBadges: true,
      scenarios: OPENUI_SCENARIOS.filter(scenario =>
        scenario.library === 'chat'
      ),
      layout: 'flow',
    },
    {
      id: 'examples',
      title: 'Stack Examples',
      scenarios: OPENUI_SCENARIOS.filter(scenario =>
        scenario.library !== 'chat' && !scenario.id.startsWith('canvas-')
      ),
      layout: 'flow',
    },
    {
      id: 'canvas',
      title: 'Canvas · Web only',
      hideScenarioBadges: true,
      scenarios: OPENUI_SCENARIOS.filter(scenario =>
        scenario.id.startsWith('canvas-')
      ),
      layout: 'flow',
    },
  ],
  createPreviewUrl({ baseUrl, scenario, theme }) {
    return buildOpenUIRenderUrl({
      ...(scenario.sourcePath
        ? { rawTextUrl: new URL(scenario.sourcePath, baseUrl).href }
        : { rawText: scenario.raw }),
      openuiLibrary: scenario.library,
      inlineMode: scenario.inlineMode,
      theme,
      instant: true,
    }, baseUrl);
  },
  createResetKey({ protocol, theme }) {
    return `${protocol.name}|${theme}`;
  },
} satisfies DemosListSource<OpenUIScenario>;

function findDetailScenario(id?: string): OpenUIScenario | undefined {
  if (!id) return undefined;
  return OPENUI_SCENARIOS.find((scenario) => scenario.id === id);
}

function chunkOpenUI(rawText: string): string[] {
  const chunks: string[] = [];
  for (
    let index = 0;
    index < rawText.length;
    index += OPENUI_PLAYBACK_CHUNK_SIZE
  ) {
    chunks.push(rawText.slice(index, index + OPENUI_PLAYBACK_CHUNK_SIZE));
  }
  return chunks;
}

export const OPENUI_DEMOS_PAGE_SOURCE = {
  scenarios: OPENUI_SCENARIOS,
  sections: OPENUI_DEMOS_LIST_SOURCE.sections,
  findScenario: findDetailScenario,
  getEditorValue(scenario) {
    return scenario.raw;
  },
  createScenarioPreviewInput(scenario) {
    return {
      rawText: scenario.raw,
      ...(scenario.inlineMode ? { inlineMode: true } : {}),
      rawTextUrl: scenario.sourcePath,
      openuiLibrary: scenario.library,
    };
  },
  commit({ editorValue, scenario }) {
    if (!editorValue.trim()) return { error: 'Raw output is empty.' };
    return {
      value: {
        previewInput: {
          rawText: editorValue,
          ...(scenario?.inlineMode ? { inlineMode: true } : {}),
          rawTextUrl: editorValue === scenario?.raw
            ? scenario.sourcePath
            : undefined,
          openuiLibrary: scenario?.library,
        },
        playbackChunks: chunkOpenUI(editorValue),
        meta: undefined,
      },
    };
  },
  createPreviewSource({ input, isPlaybackActive, theme }) {
    return {
      kind: 'openui',
      ...(input.openuiLibrary ? { openuiLibrary: input.openuiLibrary } : {}),
      rawText: input.rawText,
      ...(input.inlineMode ? { inlineMode: true } : {}),
      ...(input.rawTextUrl ? { rawTextUrl: input.rawTextUrl } : {}),
      theme,
      playbackMode: isPlaybackActive,
    };
  },
  formatPlaybackChunk(chunk) {
    return chunk;
  },
  emptyEditorValue: '',
  emptyPlaybackError: 'Nothing to play: raw output is empty.',
  resetPlaybackOnFill: true,
  editor: {
    title: 'OpenUI Output',
    toolbarClassName: 'openuiCodeToolbar',
    titleClassName: 'openuiCodeTitle',
    titleTextClassName: 'openuiCodeTitleText',
    actionsClassName: 'openuiToolbarActions',
    editorClassName: 'openuiCodeEditor',
    iconOnlyActions: true,
    extensions: OPENUI_CODE_EXTENSIONS,
    basicSetup: {
      lineNumbers: false,
      foldGutter: false,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: true,
    },
    defaultView: 'raw',
    views: [
      {
        id: 'raw',
        label: 'Raw',
        title: 'Raw Output',
        editable: true,
        getValue({ editorValue }) {
          return editorValue;
        },
      },
      {
        id: 'parsed',
        label: 'JSON',
        title: 'Parsed JSON',
        editable: false,
        getValue({ editorValue, scenario }) {
          if (!editorValue.trim()) return '';
          try {
            return parseOpenUIScenarioRaw(editorValue, scenario?.library);
          } catch (error) {
            return `Unable to parse OpenUI DSL:\n${String(error)}`;
          }
        },
      },
    ],
    splitterAriaLabel: 'Resize Playback and OpenUI output panels',
    panelResizeAriaLabel: 'Resize OpenUI output and preview panels',
    emptyPreviewTitle: 'Select a scenario to preview',
  },
} satisfies DemosPageSource<
  OpenUIScenario,
  OpenUIPreviewInput,
  string,
  undefined
>;
