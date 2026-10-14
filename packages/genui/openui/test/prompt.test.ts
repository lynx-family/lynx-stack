// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  createParser,
  evaluate,
  evaluateElementProps,
} from '@openuidev/lang-core';
import type { ElementNode, OpenUIError } from '@openuidev/lang-core';
import { expect, test } from '@rstest/core';

import { actionPropSchema } from '../src/catalog/Action/schema.js';
import * as agentCatalog from '../src/catalog/agent.js';
import { createOpenUiLibrary } from '../src/core/createLibrary.jsx';
import { DATA_GENERATION_RULES } from '../src/data-tools/data-rules.js';
import {
  buildOpenUiSystemPrompt,
  createOpenUiPromptLibrary,
  openUiPromptActionPropSchema,
} from '../src/openui-prompt/index.js';

test('renderer and prompt reuse the agent catalog schemas and refs', () => {
  const renderer = createOpenUiLibrary();
  const prompt = createOpenUiPromptLibrary();

  expect(Object.keys(prompt.components).sort()).toEqual(
    Object.keys(agentCatalog).sort(),
  );
  expect(Object.keys(renderer.components).sort()).toEqual(
    Object.keys(agentCatalog).sort(),
  );
  for (const definition of Object.values(agentCatalog)) {
    const rendered = renderer.components[definition.name]!;
    expect(prompt.components[definition.name]).toBe(definition);
    expect(rendered.props).toBe(definition.props);
    expect(rendered.ref).toBe(definition.ref);
    expect(rendered.description).toBe(definition.description);
    expect(rendered.component).not.toBe(definition.component);
    expect(definition.component()).toBeNull();
  }
  expect(openUiPromptActionPropSchema).toBe(actionPropSchema);
});

test('published agent catalog and prompt entries load in Node without renderer dependencies', () => {
  const output = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `
      import assert from 'node:assert/strict';
      import { existsSync } from 'node:fs';
      import { registerHooks } from 'node:module';
      const loaded = [];
      registerHooks({
        resolve(specifier, context, nextResolve) {
          assert(!specifier.startsWith('@lynx-js/react'));
          assert(!specifier.startsWith('@lynx-js/lynx-ui'));
          return nextResolve(specifier, context);
        },
        load(url, context, nextLoad) {
          assert(!url.endsWith('.jsx'));
          assert(!url.endsWith('.css'));
          loaded.push(url);
          return nextLoad(url, context);
        },
      });
      const { Stack } = await import('@lynx-js/genui/openui/catalog/agent/Stack');
      assert.deepEqual(
        loaded.filter(url => url.includes('/catalog/') && url.endsWith('/definition.js'))
          .map(url => url.slice(url.lastIndexOf('/catalog/'))),
        ['/catalog/Stack/definition.js'],
      );
      const catalog = await import('@lynx-js/genui/openui/catalog/agent');
      assert.equal(catalog.Stack, Stack);
      const direct = await import('@lynx-js/genui-openui/catalog/agent');
      const { createOpenUiPromptLibrary } = await import('@lynx-js/genui/openui/prompt');
      const library = createOpenUiPromptLibrary();
      assert.equal(Object.keys(catalog).length, 26);
      for (const definition of Object.values(catalog)) {
        assert.equal(direct[definition.name], definition);
        assert.equal(library.components[definition.name], definition);
        assert.equal(definition.component(), null);
        for (const prefix of ['@lynx-js/genui/openui', '@lynx-js/genui-openui']) {
          const single = await import(prefix + '/catalog/agent/' + definition.name);
          assert.equal(single[definition.name], definition);
          const url = import.meta.resolve(prefix + '/catalog/' + definition.name);
          assert(url.endsWith('/' + definition.name + '/index.jsx'));
          assert(existsSync(new URL(url)));
        }
      }
      assert(library.prompt().includes('Stack'));
      console.log('agent catalog loaded');
    `,
  ], {
    cwd: new URL('../../', import.meta.url),
    encoding: 'utf8',
  });
  expect(output.trim()).toBe('agent catalog loaded');
});

test.each(['renderer', 'prompt'])(
  '%s List preserves the optional items slot before layout arguments',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const parse = (call: string) =>
      createParser(library.toJSONSchema(), library.root).parse(
        `root = Stack([greetList])\ngreetList = ${call}`,
      );
    const invalid = parse(
      'List([Text("Hello")], "vertical", "stretch", "s", false)',
    );
    expect(
      invalid.meta.errors.map(error => ({
        code: error.code,
        path: error.path,
      })),
    ).toEqual([
      { code: 'type-mismatch', path: '/direction' },
      { code: 'type-mismatch', path: '/align' },
      { code: 'type-mismatch', path: '/gap' },
    ]);
    const valid = parse(
      'List([Text("Hello")], null, "vertical", "stretch", "s", false)',
    );
    expect(valid.meta.errors).toEqual([]);
    expect(valid.meta.unresolved).toEqual([]);
    expect(valid.meta.incomplete).toBe(false);
    expect(valid.root).toMatchObject({
      typeName: 'Stack',
      props: {
        children: [{
          typeName: 'List',
          props: {
            direction: 'vertical',
            align: 'stretch',
            gap: 's',
            divider: false,
          },
        }],
      },
    });
  },
);

test.each([
  { componentNames: undefined },
  { componentNames: ['Stack', 'List', 'Text'] },
])(
  'teaches null placeholders with component selection %s',
  ({ componentNames }) => {
    const prompt = buildOpenUiSystemPrompt(
      componentNames ? { componentNames } : {},
    );
    expect(prompt).toContain(
      'use null for every skipped optional slot before a later argument',
    );
    expect(prompt).toContain(
      'List(children, null, "vertical", "stretch", "s", false)',
    );
  },
);

test('the default List layout example parses against the renderer contract', () => {
  const line = buildOpenUiSystemPrompt().split('\n').find(text =>
    text.startsWith('details = List(')
  );
  expect(line).toBeDefined();
  expect(line).toContain('], null, "vertical", "stretch", "s", false)');
  const library = createOpenUiLibrary();
  const result = createParser(library.toJSONSchema(), library.root).parse(
    `root = Stack([details])\n${line}`,
  );
  expect(result.root).not.toBeNull();
  expect(result.meta.errors).toEqual([]);
  expect(result.meta.unresolved).toEqual([]);
  expect(result.meta.incomplete).toBe(false);
});

test.each([
  { componentNames: undefined },
  { componentNames: ['Stack', 'TextContent', 'Icon'] },
  { componentNames: ['Stack'] },
])(
  'teaches closed component enums with component selection %s',
  ({ componentNames }) => {
    const prompt = buildOpenUiSystemPrompt(
      componentNames ? { componentNames } : {},
    );
    expect(prompt).toContain('Treat every component enum as a closed set');
    expect(prompt).toContain(
      'use only the exact values listed for that argument',
    );
    expect(prompt).toContain(
      'Do not borrow enum values from another component',
    );
    expect(prompt).toContain('or from the broader upstream UI or icon library');
    expect(prompt).toContain(
      'use another available component instead of inventing a value',
    );
  },
);

test.each(['renderer', 'prompt'])(
  '%s distinguishes TextContent size from Text variant for footer notes',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const parse = (call: string) =>
      createParser(library.toJSONSchema(), library.root).parse(
        `root = Stack([footerNote])\nfooterNote = ${call}`,
      );
    const invalid = parse('TextContent("Footer note", "caption")');
    expect(
      invalid.meta.errors.map(error => ({
        code: error.code,
        path: error.path,
      })),
    ).toEqual([{ code: 'type-mismatch', path: '/size' }]);

    for (
      const call of [
        'TextContent("Footer note", "small")',
        'Text("Footer note", "caption")',
      ]
    ) {
      const valid = parse(call);
      expect(valid.root).not.toBeNull();
      expect(valid.meta.errors).toEqual([]);
      expect(valid.meta.unresolved).toEqual([]);
      expect(valid.meta.incomplete).toBe(false);
    }
  },
);

test.each(['renderer', 'prompt'])(
  '%s rejects unsupported flight icons and accepts supported names',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const parse = (name: string) =>
      createParser(library.toJSONSchema(), library.root).parse(
        `root = Stack([headerTop])\nheaderTop = Icon("${name}")`,
      );
    const invalid = parse('flight');
    expect(
      invalid.meta.errors.map(error => ({
        code: error.code,
        path: error.path,
      })),
    ).toEqual([{ code: 'type-mismatch', path: '/name' }]);

    const valid = parse('location_on');
    expect(valid.root).not.toBeNull();
    expect(valid.meta.errors).toEqual([]);
    expect(valid.meta.unresolved).toEqual([]);
    expect(valid.meta.incomplete).toBe(false);
  },
);

test.each(['renderer', 'prompt'])(
  '%s evaluates the minimal Query and Mutation prompt example',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const source = DATA_GENERATION_RULES.split('Example:\n')[1]!;
    const parsed = createParser(library.toJSONSchema(), library.root).parse(
      source,
    );
    expect(parsed.meta.errors).toEqual([]);
    expect(parsed.meta.unresolved).toEqual([]);
    expect(parsed.meta.incomplete).toBe(false);
    const ctx = { getState: () => null, resolveRef: () => 2 };
    const errors: OpenUIError[] = [];
    const root = evaluateElementProps(parsed.root!, {
      library,
      store: null,
      ctx,
      errors,
    });
    const children = root.props.children as ElementNode[];
    expect(children[0]!.props.text).toBe('Count: 2');
    expect(children[1]!.props.action).toEqual({
      steps: [
        { type: 'run', statementId: 'increment', refType: 'mutation' },
        { type: 'run', statementId: 'counter', refType: 'query' },
      ],
    });
    expect(evaluate(parsed.mutationStatements[0]!.argsAST, ctx)).toEqual({
      key: 'counter',
      value: 3,
    });
    expect(errors).toEqual([]);
  },
);

test('todo fixture renders default rows and edits numeric or string IDs', () => {
  const source = readFileSync(
    new URL('./fixtures/todo.openui', import.meta.url),
    'utf8',
  );
  const library = createOpenUiPromptLibrary();
  const parsed = createParser(library.toJSONSchema(), library.root).parse(
    source,
  );
  expect(parsed.meta.errors).toEqual([]);
  expect(parsed.meta.unresolved).toEqual([]);
  expect(parsed.meta.incomplete).toBe(false);
  const state: Record<string, unknown> = { ...parsed.stateDeclarations };
  const query = parsed.queryStatements[0]!;
  const data = evaluate(query.defaultsAST!, {
    getState: name => state[name],
    resolveRef: () => null,
  });
  const errors: OpenUIError[] = [];
  const ctx = {
    getState: (name: string) => state[name],
    resolveRef: () => data,
  };
  const render = () =>
    evaluateElementProps(parsed.root!, { library, store: null, ctx, errors });
  const section = (render().props.children as ElementNode[])[1]!.props
    .children as ElementNode[];
  expect(section[0]!.props.text).toBe('共 3 项 · 未完成 2');
  const rows = section[1]!.props.children as ElementNode[];
  expect(rows.map(row => (row.props.children as ElementNode[])[0]!.props.text))
    .toEqual(['买牛奶', '写周报', '预约牙医']);
  const items = (data as {
    items: { id: string | number; text: string; completed: boolean }[];
  }).items;
  for (const id of [2, 'string-id']) {
    items[1]!.id = id;
    Object.assign(state, {
      $selectedId: id,
      $editText: '修改后的任务',
      $nextCompleted: true,
    });
    const editor = (render().props.children as ElementNode[])[2]!;
    expect(editor.typeName).toBe('Card');
    const fields = editor.props.children as ElementNode[];
    expect(fields[1]!.props.value).toBe('修改后的任务');
    const buttons = fields[2]!.props.buttons as ElementNode[];
    expect(buttons[0]!.props.action).toEqual({
      steps: [
        { type: 'run', statementId: 'saveTask', refType: 'mutation' },
        { type: 'run', statementId: 'tasks', refType: 'query' },
        { type: 'reset', targets: ['$selectedId', '$editText'] },
      ],
    });
    for (const name of ['saveTask', 'toggleTask', 'deleteTask']) {
      const mutation = parsed.mutationStatements.find(item =>
        item.statementId === name
      )!;
      const expectedItems = name === 'deleteTask'
        ? items.filter(item => item.id !== id)
        : items.map(item =>
          item.id === id
            ? {
              ...item,
              ...(name === 'saveTask'
                ? { text: state.$editText }
                : { completed: true }),
            }
            : item
        );
      expect(evaluate(mutation.argsAST, ctx)).toEqual({
        key: 'tasks',
        value: { items: expectedItems },
      });
    }
  }
  expect(errors).toEqual([]);
});

test.each([
  undefined,
  { toolCalls: true },
  { tools: [] },
  { tools: ['get_weather'] },
  { tools: ['openui_query'] },
  { tools: ['openui_mutation'] },
  { tools: ['openui_query', 'openui_mutation'], toolCalls: false },
])(
  'omits the local data contract unless both runtime tools are available: %j',
  promptOptions => {
    const prompt = buildOpenUiSystemPrompt({
      ...(promptOptions ? { promptOptions } : {}),
    });
    expect(prompt).not.toContain(
      'The host provides two tools for persistent data',
    );
    expect(prompt).not.toContain('Mutation("openui_mutation", { key:');
  },
);

test.each([
  ['openui_query', 'openui_mutation'],
  [
    { name: 'openui_query', inputSchema: {}, outputSchema: {} },
    { name: 'openui_mutation', inputSchema: {}, outputSchema: {} },
  ],
].map(tools => ({ tools })))(
  'includes the local data contract for registered names or descriptors: %j',
  ({ tools }) => {
    const prompt = buildOpenUiSystemPrompt({ promptOptions: { tools } });
    expect(prompt).toContain('The host provides two tools for persistent data');
    expect(prompt).toContain('Mutation("openui_mutation", { key:');
  },
);

test('keeps local data guidance disabled for restricted prompts unless tool calls are explicitly enabled', () => {
  const options = {
    componentNames: ['Stack', 'TextContent'],
    promptOptions: { tools: ['openui_query', 'openui_mutation'] },
  };
  expect(buildOpenUiSystemPrompt(options)).not.toContain(
    'The host provides two tools for persistent data',
  );
  expect(
    buildOpenUiSystemPrompt({
      ...options,
      promptOptions: { ...options.promptOptions, toolCalls: true },
    }),
  )
    .toContain('The host provides two tools for persistent data');
});
