// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG } from '../../../agent/a2ui/a2ui-catalog.js';
import { createA2UIImageSourcePolicy } from '../../../agent/a2ui/a2ui-image-source-policy.js';
import {
  createA2UIOpenURLPolicy,
  userProvidedA2UIURLSources,
} from '../../../agent/a2ui/a2ui-open-url-policy.js';
import { A2UIProtocolMessageStreamParser } from '../../../agent/a2ui/a2ui-stream-parser.js';
import {
  expressMessages,
  validateExpressOutput,
} from '../../../agent/a2ui-express/format.js';
import { generatedArkImageURLs } from '../../../agent/common/ark-image-generation-tool.js';
import {
  createSearchRunScope,
  searchedDoubaoDocumentURLs,
  searchedDoubaoImageURLs,
} from '../../../agent/common/doubao-search-tool.js';
import {
  expressProcessor,
  expressService,
} from '../../../service/a2ui-express/agent.js';
import type {
  ChatMessage,
  ConversationContext,
} from '../../../service/common/types.js';
import { publishA2UIPayload } from '../../a2ui/payload-publisher.js';
import { createTextStreamRoute } from '../../common/text-stream-route.js';

export default createTextStreamRoute(() => {
  const scope = createSearchRunScope();
  const validationOptions = (
    messages: ChatMessage[],
    conversation?: ConversationContext,
  ) => ({
    isImageSourceAllowed: createA2UIImageSourcePolicy(
      [messages, conversation],
      () => [
        ...searchedDoubaoImageURLs(scope),
        ...generatedArkImageURLs(scope),
      ],
    ),
    isOpenUrlAllowed: createA2UIOpenURLPolicy(
      userProvidedA2UIURLSources(messages, conversation?.history),
      () => searchedDoubaoDocumentURLs(scope),
    ),
  });
  return {
    scope: 'a2ui-express',
    path: '/a2ui-express/stream',
    getService: () => ({
      streamAsAsyncIterable: (messages, opts, conversation, signal) =>
        expressService.streamAsAsyncIterable(
          messages,
          opts,
          conversation,
          signal,
          scope,
        ),
    }),
    createMessageStream(messages, conversation) {
      const stream = expressProcessor.openStream();
      const preview = new A2UIProtocolMessageStreamParser(
        validationOptions(messages, conversation),
      );
      const render = (parts: ReturnType<typeof stream.feed>) => {
        const compiled = expressMessages(parts);
        return compiled.length > 0 ? preview.pushMessages(compiled) : [];
      };
      return {
        feed: chunk => render(stream.feed(chunk)),
        close: () => render(stream.close()),
      };
    },
    async postprocess(
      source,
      { messages, conversation, recordArtifactUpload },
    ) {
      const result = validateExpressOutput(
        source,
        BASIC_CATALOG,
        expressProcessor,
        validationOptions(messages, conversation),
      );
      if (!result.ok) throw new Error(result.errors.join('\n'));
      const start = performance.now();
      const preview = await publishA2UIPayload(result.messages, undefined, {
        method: 'a2ui-express',
        type: 'preview',
      });
      recordArtifactUpload(performance.now() - start);
      return { messages: result.messages, preview };
    },
  };
});
