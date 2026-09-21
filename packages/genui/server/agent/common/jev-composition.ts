// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isDeepStrictEqual } from 'node:util';

import { jevQuestion } from './jev-evaluator.js';
import type { JevQuestion } from './jev-evaluator.js';
import type { JevLayoutMode } from './jev-layout.js';
import type { JevCandidate } from './jev-tree.js';
import type { JevValueChoice } from './jev-values.js';
import { GENUI_DESIGN_GUIDANCE } from '../../design/design-guidance.js';

export function createJevCompositionContext(
  requests: string[],
  instructions: string,
  enableDesignGuidance?: boolean,
) {
  return {
    user_requests: requests,
    ...(enableDesignGuidance === false
      ? {}
      : { design_guidance: GENUI_DESIGN_GUIDANCE }),
    instructions,
    retention_instructions:
      'For existing nodes, retain the parent and relative sibling order unless the request requires movement. Prefer keep_layout for content/style edits and preserve_layout when optional properties also stay unchanged. Use reorder or reorder_preserve for order-only changes; keep or preserve allow reparenting. Movable descendants decide independently. Optional-property preservation includes fixed children; required content and host resources are still evaluated. New nodes can be inserted without reordering unchanged siblings.',
  };
}

/** Protocols choose their root contract; all other component decisions share one policy. */
export function createJevComponentQuestions(
  existing: readonly JevCandidate[],
  specs: readonly { name: string; summary: string }[],
  root?: JevQuestion,
): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = root ? { root } : {};
  for (const item of existing) {
    if (!item.movable && (item.id !== 'root' || root)) continue;
    questions[`keep_${item.id}`] = jevQuestion(
      `Existing ${item.description}: choose what to retain.`,
      {
        preserve_layout:
          'Keep parent, relative sibling order and optional properties/defaults.',
        keep_layout:
          'Keep parent and relative sibling order; reconsider properties.',
        reorder_preserve:
          'Keep parent and optional properties/defaults; reconsider sibling position.',
        reorder: 'Keep parent; reconsider sibling position and properties.',
        preserve:
          'Keep optional properties/defaults; reconsider parent and sibling position.',
        keep: 'Keep; reconsider parent, sibling position and properties.',
        ...(item.id === 'root' ? {} : { omit: 'Remove this subtree.' }),
      },
    );
  }
  for (const spec of specs) {
    questions[`add_${spec.name}`] = jevQuestion(
      `How many NEW standalone ${spec.name} components are needed in the currently visible state? ${spec.summary} Existing components are retained separately. Compound children such as labels, modal triggers and content containers are created automatically; do not count them again. Do not add future workflow steps or redundant copies.`,
      Object.fromEntries(
        Array.from(
          { length: 9 },
          (_, count) => [String(count), `${count} new components`],
        ),
      ),
    );
  }
  return questions;
}

/** Keep fixed slots with their owner while movable descendants decide independently. */
export function createJevRetention(
  tree: readonly JevCandidate[],
  selection: Record<string, string>,
  existingIds: ReadonlySet<string> = new Set(tree.map(item => item.id)),
  rootKey = 'keep_root',
) {
  const byId = new Map(tree.map(item => [item.id, item]));
  const decision = (id: string) =>
    selection[id === 'root' ? rootKey : `keep_${id}`];
  const policy = (id: string): string | undefined => {
    let item = byId.get(id);
    while (item) {
      const value = decision(item.id);
      if (value !== undefined || item.movable || item.parent === undefined) {
        return value;
      }
      item = byId.get(item.parent);
    }
    return undefined;
  };
  const removed = new Set<string>();
  for (const item of tree) {
    let current: JevCandidate | undefined = item;
    while (current) {
      if (decision(current.id) === 'omit') {
        removed.add(item.id);
        break;
      }
      current = current.parent === undefined
        ? undefined
        : byId.get(current.parent);
    }
  }
  const layout = new Map<string, JevLayoutMode>();
  for (const item of tree) {
    if (!existingIds.has(item.id) || !item.movable || removed.has(item.id)) {
      continue;
    }
    const value = policy(item.id);
    layout.set(
      item.id,
      value === 'keep_layout' || value === 'preserve_layout'
        ? 'keep'
        : (value === 'reorder' || value === 'reorder_preserve'
          ? 'reorder'
          : 'move'),
    );
  }
  return {
    removed,
    layout,
    preservesProperties: (id: string) =>
      existingIds.has(id)
      && ['preserve', 'preserve_layout', 'reorder_preserve'].includes(
        policy(id) ?? '',
      ),
  };
}

/** Turn local values into finite questions and apply the selected values locally. */
export function createJevPropertyQuestions() {
  const questions: Record<string, JevQuestion> = {};
  const setters = new Map<string, {
    choices: JevValueChoice[];
    set: (value: unknown) => void;
  }>();
  const applyChoice = (id: string, answer: string) => {
    const target = setters.get(id);
    const choice = target?.choices[Number(answer)];
    if (!target || !choice || !Object.hasOwn(questions[id]!.criteria, answer)) {
      throw new Error('Jev returned an unoffered property choice.');
    }
    target.set(choice.value);
  };
  return {
    questions,
    offer<T extends JevValueChoice>(
      this: void,
      id: string,
      instructions: string,
      choices: T[],
      set: (value: unknown) => void,
    ): T[] {
      const unique = choices.filter((choice, index) =>
        !choices.slice(0, index).some(other =>
          isDeepStrictEqual(other.value, choice.value)
        )
      );
      if (unique.length === 0) {
        throw new Error(
          `No supplied values are available for ${instructions}.`,
        );
      }
      questions[id] = jevQuestion(
        instructions,
        Object.fromEntries(
          unique.map((choice, index) => [String(index), choice.description]),
        ),
      );
      setters.set(id, { choices: unique, set });
      return unique;
    },
    ids: () => [...setters.keys()],
    choices: (id: string) => setters.get(id)?.choices ?? [],
    applyChoice,
    apply(answers: Record<string, string>) {
      for (const [id, answer] of Object.entries(answers)) {
        applyChoice(id, answer);
      }
    },
  };
}
