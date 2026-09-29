// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createSignal } from 'solid-js';
import { describe, expect, test } from 'vitest';

import {
  createRemoteElementTemplateRuntime,
} from '@lynx-js/element-template-runtime';
import type {
  BackgroundElementTemplateChannel,
  ElementTemplateBridgeCommand,
  ElementTemplateBridgeCommit,
} from '@lynx-js/element-template-runtime';

import {
  createElement,
  effect,
  insert,
  insertNode,
  insertTemplateChild,
  renderSolidLynx,
  renderSolidLynxInitial,
  setProp,
  setTemplateAttribute,
  setTemplateText,
} from '../src/renderer.js';
import type { SolidLynxNode } from '../src/renderer.js';
import { createTemplate } from '../src/template.js';

function removeNoopListener(): void {
  // No listener is registered by this test channel.
}

function createRendererContext() {
  const commits: ElementTemplateBridgeCommit[] = [];
  const channel: BackgroundElementTemplateChannel = {
    dispatchToRemote(_type, commit) {
      commits.push(commit);
    },
    onDispose: () => removeNoopListener,
  };

  return {
    commits,
    context: {
      eventHandlers: new Map<string, (event: unknown) => unknown>(),
      remote: createRemoteElementTemplateRuntime(channel),
    },
  };
}

function findCommand(
  commits: readonly ElementTemplateBridgeCommit[],
  predicate: (command: ElementTemplateBridgeCommand) => boolean,
): ElementTemplateBridgeCommand | undefined {
  return commits.flatMap(commit => commit.commands).find(command =>
    predicate(command)
  );
}

describe('SolidLynx renderer', () => {
  test('renders and updates signals through Element Template commands', () => {
    const { commits, context } = createRendererContext();
    let setCount: ((value: number) => void) | undefined;

    const dispose = renderSolidLynx(context, () => {
      const container = createElement('view');
      const label = createElement('text');
      const [count, updateCount] = createSignal(0);
      setCount = updateCount;

      setProp(container, 'class', 'counter');
      insert(label, count);
      insertNode(container, label);
      return container;
    });

    expect(commits).toHaveLength(1);
    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.templateKey === '_et_builtin_raw_text'
        && command.request.attributeSlots?.[0] === '0',
    )).toBeDefined();

    setCount?.(2);
    expect(commits).toHaveLength(2);
    expect(findCommand(
      commits.slice(1),
      command =>
        command.type === 'setAttribute'
        && command.attributeSlotIndex === 0
        && command.value === '2',
    )).toBeDefined();

    dispose();
    expect(findCommand(
      commits,
      command =>
        command.type === 'removeNode'
        && command.request.parent === 0,
    )).toBeDefined();
  });

  test('stores event handlers as tokens and removes them with the subtree', () => {
    const { commits, context } = createRendererContext();
    let tapped = false;

    const dispose = renderSolidLynx(context, () => {
      const button = createElement('view');
      setProp(button, 'bindtap', () => {
        tapped = true;
      });
      return button;
    });

    expect(context.eventHandlers.size).toBe(1);
    const [token, handler] = [...context.eventHandlers.entries()][0]!;
    expect(token).toMatch(/^-\d+:0:bindtap$/);
    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.templateKey === 'view'
        && command.request.attributeSlots?.[0] !== undefined,
    )).toBeDefined();
    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.templateKey === 'view'
        && typeof command.request.attributeSlots?.[0] === 'object'
        && command.request.attributeSlots[0] !== null
        && !Array.isArray(command.request.attributeSlots[0])
        && command.request.attributeSlots[0]['bindtap'] === token,
    )).toBeDefined();
    handler({});
    expect(tapped).toBe(true);

    dispose();
    expect(context.eventHandlers.size).toBe(0);
  });

  test('updates precompiled templates directly through slots', () => {
    const { commits, context } = createRendererContext();
    const createCard = createTemplate('_solid_et_card');
    let card: SolidLynxNode | undefined;
    let setValue: ((value: number) => void) | undefined;

    const dispose = renderSolidLynx(context, () => {
      card = createCard();
      const [count, updateCount] = createSignal(0);
      setValue = updateCount;
      setTemplateAttribute(card, 0, 'bindtap', () => undefined);
      effect(() => {
        setTemplateText(card!, 1, count);
      });
      return card;
    });

    expect(card?.properties).toEqual({});
    expect(card?.children).toEqual([]);
    expect(card?.kind).toBe('template');
    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.templateKey === '_solid_et_card'
        && command.request.attributeSlots?.[1] === '0',
    )).toBeDefined();
    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.templateKey === '_et_builtin_raw_text',
    )).toBeUndefined();
    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.templateKey === '_solid_et_card'
        && command.request.attributeSlots?.[0]
          === [...context.eventHandlers.keys()][0],
    )).toBeDefined();
    expect(context.eventHandlers.size).toBe(1);

    setValue?.(2);
    expect(findCommand(
      commits.slice(1),
      command =>
        command.type === 'setAttribute'
        && command.attributeSlotIndex === 1
        && command.value === '2',
    )).toBeDefined();

    dispose();
  });

  test('inserts dynamic nodes into a compiled child slot', () => {
    const { commits, context } = createRendererContext();
    const createCard = createTemplate('_solid_et_card');

    const dispose = renderSolidLynx(context, () => {
      const card = createCard();
      insertTemplateChild(card, 3, createElement('text'));
      return card;
    });

    expect(findCommand(
      commits,
      command =>
        command.type === 'insertNode'
        && command.request.childSlotIndex === 3
        && command.request.parent < 0,
    )).toBeDefined();

    dispose();
  });

  test('disposes reactivity after the main-thread initial render', () => {
    const { commits, context } = createRendererContext();
    const createCard = createTemplate('_solid_et_card');
    let setValue: ((value: number) => void) | undefined;

    renderSolidLynxInitial(context, () => {
      const card = createCard();
      const [count, updateCount] = createSignal(0);
      setValue = updateCount;
      effect(() => {
        setTemplateText(card, 0, count);
      });
      return card;
    });

    expect(findCommand(
      commits,
      command =>
        command.type === 'createTemplate'
        && command.request.attributeSlots?.[0] === '0',
    )).toBeDefined();
    const commitCount = commits.length;

    setValue?.(1);

    expect(commits).toHaveLength(commitCount);
  });

  test('normalizes property values and rejects circular objects', () => {
    const { context } = createRendererContext();
    let node: SolidLynxNode | undefined;

    const dispose = renderSolidLynx(context, () => {
      node = createElement('view');
      setProp(node, 'data', {
        finite: 1,
        ignored: undefined,
        invalid: Number.POSITIVE_INFINITY,
      });
      return node;
    });

    expect(node?.properties).toEqual({
      data: {
        finite: 1,
        invalid: null,
      },
    });

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => setProp(node!, 'data', circular)).toThrow(
      'must be serializable',
    );
    dispose();
  });
});
