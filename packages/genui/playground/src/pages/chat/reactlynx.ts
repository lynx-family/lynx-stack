// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  getChatEndpoint,
  toProviderRequestOptions,
} from './shared.js';
import type { ProviderSettings } from './shared.js';
import { CHAT_PROMPT_SUGGESTIONS } from './suggestions.js';
import type {
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatStreamStep,
} from './type.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';

interface ReactLynxArtifact {
  webUrl: string;
  nativeUrl: string;
}
export interface ReactLynxOutput {
  source: string;
  files?: { 'App.tsx': string; 'App.css': string };
  artifact?: ReactLynxArtifact;
}
export interface ReactLynxStreamState {
  output: ReactLynxOutput;
  complete: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseSource(text: string): ReactLynxOutput {
  const value: unknown = JSON.parse(text);
  if (
    !isRecord(value) || !isRecord(value.files)
    || typeof value.files['App.tsx'] !== 'string'
    || typeof value.files['App.css'] !== 'string'
  ) {
    throw new Error('The agent returned invalid ReactLynx source');
  }
  return {
    source: JSON.stringify({ files: value.files }),
    files: {
      'App.tsx': value.files['App.tsx'],
      'App.css': value.files['App.css'],
    },
    ...(readArtifact(value.artifact)
      ? { artifact: readArtifact(value.artifact) }
      : {}),
  };
}

function httpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function readArtifact(value: unknown): ReactLynxArtifact | undefined {
  if (!isRecord(value) || !httpUrl(value.webUrl) || !httpUrl(value.nativeUrl)) {
    return undefined;
  }
  return {
    webUrl: value.webUrl,
    nativeUrl: value.nativeUrl,
  };
}

function errorText(value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.error === 'string') return value.error;
    if (typeof value.message === 'string') return value.message;
  }
  return value instanceof Error
    ? value.message
    : 'ReactLynx generation or build failed';
}

function done(
  payload: unknown,
): ChatStreamStep<ReactLynxStreamState, ReactLynxOutput> {
  if (!isRecord(payload) || typeof payload.text !== 'string') {
    throw new Error('Missing ReactLynx source');
  }
  const artifact = isRecord(payload.metadata)
    ? readArtifact(payload.metadata.artifact)
    : undefined;
  if (!artifact) {
    throw new Error('The server did not return a completed ReactLynx build');
  }
  const output = {
    ...parseSource(payload.text),
    artifact,
  };
  return {
    state: { output, complete: true },
    emissions: [{ type: 'final', output }],
  };
}

const success = (): ChatMessageModel => ({
  kind: 'status',
  tone: 'success',
  icon: 'sparkles',
  text:
    'ReactLynx build ready. Web Preview is loading; the Native bundle is available below.',
});
const welcome = (): ChatMessageModel => ({
  kind: 'assistant',
  text:
    'Describe an interface. I will generate ReactLynx source, build it on the server, and preview it here.',
});
const buildStatus: Record<string, string> = {
  queued: 'Waiting for a cloud build slot...',
  building: 'Building ReactLynx for Web and Native...',
  publishing: 'Publishing the compiled bundles...',
  ready: 'Build ready. Loading preview...',
};

export const REACTLYNX_CHAT_ADAPTER = {
  id: 'reactlynx',
  copy: {
    description:
      'Generate ReactLynx source, build Web and Native bundles in the cloud, and preview the result.',
    inputAriaLabel: 'Describe the ReactLynx interface',
    inputPlaceholder:
      'Describe the layout, content, style, and interactions...',
    agentLabel: 'ReactLynx Agent',
    progressLabel: 'Generating ReactLynx source...',
    failurePrefix: 'ReactLynx generation failed',
  },
  suggestions: CHAT_PROMPT_SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    return {
      url: getChatEndpoint('reactlynx', host, settings),
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: prompt }],
        conversation: {
          ...conversation,
          history: conversation.history.map(message => {
            if (message.role !== 'assistant') return message;
            try {
              return {
                ...message,
                content: parseSource(message.content).source,
              };
            } catch {
              return message;
            }
          }),
        },
        ...toProviderRequestOptions(settings),
      },
    };
  },
  stream: {
    initial: () => ({ output: { source: '' }, complete: false }),
    reduce(state, frame) {
      if (frame.event === 'error') throw new Error(errorText(frame.data));
      if (frame.event === 'done') return done(frame.data);
      if (frame.event === 'build' && isRecord(frame.data)) {
        const text = buildStatus[String(frame.data.status)]
          ?? 'Building ReactLynx...';
        return { state, emissions: [{ type: 'progress', text }] };
      }
      if (frame.event === 'source') {
        const output = parseSource(JSON.stringify(frame.data));
        return {
          state: { output, complete: false },
          emissions: [{ type: 'partial', output }],
        };
      }
      if (
        frame.event === 'delta' && isRecord(frame.data)
        && typeof frame.data.text === 'string'
      ) {
        const output = { source: state.output.source + frame.data.text };
        return {
          state: { output, complete: false },
          emissions: [
            { type: 'progress', text: 'Generating ReactLynx source...' },
            { type: 'partial', output },
          ],
        };
      }
      return { state, emissions: [] };
    },
    fromJson: done,
    finish: state => state.complete ? state.output : null,
    error: errorText,
  },
  hydrate({ history }) {
    const messages: ChatMessageModel[] = [welcome()];
    let output: ReactLynxOutput | null = null;
    let metrics: PreviewPerformanceMetrics | undefined;
    for (const message of history) {
      if (message.previewMetrics) metrics = message.previewMetrics;
      if (message.role === 'user') {
        messages.push({ kind: 'user', text: message.content });
      }
      if (message.role !== 'assistant') continue;
      if (message.generationError) {
        messages.push({
          kind: 'status',
          tone: 'error',
          text: message.generationError,
          generationUsage: message.generationUsage,
        });
        continue;
      }
      try {
        output = parseSource(message.content);
        messages.push({
          ...success(),
          generationUsage: message.generationUsage,
        });
      } catch {
        // Ignore unrelated or incomplete imported turns.
      }
    }
    return { messages, output, ...(metrics ? { metrics } : {}) };
  },
  persist(output) {
    return {
      assistantContent: JSON.stringify({
        files: output.files,
        artifact: output.artifact,
      }),
      a2uiMessages: [],
      previewMessages: [],
    };
  },
  transcript: {
    pending: () => ({
      kind: 'status',
      tone: 'pending',
      icon: 'spinner',
      text: 'Generating ReactLynx source...',
    }),
    progress: text => ({
      kind: 'status',
      tone: 'pending',
      icon: 'spinner',
      text,
    }),
    success: () => [success()],
    failure: error => ({
      kind: 'status',
      tone: 'error',
      icon: 'error',
      text: error,
    }),
  },
  examples: {
    items: [],
    item: (example: never) => example,
    load: (example: never) => example,
  },
  preview: {
    delivery: 'reload',
    source(output) {
      return output?.artifact
        ? {
          kind: 'reactlynx',
          ...output.artifact,
        }
        : undefined;
    },
    artifact(output) {
      return {
        title: 'ReactLynx source',
        meta: 'App.tsx + App.css',
        views: output.files
          ? Object.entries(output.files).map(([name, text]) => ({
            id: name,
            label: name,
            text,
            language: 'text' as const,
          }))
          : [{
            id: 'source',
            label: 'Streaming source',
            text: output.source,
            language: 'text' as const,
          }],
      };
    },
    merge: (_current, next) => next,
    emptyTitle: 'Send a prompt to generate ReactLynx',
    emptySubtitle: 'The compiled interface will appear here',
    generatingHint:
      'Source streams live. Preview updates when the cloud build completes.',
    emptyHint: 'Generate an interface to get Web and Native bundles.',
  },
} satisfies ChatProtocolAdapter<
  ReactLynxOutput,
  ReactLynxStreamState,
  ProviderSettings
>;
