// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createParser,
  evaluate,
  evaluateElementProps,
} from '@openuidev/lang-core';
import type { ElementNode, OpenUIError } from '@openuidev/lang-core';
import { expect, rstest, test } from '@rstest/core';

import { getQueryDefaults } from '@lynx-js/genui/openui/data-tools';
import { createOpenUiPromptLibrary } from '@lynx-js/genui/openui/prompt';

import { executeOpenUIDataTool, restoreOpenUIData } from './dataHost.js';
import { createDataTools } from '../../lynx-src/openui/dataTools.js';
import { OPENUI_TODO_RAW } from '../../lynx-src/openui/todo.js';

const library = createOpenUiPromptLibrary();
const parsed = createParser(library.toJSONSchema(), library.root).parse(
  OPENUI_TODO_RAW,
);
const initial = getQueryDefaults(parsed);

interface TodoData {
  items: { id: string; title: string; done: boolean }[];
}

function setup(saved = new Map<string, string>(), failWrites = false) {
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: rstest.fn((key: string, value: string) => {
      if (failWrites) throw new Error('storage unavailable');
      saved.set(key, value);
    }),
  };
  let defaults: Record<string, unknown> = {};
  const runtime = createDataTools(request => {
    if (request.operation === 'initialize') {
      defaults = request.args.defaults as Record<string, unknown>;
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve(executeOpenUIDataTool(request, storage, defaults));
  });
  runtime.setScope(OPENUI_TODO_RAW);
  runtime.publishParseResult(OPENUI_TODO_RAW, parsed, OPENUI_TODO_RAW);
  const tools: Record<string, (args: Record<string, unknown>) => unknown> = {
    ...runtime.tools,
  };
  const query = async () =>
    await runtime.tools.openui_query({ key: 'todos' }) as TodoData;
  const run = async (name: string, state: Record<string, unknown>) => {
    const data = await query();
    const ctx = {
      getState: (key: string) => state[key] ?? parsed.stateDeclarations[key],
      resolveRef: () => data,
    };
    const mutation = parsed.mutationStatements.find(item =>
      item.statementId === name
    )!;
    const tool = evaluate(mutation.toolAST!, ctx) as string;
    return tools[tool]!(
      evaluate(mutation.argsAST!, ctx) as Record<string, unknown>,
    );
  };
  return { saved, storage, runtime, query, run };
}

function render(data: unknown, state: Record<string, unknown> = {}) {
  const errors: OpenUIError[] = [];
  const root = evaluateElementProps(parsed.root!, {
    library,
    store: null,
    ctx: {
      getState: name => state[name] ?? parsed.stateDeclarations[name],
      resolveRef: name => name === 'todos' ? data : { status: 'idle' },
    },
    errors,
  });
  expect(errors).toEqual([]);
  return root.props.children as ElementNode[];
}

test('Todo defaults render the initial rows before any local data is written', () => {
  expect(parsed.meta.errors).toEqual([]);
  expect(parsed.meta.unresolved).toEqual([]);
  const children = render(initial.todos);
  const summary = children.find(child => child?.typeName === 'Row')!.props
    .children as ElementNode[];
  expect(summary[0]!.props.text).toBe('2 tasks');
  const rows = children.find(child => child?.typeName === 'List')!.props
    .children as ElementNode[];
  expect(rows.map(row => {
    const content = row.props.children as ElementNode[];
    const heading = content[0]!.props.children as ElementNode[];
    return heading[0]!.props.text;
  })).toEqual(['Build a protocol-driven demo', 'Review the task list']);
  const { saved, runtime } = setup();
  expect(saved.size).toBe(0);
  runtime.dispose();
});

test('every Todo Query and Mutation uses a registered shared tool', () => {
  const { runtime } = setup();
  const ctx = { getState: () => null, resolveRef: () => null };
  for (
    const statement of [...parsed.queryStatements, ...parsed.mutationStatements]
  ) {
    const name = evaluate(statement.toolAST!, ctx) as string;
    expect(runtime.tools).toHaveProperty(name);
  }
  runtime.dispose();
});

test('Todo actions edit, toggle and delete through shared tools and restore on reload', async () => {
  const { saved, storage, runtime, query, run } = setup();
  try {
    await run('saveTodo', {
      $selectedId: 'todos-1',
      $editTitle: 'Updated task',
    });
    await run('toggleTodo', { $selectedId: 'todos-1', $nextDone: true });
    const updated = await query();
    expect(updated.items[0]).toEqual({
      id: 'todos-1',
      title: 'Updated task',
      done: true,
    });
    const summary = render(updated).find(child => child?.typeName === 'Row')!
      .props.children as ElementNode[];
    expect(summary[0]!.props.text).toBe('2 tasks');
    expect(initial.todos).toEqual({
      items: [
        { id: 'todos-1', title: 'Build a protocol-driven demo', done: false },
        { id: 'todos-2', title: 'Review the task list', done: true },
      ],
    });
    expect(restoreOpenUIData({ rawText: OPENUI_TODO_RAW }, storage)).toEqual({
      rawText: OPENUI_TODO_RAW,
      initialQueryResults: { todos: updated },
    });
    const reopened = setup(saved);
    try {
      expect(await reopened.query()).toEqual(updated);
      await reopened.run('toggleTodo', {
        $selectedId: 'todos-1',
        $nextDone: false,
      });
      const toggled = await reopened.query();
      expect(toggled.items[0]!.done).toBe(false);
      for (const item of updated.items) {
        await reopened.run('deleteTodo', { $deleteId: item.id });
      }
      const empty = await reopened.query();
      expect(empty).toEqual({ items: [] });
      expect(
        render(empty).find(child => child?.typeName === 'Text')!.props.text,
      ).toBe('No tasks remaining.');
      expect(restoreOpenUIData({ rawText: OPENUI_TODO_RAW }, storage))
        .toMatchObject({
          initialQueryResults: { todos: empty },
        });
    } finally {
      reopened.runtime.dispose();
    }
  } finally {
    runtime.dispose();
  }
});

test('Todo edits use a separate selection action and refresh the Query after saving', () => {
  const children = render(initial.todos, {
    $selectedId: 'todos-1',
    $editTitle: 'Changed',
    $nextDone: true,
  });
  const editor = children.find(child =>
    child?.typeName === 'Card'
    && (child.props.children as ElementNode[])[0]?.props.text === 'Edit task'
  )!;
  const fields = editor.props.children as ElementNode[];
  expect(fields[1]!.props).toMatchObject({
    name: '$editTitle',
    value: 'Changed',
  });
  const buttons = fields[2]!.props.buttons as ElementNode[];
  expect(buttons[0]!.props.action).toEqual({
    steps: [
      { type: 'run', statementId: 'saveTodo', refType: 'mutation' },
      { type: 'run', statementId: 'todos', refType: 'query' },
      { type: 'reset', targets: ['$selectedId', '$editTitle', '$nextDone'] },
    ],
  });
});

test('Todo mutations propagate persistence failures without changing data', async () => {
  const { runtime, run, query } = setup(new Map(), true);
  try {
    for (const name of ['saveTodo', 'toggleTodo', 'deleteTodo']) {
      await expect(run(name, {
        $selectedId: 'todos-1',
        $editTitle: 'Unsaved',
        $nextDone: true,
        $deleteId: 'todos-1',
      })).rejects.toThrow('storage unavailable');
      expect(await query()).toEqual(initial.todos);
    }
  } finally {
    runtime.dispose();
  }
});
