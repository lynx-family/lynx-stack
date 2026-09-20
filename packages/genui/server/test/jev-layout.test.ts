// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { describeJevTree } from '../agent/a2ui/jev-candidates.js';
import type { JevComponent } from '../agent/a2ui/jev-candidates.js';
import { arrangeJevLayout } from '../agent/a2ui/jev-layout.js';
import type { JevLayoutMode } from '../agent/a2ui/jev-layout.js';

const surface = {
  version: 'v0.9' as const,
  createSurface: {
    surfaceId: 'main',
    catalogId: 'https://example.com/catalog',
  },
};

test('resolves independent parent cycles together without flattening their other edges', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['a', 'b', 'c', 'd'] },
    ...['a', 'b', 'c', 'd'].map(id => ({
      id,
      component: 'Column',
      children: [],
    })),
  ];
  const batches: string[][] = [];
  const layout = await arrangeJevLayout(
    describeJevTree({ surface, components, data: {} }),
    {},
    async (state, questions) => {
      batches.push(Object.keys(questions));
      if (questions.parent_a) {
        return { parent_a: 'b', parent_b: 'a', parent_c: 'd', parent_d: 'c' };
      }
      if (questions.attach_a) {
        expect(Object.keys(questions)).toEqual(['attach_a', 'attach_c']);
        expect(state).toMatchObject({
          structure_conflicts: [
            { members: ['a', 'b'] },
            { members: ['c', 'd'] },
          ],
        });
        // Select the outer branch explicitly, not by creation order.
        return Object.fromEntries(
          Object.entries(questions).map((
            [id, question],
          ) => [
            id,
            Object.entries(question.criteria).find(([, text]) =>
              text.includes(id === 'attach_a' ? '(b)' : '(d)')
            )![0],
          ]),
        );
      }
      expect(Object.keys(questions)).toEqual(['order_b', 'order_d']);
      return { order_b: '1', order_d: '0' };
    },
  );
  expect(batches).toHaveLength(3);
  expect(layout.children.get('root')).toEqual(['d', 'b']);
  expect(layout.children.get('b')).toEqual(['a']);
  expect(layout.children.get('d')).toEqual(['c']);
  expect(
    describeJevTree({
      surface,
      data: {},
      components: components.map(item => ({
        ...item,
        children: layout.children.get(item.id)!,
      })),
    }),
  ).toHaveLength(5);
});

test('resolves depth conflicts using the complete retained subtree height', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['c1', 'card'] },
    ...Array.from(
      { length: 5 },
      (_, index) => ({
        id: `c${index + 1}`,
        component: 'Column',
        children: index === 4 ? [] : [`c${index + 2}`],
      }),
    ),
    { id: 'card', component: 'Card', child: 'slot' },
    { id: 'slot', component: 'Column', children: ['inner'] },
    { id: 'inner', component: 'Column', children: ['text'] },
    { id: 'text', component: 'Text', text: 'Retained content' },
  ];
  let conflicts = 0;
  const layout = await arrangeJevLayout(
    describeJevTree({ surface, components, data: {} }),
    {},
    async (_state, questions) => {
      if (questions.attach_card) {
        conflicts++;
        const entries = Object.entries(questions.attach_card.criteria);
        expect(
          entries.some(([, text]) =>
            text.endsWith('(c4).') || text.endsWith('(c5).')
          ),
        ).toBe(false);
        return {
          attach_card: entries.find(([, text]) => text.endsWith('(c3).'))![0],
        };
      }
      return Object.fromEntries(
        Object.entries(questions).map(([id, question]) => {
          let choice = Object.keys(question.criteria)[0]!;
          if (/^parent_c[2-5]$/.test(id)) {
            choice = `c${Number(id.slice('parent_c'.length)) - 1}`;
          }
          if (id === 'parent_card') {
            choice = 'c5';
          }
          if (id === 'order_card') choice = '1';
          expect(question.criteria).toHaveProperty(choice);
          return [id, choice];
        }),
      );
    },
    new Map([['inner', 'keep'], ['text', 'keep']]),
  );
  expect(conflicts).toBe(1);
  expect(layout.parents.get('card')).toBe('c3');
  expect(layout.parents.get('inner')).toBe('slot');
  expect(
    describeJevTree({
      surface,
      data: {},
      components: components.map(item =>
        Array.isArray(item.children)
          ? { ...item, children: layout.children.get(item.id)! }
          : item
      ),
    }),
  ).toHaveLength(10);
});

test('orders actual sibling groups and resolves collisions without using component enumeration order', async () => {
  const components: JevComponent[] = [
    {
      id: 'root',
      component: 'Column',
      children: ['left', 'right', 'answer', 'question'],
    },
    { id: 'left', component: 'Column', children: ['anchor'] },
    { id: 'right', component: 'Column', children: ['other'] },
    { id: 'answer', component: 'Text', text: 'Answer' },
    { id: 'question', component: 'Text', text: 'Question' },
    { id: 'anchor', component: 'Text', text: 'Existing footer' },
    { id: 'other', component: 'Text', text: 'Other group' },
  ];
  const layout = await arrangeJevLayout(
    describeJevTree({ surface, components, data: {} }),
    {},
    (state, questions) => {
      if (questions.parent_answer) {
        expect(Object.keys(questions)).toEqual([
          'parent_answer',
          'parent_question',
        ]);
        return Promise.resolve<Record<string, string>>({
          parent_answer: 'left',
          parent_question: 'left',
        });
      }
      if (questions.order_answer) {
        expect(Object.keys(questions)).toEqual([
          'order_answer',
          'order_question',
        ]);
        expect(Object.keys(questions.order_answer.criteria)).toEqual([
          '0',
          '1',
          '2',
        ]);
        const context = state as {
          ordering_groups: {
            parent: string;
            children: { id: string; preserve_relative_order: boolean }[];
          }[];
        };
        expect(
          context.ordering_groups.find(group => group.parent === 'left')!
            .children.find(item => item.id === 'anchor'),
        )
          .toMatchObject({ id: 'anchor', preserve_relative_order: true });
        return Promise.resolve<Record<string, string>>({
          order_answer: '0',
          order_question: '0',
        });
      }
      expect(Object.keys(questions)).toEqual(['tie_left_0']);
      expect(Object.keys(questions.tie_left_0!.criteria)).toEqual([
        'answer',
        'question',
      ]);
      return Promise.resolve<Record<string, string>>({
        tie_left_0: 'question',
      });
    },
    new Map(
      ['left', 'right', 'anchor', 'other'].map(id => [id, 'keep' as const]),
    ),
  );
  expect(layout.children.get('left')).toEqual(['question', 'answer', 'anchor']);
  expect(layout.children.get('right')).toEqual(['other']);
  expect(layout.children.get('root')).toEqual(['left', 'right']);
});

test('keeps nested topology and sibling order without layout decisions', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['panel'] },
    { id: 'second', component: 'Text', text: 'Second' },
    { id: 'panel', component: 'Column', children: ['first', 'second'] },
    { id: 'first', component: 'Text', text: 'First' },
  ];
  const selected = describeJevTree({ surface, data: {}, components });
  const layout = await arrangeJevLayout(selected, {}, () => {
    throw new Error('Preserved layout must not require decisions.');
  }, new Map<string, JevLayoutMode>(selected.map(item => [item.id, 'keep'])));
  expect(layout.children.get('root')).toEqual(['panel']);
  expect(layout.children.get('panel')).toEqual(['first', 'second']);
  expect(layout.parents.get('first')).toBe('panel');
  expect(layout.orders.size).toBe(0);
});

test('distinguishes new staging positions from existing layout and exposes compound ownership', async () => {
  const components: JevComponent[] = [
    {
      id: 'root',
      component: 'Column',
      children: ['heading', 'card', 'button'],
    },
    { id: 'heading', component: 'Text', text: 'Existing heading' },
    { id: 'card', component: 'Card', child: 'slot' },
    { id: 'slot', component: 'Column', children: [] },
    { id: 'button', component: 'Button', child: 'label' },
    { id: 'label', component: 'Text', text: 'Triangle' },
  ];
  const selected = describeJevTree({ surface, data: {}, components });
  const layout = await arrangeJevLayout(
    selected,
    {},
    (state, questions) => {
      const context = state as {
        selected_elements: Record<string, unknown>[];
        ordering_groups?: { parent: string; children: { id: string }[] }[];
      };
      const byId = new Map(
        context.selected_elements.map(item => [item.id, item]),
      );
      expect(byId.get('heading')).toMatchObject({
        origin: 'existing',
        existing_parent: 'root',
        existing_position: 0,
      });
      expect(byId.get('card')).toMatchObject({
        origin: 'new',
        fixed_children: ['slot'],
      });
      expect(byId.get('button')).toMatchObject({
        origin: 'new',
        fixed_children: ['label'],
      });
      expect(byId.get('card')!.existing_parent).toBeUndefined();
      expect(byId.get('button')!.existing_position).toBeUndefined();
      if (questions.parent_button) {
        expect(context.ordering_groups).toBeUndefined();
        expect(Object.keys(questions)).toEqual(['parent_button']);
        expect(questions.parent_button.instructions).toContain(
          'new element with no existing parent',
        );
      }
      if (questions.order_card) {
        expect(byId.get('button')!.parent).toBe('slot');
        expect(context.ordering_groups).toContainEqual({
          parent: 'slot',
          children: [{
            id: 'button',
            description: 'Button',
            preserve_relative_order: false,
          }],
        });
        expect(questions).not.toHaveProperty('order_button');
      }
      return Promise.resolve(
        Object.fromEntries(
          Object.keys(questions).map(id => [
            id,
            id === 'parent_card'
              ? 'root'
              : (id === 'parent_button'
                ? 'slot'
                : '0'),
          ]),
        ),
      );
    },
    new Map([['heading', 'keep']]),
    new Set(['root', 'heading']),
  );
  expect(layout.children.get('root')).toEqual(['card', 'heading']);
  expect(layout.children.get('slot')).toEqual(['button']);
  expect(layout.parents.get('label')).toBe('button');
});

test('asks only for the reordered node and bounds choices to its siblings', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['left', 'right'] },
    { id: 'left', component: 'Column', children: ['a', 'b', 'c'] },
    { id: 'right', component: 'Column', children: ['d', 'e'] },
    ...['e', 'c', 'b', 'a', 'd'].map(id => ({
      id,
      component: 'Text',
      text: id,
    })),
  ];
  const selected = describeJevTree({ surface, data: {}, components });
  const retained = new Map<string, JevLayoutMode>(
    selected.map(item => [item.id, 'keep']),
  );
  retained.set('c', 'reorder');
  let calls = 0;
  const layout = await arrangeJevLayout(
    selected,
    {},
    (_state, questions) => {
      calls++;
      expect(Object.keys(questions)).toEqual(['order_c']);
      expect(Object.keys(questions.order_c!.criteria)).toEqual(['0', '1', '2']);
      return Promise.resolve({ order_c: '0' });
    },
    retained,
  );
  expect(calls).toBe(1);
  expect(layout.parents.get('c')).toBe('left');
  expect(layout.children.get('left')).toEqual(['c', 'a', 'b']);
  expect(layout.children.get('right')).toEqual(['d', 'e']);
  expect(layout.children.get('root')).toEqual(['left', 'right']);
});

test('resolves singleton ordering locally and inserts new content without reordering anchors', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['panel', 'new'] },
    { id: 'panel', component: 'Column', children: ['only'] },
    { id: 'only', component: 'Text', text: 'Only' },
    { id: 'new', component: 'Text', text: 'New' },
  ];
  const selected = describeJevTree({ surface, data: {}, components });
  const layout = await arrangeJevLayout(
    selected,
    {},
    (_state, questions) => {
      expect(questions).not.toHaveProperty('order_panel');
      // "only" remains a singleton once the new element's actual parent is known.
      expect(questions).not.toHaveProperty('order_only');
      if (questions.parent_new) {
        expect(questions).not.toHaveProperty('order_new');
      }
      if (questions.order_new) {
        expect(Object.keys(questions.order_new.criteria)).toEqual(['0', '1']);
      }
      return Promise.resolve({
        parent_new: 'root',
        order_new: '0',
      });
    },
    new Map<string, JevLayoutMode>([['panel', 'keep'], ['only', 'reorder']]),
  );
  expect(layout.children.get('root')).toEqual(['new', 'panel']);
  expect(layout.children.get('panel')).toEqual(['only']);
  const unchanged = await arrangeJevLayout(
    describeJevTree({
      surface,
      data: {},
      components: components.filter(item => item.id !== 'new').map(item =>
        item.id === 'root' ? { ...item, children: ['panel'] } : item
      ),
    }),
    {},
    () => {
      throw new Error('A sole sibling needs no ordering request.');
    },
    new Map<string, JevLayoutMode>([['panel', 'keep'], ['only', 'reorder']]),
  );
  expect(unchanged.children.get('panel')).toEqual(['only']);
});

test('moving a container carries retained descendants and accounts for their complete depth', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['c1', 'card'] },
    ...Array.from(
      { length: 4 },
      (_, index) => ({
        id: `c${index + 1}`,
        component: 'Column',
        children: index < 3 ? [`c${index + 2}`] : [],
      }),
    ),
    { id: 'card', component: 'Card', child: 'slot' },
    { id: 'slot', component: 'Column', children: ['inner'] },
    { id: 'inner', component: 'Column', children: ['text'] },
    { id: 'text', component: 'Text', text: 'Content' },
  ];
  const selected = describeJevTree({ surface, data: {}, components });
  const retained = new Map<string, JevLayoutMode>(
    selected.map(item => [item.id, 'keep']),
  );
  retained.set('card', 'move');
  const layout = await arrangeJevLayout(
    selected,
    {},
    (_state, questions) => {
      expect(questions).not.toHaveProperty('parent_inner');
      expect(questions).not.toHaveProperty('parent_text');
      if (questions.parent_card) {
        expect(Object.keys(questions.parent_card.criteria)).toEqual([
          'root',
          'c1',
          'c2',
          'c3',
        ]);
        return Promise.resolve<Record<string, string>>({ parent_card: 'c3' });
      }
      expect(Object.keys(questions)).toEqual(['order_card']);
      return Promise.resolve<Record<string, string>>({ order_card: '0' });
    },
    retained,
  );
  expect(layout.parents.get('card')).toBe('c3');
  expect(layout.parents.get('inner')).toBe('slot');
  expect(layout.parents.get('text')).toBe('inner');
  const arranged = components.map(item =>
    Array.isArray(item.children)
      ? { ...item, children: layout.children.get(item.id)! }
      : item
  );
  expect(describeJevTree({ surface, data: {}, components: arranged }))
    .toHaveLength(9);
});

test('plans nested structural parents together and excludes each unit’s own slots', async () => {
  const components: JevComponent[] = [
    {
      id: 'root',
      component: 'Column',
      children: ['left', 'right', 'card', 'modal', 'text'],
    },
    { id: 'left', component: 'Column', children: [] },
    { id: 'right', component: 'Column', children: [] },
    { id: 'card', component: 'Card', child: 'card-slot' },
    { id: 'card-slot', component: 'Column', children: [] },
    {
      id: 'modal',
      component: 'Modal',
      trigger: 'trigger',
      content: 'modal-slot',
    },
    { id: 'trigger', component: 'Text', text: 'Open' },
    { id: 'modal-slot', component: 'Column', children: [] },
    { id: 'text', component: 'Text', text: 'Content' },
  ];
  const selected = describeJevTree({ surface, data: {}, components });
  const batches: string[][] = [];
  const layout = await arrangeJevLayout(
    selected,
    {},
    async (state, questions) => {
      batches.push(Object.keys(questions));
      return Object.fromEntries(
        Object.entries(questions).map(([id, question]) => {
          let choice = Object.keys(question.criteria)[0]!;
          if (['parent_card', 'parent_modal'].includes(id)) {
            expect(question.criteria).not.toHaveProperty(
              id === 'parent_card' ? 'card-slot' : 'modal-slot',
            );
            choice = id === 'parent_card' ? 'left' : 'right';
          }
          if (id === 'parent_text') choice = 'card-slot';
          if (id === 'order_right') choice = '1';
          if (id.startsWith('order_')) {
            const context = state as {
              selected_elements: { id: string; parent?: string }[];
            };
            expect(
              context.selected_elements.find(item => item.id === 'text')
                ?.parent,
            ).toBe('card-slot');
          }
          expect(question.criteria).toHaveProperty(choice);
          return [id, choice];
        }),
      );
    },
  );
  expect(batches[0]).toEqual([
    'parent_left',
    'parent_right',
    'parent_card',
    'parent_modal',
  ]);
  expect(batches[1]).toEqual(['parent_text']);
  expect(batches[2]).toEqual(['order_left', 'order_right']);
  expect(layout.parents.get('card')).toBe('left');
  expect(layout.parents.get('modal')).toBe('right');
  expect(layout.parents.get('text')).toBe('card-slot');
  const arranged = components.map(component =>
    Array.isArray(component.children)
      ? {
        ...component,
        children: selected.filter(item =>
          layout.parents.get(item.id) === component.id
        ).map(item => item.id),
      }
      : component
  );
  expect(describeJevTree({ surface, data: {}, components: arranged }))
    .toHaveLength(9);
});

test('counts fixed compound and template depth while excluding unplaced movable descendants', async () => {
  const components: JevComponent[] = [
    { id: 'root', component: 'Column', children: ['c1', 'card'] },
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `c${index + 1}`,
      component: 'Column',
      children: index === 5 ? [] : [`c${index + 2}`],
    })),
    { id: 'card', component: 'Card', child: 'list' },
    {
      id: 'list',
      component: 'Column',
      children: { path: '/items', componentId: 'row' },
    },
    { id: 'row', component: 'Row', children: ['text'] },
    { id: 'text', component: 'Text', text: { path: 'title' } },
  ];
  // Include a parent-capable fixed slot so the Card unit participates in structure planning.
  components.find(item => item.id === 'card')!.child = 'slot';
  components.push({ id: 'slot', component: 'Column', children: ['list'] });
  const selected = describeJevTree({ surface, data: {}, components });
  const layout = await arrangeJevLayout(
    selected,
    {},
    async (_state, questions) =>
      Object.fromEntries(
        Object.entries(questions).map(([id, question]) => {
          let choice = Object.keys(question.criteria)[0]!;
          if (/^parent_c[2-6]$/.test(id)) {
            choice = `c${Number(id.slice('parent_c'.length)) - 1}`;
          }
          if (id === 'parent_card') {
            choice = 'c5';
          }
          if (id === 'parent_list') {
            // The movable list owns its whole repeating subtree (list -> row -> text).
            expect(question.criteria).not.toHaveProperty('slot');
            expect(question.criteria).not.toHaveProperty('c5');
            expect(question.criteria).toHaveProperty('c4');
            choice = 'c4';
          }
          expect(question.criteria).toHaveProperty(choice);
          return [id, choice];
        }),
      ),
  );
  expect(layout.parents.get('list')).toBe('c4');
  expect(layout.parents.get('row')).toBe('list');
  expect(layout.parents.get('text')).toBe('row');
});
