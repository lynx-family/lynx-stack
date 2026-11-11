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

export interface ReactWebOutput {
  source: string;
  files?: { 'App.tsx': string; 'App.css': string };
  artifact?: { webUrl: string };
}

export interface ReactWebStreamState {
  output: ReactWebOutput;
  complete: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readArtifact(value: unknown): ReactWebOutput['artifact'] {
  if (!isRecord(value) || typeof value.webUrl !== 'string') return undefined;
  try {
    const url = new URL(value.webUrl);
    if (
      ['http:', 'https:'].includes(url.protocol) && !url.username
      && !url.password
    ) {
      return { webUrl: value.webUrl };
    }
  } catch {
    // Incomplete or imported metadata is not a runnable artifact.
  }
  return undefined;
}

function parseSource(text: string): ReactWebOutput {
  const value: unknown = JSON.parse(text);
  if (
    !isRecord(value) || !isRecord(value.files)
    || typeof value.files['App.tsx'] !== 'string'
    || typeof value.files['App.css'] !== 'string'
  ) {
    throw new Error('The agent returned invalid ReactWeb source');
  }
  const files = {
    'App.tsx': value.files['App.tsx'],
    'App.css': value.files['App.css'],
  };
  return {
    source: JSON.stringify({ files }),
    files,
    artifact: readArtifact(value.artifact),
  };
}

function errorText(value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.error === 'string') return value.error;
    if (typeof value.message === 'string') return value.message;
  }
  return value instanceof Error
    ? value.message
    : 'ReactWeb generation or build failed';
}

function done(
  payload: unknown,
): ChatStreamStep<ReactWebStreamState, ReactWebOutput> {
  if (!isRecord(payload) || typeof payload.text !== 'string') {
    throw new Error('Missing ReactWeb source');
  }
  const artifact = isRecord(payload.metadata)
    ? readArtifact(payload.metadata.artifact)
    : undefined;
  if (!artifact) {
    throw new Error('The server did not return a completed ReactWeb build');
  }
  const output = { ...parseSource(payload.text), artifact };
  return {
    state: { output, complete: true },
    emissions: [{ type: 'final', output }],
  };
}

const success = (): ChatMessageModel => ({
  kind: 'status',
  tone: 'success',
  icon: 'sparkles',
  text: 'ReactWeb build ready. Web Preview is loading.',
});
const buildStatus: Record<string, string> = {
  queued: 'Waiting for a cloud build slot...',
  building: 'Building ReactWeb...',
  publishing: 'Publishing the compiled page...',
  ready: 'Build ready. Loading preview...',
};

export const REACTWEB_CHAT_ADAPTER = {
  id: 'reactweb',
  copy: {
    description:
      'Generate React DOM source, build it in the cloud, and preview the result.',
    inputAriaLabel: 'Describe the ReactWeb interface',
    inputPlaceholder:
      'Describe the layout, content, style, and interactions...',
    agentLabel: 'ReactWeb Agent',
    progressLabel: 'Generating ReactWeb source...',
    failurePrefix: 'ReactWeb generation failed',
  },
  suggestions: CHAT_PROMPT_SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    return {
      url: getChatEndpoint('reactweb', host, settings),
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
        return {
          state,
          emissions: [{
            type: 'progress',
            text: buildStatus[String(frame.data.status)]
              ?? 'Building ReactWeb...',
          }],
        };
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
          emissions: [{ type: 'partial', output }],
        };
      }
      return { state, emissions: [] };
    },
    fromJson: done,
    finish: state => state.complete ? state.output : null,
    error: errorText,
  },
  hydrate({ history }) {
    const messages: ChatMessageModel[] = [{
      kind: 'assistant',
      text:
        'Describe an interface. I will generate React DOM source, build it on the server, and preview it here.',
    }];
    let output: ReactWebOutput | null = null;
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
        // Ignore incomplete imported turns.
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
      text: 'Generating ReactWeb source...',
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
    source: output =>
      output?.artifact ? { kind: 'reactweb', ...output.artifact } : undefined,
    artifact(output) {
      return {
        title: 'ReactWeb source',
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
    emptyTitle: 'Send a prompt to generate ReactWeb',
    emptySubtitle: 'The compiled interface will appear here',
    generatingHint:
      'Source streams live. Preview updates when the cloud build completes.',
    emptyHint: 'Generate an interface to get a shareable Web preview.',
  },
} satisfies ChatProtocolAdapter<
  ReactWebOutput,
  ReactWebStreamState,
  ProviderSettings
>;
