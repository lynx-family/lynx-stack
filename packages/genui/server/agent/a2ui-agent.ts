// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';

import type { A2UICatalog } from './a2ui-catalog';
import { loadBasicCatalog } from './a2ui-catalog';
import { buildA2UISystemPrompt } from './a2ui-prompt';
import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

export interface A2UICatalogExtension {
  id: string;
  component: string;
  systemAppendix?: string | undefined;
  tools?: ToolsInput | undefined;
}

export interface A2UIAgentOptions extends OpenAIProviderOptions {
  catalog?: A2UICatalog | undefined;
  extensions?: readonly A2UICatalogExtension[] | undefined;
  systemAppendix?: string | undefined;
}

interface A2UIAgentRunOptions {
  resourceId?: string | undefined;
  maxSteps?: number | undefined;
}

export interface A2UIAgent {
  generate: (
    messages: unknown,
    options?: A2UIAgentRunOptions,
  ) => unknown;
  stream: (
    messages: unknown,
    options?: A2UIAgentRunOptions,
  ) => unknown;
}

function collectCatalogExtensions(
  catalog: A2UICatalog,
  extensions: readonly A2UICatalogExtension[],
): {
  appendices: string[];
  tools: ToolsInput;
} {
  const ids = new Set<string>();
  const tools: ToolsInput = {};
  const appendices: string[] = [];

  const catalogComponents = new Set(
    catalog.components.map(component => component.name),
  );

  for (const extension of extensions) {
    if (!extension.id || ids.has(extension.id)) {
      throw new Error(
        extension.id
          ? `duplicate A2UI catalog extension ${extension.id}`
          : 'A2UI catalog extension id is required',
      );
    }
    if (!catalogComponents.has(extension.component)) {
      throw new Error(
        `A2UI catalog extension ${extension.id} requires missing component ${extension.component}`,
      );
    }
    ids.add(extension.id);
    if (extension.systemAppendix) {
      appendices.push(extension.systemAppendix);
    }
    for (const [name, tool] of Object.entries(extension.tools ?? {})) {
      if (tools[name]) {
        throw new Error(`duplicate A2UI catalog extension tool ${name}`);
      }
      tools[name] = tool;
    }
  }

  return { appendices, tools };
}

export async function createA2UIAgent(opts: A2UIAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);

  const catalog = opts.catalog ?? await loadBasicCatalog();
  const { appendices, tools } = collectCatalogExtensions(
    catalog,
    opts.extensions ?? [],
  );
  const appendix = [
    opts.systemAppendix,
    ...appendices,
  ].filter((value): value is string => Boolean(value)).join('\n\n');
  const promptOptions = {
    catalog,
    ...(appendix ? { appendix } : {}),
  };
  const instructions = buildA2UISystemPrompt(promptOptions);

  const agent = new Agent({
    id: 'a2ui-agent',
    name: 'A2UIAgent',
    instructions,
    model: buildModel(model),
    ...(Object.keys(tools).length > 0 ? { tools } : {}),
  }) as unknown as A2UIAgent;

  return { agent, model, catalog };
}
