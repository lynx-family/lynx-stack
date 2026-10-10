// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createParser,
  evaluate,
  evaluateElementProps,
} from '@openuidev/lang-core';
import type { ElementNode, EvaluationContext } from '@openuidev/lang-core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui-openui/openui-prompt';

import type { OpenUIChatOptions } from './openui-agent.js';
import { generatedArkImageURLs } from '../../agent/common/ark-image-generation-tool.js';
import type { ArkImageGenerationRunScope } from '../../agent/common/ark-image-generation-tool.js';
import { searchedDoubaoImageURLs } from '../../agent/common/doubao-search-tool.js';
import { createSourcePolicy } from '../../agent/common/source-policy.js';

function normalizeSource(source: string): string | undefined {
  try {
    const url = new URL(source);
    if (
      !['http:', 'https:'].includes(url.protocol) || url.username
      || url.password
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Check renderer image values against user/host and this request's tool results. */
export function createOpenUIImageGuard(
  supplied: readonly unknown[],
  scope: { requestContext: unknown },
  options: OpenUIChatOptions,
) {
  const allowed = createSourcePolicy(supplied, normalizeSource, () => [
    ...searchedDoubaoImageURLs(scope),
    ...generatedArkImageURLs(scope as ArkImageGenerationRunScope),
  ]);
  const library = createOpenUiPromptLibrary({
    ...(options.promptComponentNames === undefined
      ? {}
      : { componentNames: options.promptComponentNames }),
    ...(options.promptRoot === undefined ? {} : { root: options.promptRoot }),
  });
  const parser = createParser(library.toJSONSchema(), library.root);

  return (text: string): boolean => {
    const result = parser.parse(text);
    const resolving = new Set<string>();
    const evaluationContext: EvaluationContext = {
      getState: name => result.stateDeclarations[name],
      resolveRef: name => {
        if (resolving.has(name)) return undefined;
        const query = result.queryStatements.find(item =>
          item.statementId === name
        );
        if (!query?.defaultsAST) return undefined;
        resolving.add(name);
        try {
          return evaluate(query.defaultsAST, evaluationContext);
        } finally {
          resolving.delete(name);
        }
      },
    };
    const visit = (value: unknown): boolean => {
      if (!value || typeof value !== 'object') return true;
      if (Array.isArray(value)) return value.every(item => visit(item));
      if ('type' in value && value.type === 'element') {
        const node = value as ElementNode;
        const evaluated = evaluateElementProps(node, {
          library,
          store: null,
          ctx: evaluationContext,
        });
        if (node.typeName === 'Image') {
          const source = evaluated.props.url;
          if (typeof source === 'string' && source && !allowed(source)) {
            return false;
          }
          // An unfinished source must not reach the renderer during streaming.
          if (node.partial) return false;
        }
        return visit(evaluated.props);
      }
      return Object.values(value).every(item => visit(item));
    };
    return visit(result.root);
  };
}
