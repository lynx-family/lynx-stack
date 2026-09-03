// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ChatArtifact,
  ChatMessageModel,
  ChatTurnPersistence,
} from '../../shared-ui/types.js';
import { LYNX_XML_SCENARIOS } from '../demos/lynx-xml-presentation.js';
import type { LynxXmlScenario } from '../demos/lynx-xml-presentation.js';

export interface LynxXmlOutput {
  source: string;
}

export const LYNX_XML_LOCAL_EXAMPLE_PROMPT_PREFIX =
  'Load local Lynx XML example: ';

export const LYNX_XML_WELCOME_MESSAGE: ChatMessageModel = {
  kind: 'assistant',
  text:
    'Describe the interface you want. I will stream a complete zero-build .lynxml artifact and render it directly in Lynx Preview.',
};

export const LYNX_XML_SUGGESTIONS = [
  {
    label: '🌤️ Weather dashboard',
    text:
      'Create an interactive weather dashboard for Shanghai with current conditions, a five-day forecast, and a unit toggle. Use only self-contained data and Lynx-native shapes.',
  },
  {
    label: '✅ Habit tracker',
    text:
      'Create a polished daily habit tracker with progress, four tappable habits, and a reset action. Make it responsive and keep all interaction on the main thread.',
  },
  {
    label: '🎵 Music player',
    text:
      'Create a compact music-player interface with a self-contained album-art treatment, track metadata, progress, and working previous, play/pause, and next controls.',
  },
] as const;

export function formatLynxXmlCharacterCount(source: string): string {
  return `${source.length.toLocaleString()} chars`;
}

export function createGeneratedLynxXmlStatus(
  output: LynxXmlOutput,
): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'sparkles',
    text: `Generated a complete Lynx XML artifact (${
      formatLynxXmlCharacterCount(output.source)
    }). Lynx Preview is rendering it now.`,
  };
}

export function createLocalLynxXmlExampleStatus(
  title: string,
): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'zap',
    text: `Loaded local Lynx XML example ${title}. No API call was made.`,
  };
}

export function readLocalLynxXmlExampleTitle(content: string): string | null {
  if (!content.startsWith(LYNX_XML_LOCAL_EXAMPLE_PROMPT_PREFIX)) return null;
  return content.slice(LYNX_XML_LOCAL_EXAMPLE_PROMPT_PREFIX.length).trim()
    || null;
}

export function createLynxXmlArtifact(output: LynxXmlOutput): ChatArtifact {
  return {
    title: 'Generated Lynx XML Artifact',
    meta: `.lynxml · ${formatLynxXmlCharacterCount(output.source)}`,
    views: [{
      id: 'source',
      label: 'Source',
      text: output.source,
      language: 'text',
    }],
  };
}

export function persistLynxXmlOutput(
  output: LynxXmlOutput,
): ChatTurnPersistence {
  return {
    assistantContent: output.source,
    a2uiMessages: [],
    previewMessages: [],
  };
}

function loadExample(scenario: LynxXmlScenario) {
  const output = { source: scenario.source };
  const userText = `${LYNX_XML_LOCAL_EXAMPLE_PROMPT_PREFIX}${scenario.title}`;
  return {
    userText,
    messages: [
      { ...LYNX_XML_WELCOME_MESSAGE },
      { kind: 'user' as const, text: userText },
      createLocalLynxXmlExampleStatus(scenario.title),
    ],
    output,
    persistence: persistLynxXmlOutput(output),
  };
}

export const LYNX_XML_PRESENTATION = {
  copy: {
    description:
      'Describe a Vanilla Lynx interface, watch its .lynxml source stream in real time, and render the complete zero-build artifact in Lynx Preview.',
    inputAriaLabel: 'Describe the Lynx XML interface to generate',
    inputPlaceholder:
      'Describe the layout, data, visual style, and interactions for your Lynx XML artifact...',
    agentLabel: 'Lynx XML Agent',
  },
  suggestions: LYNX_XML_SUGGESTIONS,
  examples: {
    items: LYNX_XML_SCENARIOS,
    item(scenario: LynxXmlScenario) {
      return {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
      };
    },
    load: loadExample,
  },
  preview: {
    emptyTitle: 'Send a prompt to generate Lynx XML',
    emptySubtitle: 'The complete .lynxml artifact will render here',
    generatingHint:
      'The .lynxml source is streaming into the artifact panel. Preview starts as soon as the complete document arrives.',
    emptyHint:
      'No Lynx XML artifact yet. Send a prompt or load a local example to begin.',
  },
} as const;
