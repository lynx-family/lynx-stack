// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIChatOptions } from './a2ui-agent.js';
import { loadBasicCatalog } from '../../agent/a2ui/a2ui-catalog.js';
import { createA2UIImageSourcePolicy } from '../../agent/a2ui/a2ui-image-source-policy.js';
import {
  createA2UIOpenURLPolicy,
  userProvidedA2UIURLSources,
} from '../../agent/a2ui/a2ui-open-url-policy.js';
import { composeJevA2UI } from '../../agent/a2ui/jev-composer.js';
import {
  consumeJevComposition,
  createJevCompositionStream,
} from '../common/jev-composition.js';
import type { ChatMessage, ConversationContext } from '../common/types.js';

export async function streamJevComposition(
  messages: ChatMessage[],
  opts: A2UIChatOptions,
  conversation?: ConversationContext,
  abortSignal?: AbortSignal,
) {
  const catalog = opts.catalog ?? await loadBasicCatalog();
  return createJevCompositionStream(
    opts,
    abortSignal,
    async function*(runtime) {
      const validationOptions = {
        isImageSourceAllowed: createA2UIImageSourcePolicy([
          messages,
          conversation,
          catalog,
        ]),
        isOpenUrlAllowed: createA2UIOpenURLPolicy(
          userProvidedA2UIURLSources(messages, conversation?.history),
        ),
      };
      let snapshots = 0;
      let text = '';
      for await (
        const snapshot of composeJevA2UI({
          messages,
          conversation,
          catalog,
          validationOptions,
          enableDesignGuidance: opts.enableDesignGuidance,
          hostedMcpApps: opts.hostedMcpApps,
          ...runtime,
        })
      ) {
        text = JSON.stringify(snapshot);
        const delta = snapshots === 0 ? snapshot : snapshot.slice(2);
        yield {
          text,
          delta: `${snapshots === 0 ? '[' : ','}${
            delta.map(item => JSON.stringify(item)).join(',')
          }`,
          step: ++snapshots,
        };
      }
      yield { text, delta: ']' };
    },
  );
}

export async function generateJevComposition(
  messages: ChatMessage[],
  opts: A2UIChatOptions,
  conversation?: ConversationContext,
  signal?: AbortSignal,
) {
  return consumeJevComposition(
    await streamJevComposition(
      messages,
      opts,
      conversation,
      signal,
    ),
  );
}
