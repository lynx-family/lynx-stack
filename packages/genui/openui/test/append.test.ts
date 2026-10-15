// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  BUILTINS,
  createParser,
  createStreamingParser,
  evaluate,
  evaluateElementProps,
  isBuiltin,
} from '@openuidev/lang-core';
import type { ElementNode, OpenUIError } from '@openuidev/lang-core';
import { expect, test } from '@rstest/core';

import {
  createQueryDataStore,
  getQueryDefaults,
} from '../src/data-tools/index.js';
import {
  buildOpenUiSystemPrompt,
  createOpenUiPromptLibrary,
} from '../src/openui-prompt/index.js';

const library = createOpenUiPromptLibrary();

function parse(expression: string) {
  const source =
    `root = Stack([TextContent("" + @Count(data.items)), Button("Add", Action([@Run(add), @Run(data)]))])
data = Query("openui_query", { key: "data" }, { items: [] })
add = Mutation("openui_mutation", { key: "data", value: { items: ${expression} } })`;
  const result = createParser(library.toJSONSchema(), library.root).parse(
    source,
  );
  expect(result.meta.errors).toEqual([]);
  expect(result.meta.unresolved).toEqual([]);
  expect(result.meta.incomplete).toBe(false);
  return { source, result };
}

function append(expression: string, items: unknown[]) {
  const { result } = parse(expression);
  const args = evaluate(result.mutationStatements[0]!.argsAST!, {
    getState: () => null,
    resolveRef: () => ({ items }),
  }) as { value: { items: unknown[] } };
  return args.value;
}

test('Append adds exactly one item without modifying the original array', () => {
  const item = Object.freeze({ id: 1 });
  const items = [item];
  Object.freeze(items);
  const result = append('@Append(data.items, { id: 2 })', items);
  expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.items).not.toBe(items);
  expect(result.items[0]).toBe(item);
  expect(items).toEqual([{ id: 1 }]);
  expect(append('@Append(data.items, null)', []).items).toEqual([null]);
  expect(append('@Append(data.items, [2, 3])', [1]).items).toEqual([1, [2, 3]]);
});

test.each([
  '@Append(null, 1)',
  '@Append("text", 1)',
  '@Append({}, 1)',
  '@Append()',
  '@Append(data.items)',
  '@Append(data.items, 1, 2)',
])('Append rejects invalid arguments: %s', expression => {
  expect(() => append(expression, [])).toThrow(
    '@Append requires an array and exactly one item',
  );
});

test('Append supports streamed Mutation arguments and persisted Query refreshes', () => {
  const { source, result } = parse('@Append(data.items, { id: 1 })');
  const parser = createStreamingParser(library.toJSONSchema(), library.root);
  for (let end = 1; end <= source.length; end++) {
    parser.set(source.slice(0, end));
  }
  const streamed = parser.set(source);
  expect(streamed.meta.errors).toEqual([]);
  expect(streamed.meta.unresolved).toEqual([]);
  let saved: Record<string, unknown> | null = null;
  const store = createQueryDataStore({
    scope: 'append-test',
    initialQueryResults: getQueryDefaults(result),
    storage: {
      read: () => saved,
      write: (_scope, data) => {
        saved = { ...data };
      },
    },
  });
  const ctx = { getState: () => null, resolveRef: () => store.query('data') };
  const next = evaluate(streamed.mutationStatements[0]!.argsAST!, ctx) as {
    key: string;
    value: unknown;
  };
  store.mutate(next.key, next.value);
  expect(store.query('data')).toEqual({ items: [{ id: 1 }] });
  expect(getQueryDefaults(result)).toEqual({ data: { items: [] } });
  const errors: OpenUIError[] = [];
  const root = evaluateElementProps(streamed.root!, {
    library,
    store: null,
    ctx,
    errors,
  });
  expect(errors).toEqual([]);
  expect((root.props.children as ElementNode[])[0]!.props.text).toBe('1');
});

test('full and reduced prompts teach the same registered Append semantics', () => {
  const original = BUILTINS['Append'];
  expect(isBuiltin('Append')).toBe(true);
  for (
    const componentNames of [undefined, ['Stack', 'Button', 'TextContent']]
  ) {
    const prompt = buildOpenUiSystemPrompt({
      ...(componentNames ? { componentNames } : {}),
      promptOptions: {
        toolCalls: true,
        tools: ['openui_query', 'openui_mutation'],
      },
    });
    expect(prompt).toContain('@Append(array, item)');
    expect(prompt).toContain('An array item stays nested');
    expect(prompt).toContain('@Append does not generate IDs');
  }
  expect(BUILTINS['Append']).toBe(original);
});
