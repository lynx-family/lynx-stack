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
      id: 'examples',
      title: 'Examples',
      scenarios: OPENUI_SCENARIOS,
      layout: 'flow',
    },
  ],
  createPreviewUrl({ baseUrl, scenario }) {
    return buildOpenUIRenderUrl({
      rawText: scenario.raw,
      instant: true,
    }, baseUrl);
  },
  createResetKey({ protocol }) {
    return protocol.name;
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
  findScenario: findDetailScenario,
  getEditorValue(scenario) {
    return scenario.raw;
  },
  createScenarioPreviewInput(scenario) {
    return { rawText: scenario.raw };
  },
  commit({ editorValue }) {
    if (!editorValue.trim()) return { error: 'Raw output is empty.' };
    return {
      value: {
        previewInput: { rawText: editorValue },
        playbackChunks: chunkOpenUI(editorValue),
        meta: undefined,
      },
    };
  },
  createPreviewSource({ input, isPlaybackActive }) {
    return {
      kind: 'openui',
      rawText: input.rawText,
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
          if (scenario && editorValue === scenario.raw) return scenario.parsed;
          try {
            return parseOpenUIScenarioRaw(editorValue);
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
