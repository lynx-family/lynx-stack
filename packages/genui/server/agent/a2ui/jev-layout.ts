// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { JEV_MAX_DEPTH, jevChildIds } from './jev-candidates.js';
import type { JevCandidate } from './jev-candidates.js';
import type {
  JevEvaluationPhase,
  JevQuestion,
} from '../common/jev-evaluator.js';

type Decide = (
  state: unknown,
  questions: Record<string, JevQuestion>,
  phase: JevEvaluationPhase,
) => Promise<Record<string, string>>;

/** Keep both parent and relative order, reorder within the parent, or choose a new placement. */
export type JevLayoutMode = 'keep' | 'reorder' | 'move';

/** Plan parent edges together, resolve conflicts, then order actual sibling groups. */
export async function arrangeJevLayout(
  selected: JevCandidate[],
  state: Record<string, unknown>,
  decide: Decide,
  retained: ReadonlyMap<string, JevLayoutMode> = new Map(),
  existingIds: ReadonlySet<string> = new Set(retained.keys()),
) {
  const byId = new Map(selected.map(item => [item.id, item]));
  const movable = selected.filter(item => item.movable);
  const mode = (id: string) => retained.get(id) ?? 'move';
  const moving = new Set(
    movable.filter(item => mode(item.id) === 'move').map(item => item.id),
  );
  const containers = selected.filter(item => item.acceptsChildren);
  // A moving node carries fixed slots, templates and descendants whose parents are retained.
  // Include that whole unit in its height budget before offering a new parent.
  const units = new Map<string, { id: string; offset: number }[]>();
  const owner = new Map<string, string>();
  const parents = new Map<string, string>();
  for (const item of selected) {
    let current = item;
    let offset = 0;
    while (!moving.has(current.id) && current.parent !== undefined) {
      current = byId.get(current.parent)!;
      offset++;
    }
    owner.set(item.id, current.id);
    const members = units.get(current.id) ?? [];
    members.push({ id: item.id, offset });
    units.set(current.id, members);
    if (!moving.has(item.id) && item.parent !== undefined) {
      parents.set(item.id, item.parent);
    }
  }
  const height = (id: string) =>
    Math.max(...units.get(id)!.map(item => item.offset));
  const structural = movable.filter(item =>
    moving.has(item.id)
    && containers.some(container => owner.get(container.id) === item.id)
  );
  const depths = new Map(
    units.get('root')!.map(item => [item.id, item.offset]),
  );
  const planned = new Map<string, string>();
  const layoutState = () => ({
    ...state,
    layout_instructions:
      'New elements have no existing placement. Their temporary staging order is not a requested layout. Group related content and controls inside the requested containers and named slots. Read fixed_children to associate compound labels and content slots with their owners. Preserve placement only for existing elements when appropriate. Parent decisions must form one rooted tree. Ordering runs only after parents are resolved: use ordering_groups to choose distinct sibling positions in reading order.',
    planned_parents: Object.fromEntries(planned),
    selected_elements: selected.map(
      ({ id, description, parent, movable, component }) => {
        const siblings = parent === undefined
          ? undefined
          : byId.get(parent)!.component.children;
        return {
          id,
          description,
          origin: existingIds.has(id) ? 'existing' : 'new',
          fixed_children: jevChildIds(component).filter(child =>
            !moving.has(child)
          ),
          existing_parent: existingIds.has(id) ? parent : undefined,
          existing_position: existingIds.has(id) && Array.isArray(siblings)
            ? siblings.indexOf(id)
            : undefined,
          layout_mode: movable ? mode(id) : 'fixed',
          parent: depths.has(id) ? parents.get(id) : undefined,
        };
      },
    ),
  });
  const question = (
    instructions: string,
    criteria: Record<string, string>,
  ): JevQuestion => ({
    type: 'choice',
    instructions,
    criteria,
  });
  const fits = (item: JevCandidate, parent: JevCandidate) => {
    const depth = depths.get(parent.id);
    return depth !== undefined && depth + 1 + height(item.id) < JEV_MAX_DEPTH;
  };
  const parentDescription = (parent: JevCandidate) => {
    const parentOwner = parents.get(parent.id);
    return `${parent.description}${
      parentOwner
        ? ` inside ${byId.get(parentOwner)!.description} (${parentOwner})`
        : (parent.id === 'root' ? ' (page root)' : '')
    }`;
  };
  const parentQuestion = (item: JevCandidate, planning = false) =>
    question(
      `${item.description}: choose its parent${
        planning
          ? ' in the complete container plan'
          : ' among placed containers'
      }. Fill related containers and compound slots. ${
        existingIds.has(item.id)
          ? 'Preserve the existing parent when appropriate.'
          : 'This is a new element with no existing parent. Choose the container for its requested group, including content slots of compound components.'
      }`,
      Object.fromEntries(
        containers.filter(parent => {
          if (owner.get(parent.id) === item.id) return false;
          if (!planning || depths.has(parent.id)) return fits(item, parent);
          // An unplaced unit starts at depth >= 1; its fixed descendants add offsets.
          const offset = units.get(owner.get(parent.id)!)!
            .find(member => member.id === parent.id)!.offset;
          return 1 + offset + 1 + height(item.id) < JEV_MAX_DEPTH;
        }).map(parent => [parent.id, parentDescription(parent)]),
      ),
    );
  const place = (item: JevCandidate, parent: string) => {
    parents.set(item.id, parent);
    const depth = depths.get(parent)! + 1;
    for (const member of units.get(item.id)!) {
      depths.set(member.id, depth + member.offset);
    }
  };
  if (structural.length > 0) {
    const answers = await decide(
      layoutState(),
      Object.fromEntries(
        structural.map(
          item => [`parent_${item.id}`, parentQuestion(item, true)],
        ),
      ),
      'layout',
    );
    for (const item of structural) {
      planned.set(item.id, answers[`parent_${item.id}`]!);
    }
  }
  const pending = new Set(structural.map(item => item.id));
  while (pending.size > 0) {
    let progress = false;
    for (const id of pending) {
      const parent = byId.get(planned.get(id)!)!;
      if (!fits(byId.get(id)!, parent)) continue;
      place(byId.get(id)!, parent.id);
      pending.delete(id);
      progress = true;
    }
    if (progress) continue;

    // Only conflicting edges need another decision. Each option attaches one unit
    // to an already placed parent, so independently chosen repairs cannot form cycles.
    const conflicts: { reason: string; members: string[] }[] = [];
    const visited = new Set<string>();
    for (const id of pending) {
      if (depths.has(planned.get(id)!)) {
        conflicts.push({
          reason: 'The planned parent exceeds the depth budget.',
          members: [id],
        });
      }
      const path: string[] = [];
      let current = id;
      while (pending.has(current) && !visited.has(current)) {
        visited.add(current);
        path.push(current);
        current = owner.get(planned.get(current)!)!;
      }
      const cycleStart = path.indexOf(current);
      if (cycleStart !== -1) {
        conflicts.push({
          reason: 'These parent edges form a cycle.',
          members: path.slice(cycleStart),
        });
      }
    }
    if (conflicts.length === 0) {
      throw new Error('Jev layout has unresolved parent dependencies.');
    }
    const alternatives = conflicts.map(({ members }) =>
      members.flatMap(id =>
        containers.filter(parent => fits(byId.get(id)!, parent)).map(
          parent => ({ id, parent }),
        )
      )
    );
    const answers = await decide(
      { ...layoutState(), structure_conflicts: conflicts },
      Object.fromEntries(conflicts.map((conflict, index) => [
        `attach_${conflict.members[0]}`,
        question(
          `${conflict.reason} Choose one replacement edge that best preserves the requested grouping; the other planned edges remain unchanged.`,
          Object.fromEntries(
            alternatives[index]!.map(({ id, parent }, choice) => [
              String(choice),
              `Place ${byId.get(id)!.description} (${id}) inside ${
                parentDescription(parent)
              } (${parent.id}).`,
            ]),
          ),
        ),
      ])),
      'layout',
    );
    for (const [index, conflict] of conflicts.entries()) {
      const edge =
        alternatives[index]![Number(answers[`attach_${conflict.members[0]}`])]!;
      planned.set(edge.id, edge.parent.id);
    }
  }
  const leaves = movable.filter(item =>
    moving.has(item.id) && !planned.has(item.id)
  );
  if (leaves.length > 0) {
    const answers = await decide(
      layoutState(),
      Object.fromEntries(
        leaves.map(item => [`parent_${item.id}`, parentQuestion(item)]),
      ),
      'layout',
    );
    for (const item of leaves) place(item, answers[`parent_${item.id}`]!);
  }
  const groups = containers.map(parent => ({
    parent: parent.id,
    children: selected.filter(item => parents.get(item.id) === parent.id),
  }));
  const orderingState = () => ({
    ...layoutState(),
    ordering_groups: groups.map(group => ({
      parent: group.parent,
      children: group.children.map(item => ({
        id: item.id,
        description: item.description,
        preserve_relative_order: mode(item.id) === 'keep',
      })),
    })),
  });
  const questions: Record<string, JevQuestion> = {};
  const orders = new Map<string, number>();
  for (const item of movable) {
    if (mode(item.id) === 'keep') continue;
    const peers = groups.find(group =>
      group.parent === parents.get(item.id)
    )!.children;
    if (peers.length <= 1) {
      orders.set(item.id, 0);
      continue;
    }
    questions[`order_${item.id}`] = question(
      `${item.description} (${item.id}): choose its final position within ${
        parents.get(item.id)
      }, starting at zero. Read the actual siblings in ordering_groups and choose distinct positions. Unchanged siblings retain their relative order.`,
      Object.fromEntries(
        peers.map((_, index) => [String(index), `Position ${index}`]),
      ),
    );
  }
  const answers: Record<string, string> = Object.keys(questions).length > 0
    ? await decide(
      orderingState(),
      questions,
      'layout',
    )
    : {};
  for (const item of movable) {
    const order = answers[`order_${item.id}`];
    if (order !== undefined) orders.set(item.id, Number(order));
  }
  const children = new Map<string, string[]>();
  const ties = groups.flatMap(group =>
    [...new Set(group.children.map(item => orders.get(item.id)))].flatMap(
      position => {
        if (position === undefined) return [];
        const members = group.children.filter(item =>
          orders.get(item.id) === position
        );
        return members.length > 1
          ? [{
            parent: group.parent,
            position,
            pending: members,
            resolved: [] as string[],
          }]
          : [];
      },
    )
  );
  while (ties.some(tie => tie.pending.length > 1)) {
    const answers = await decide(
      {
        ...orderingState(),
        ordering_conflicts: ties.map(tie => ({
          parent: tie.parent,
          position: tie.position,
          remaining: tie.pending.map(item => item.id),
          resolved: tie.resolved,
        })),
      },
      Object.fromEntries(
        ties.filter(tie => tie.pending.length > 1).map(tie => [
          `tie_${tie.parent}_${tie.position}`,
          question(
            'These siblings chose the same position. Choose which remaining sibling should appear first in reading order.',
            Object.fromEntries(
              tie.pending.map(item => [item.id, item.description]),
            ),
          ),
        ]),
      ),
      'layout',
    );
    for (const tie of ties) {
      const answer = answers[`tie_${tie.parent}_${tie.position}`];
      if (answer === undefined) continue;
      tie.resolved.push(answer);
      tie.pending = tie.pending.filter(item => item.id !== answer);
    }
  }
  const tieOrder = new Map(
    ties.flatMap(tie =>
      [...tie.resolved, ...tie.pending.map(item => item.id)].map((id, index) =>
        [id, index] as const
      )
    ),
  );
  for (const group of groups) {
    const siblings = group.children;
    const original = byId.get(group.parent)!.component.children as string[];
    const stable = siblings.filter(child => !orders.has(child.id))
      .sort((a, b) => original.indexOf(a.id) - original.indexOf(b.id))
      .map(child => child.id);
    const repositioned = siblings.filter(child => orders.has(child.id))
      .sort((a, b) =>
        orders.get(a.id)! - orders.get(b.id)!
        || (tieOrder.get(a.id) ?? 0) - (tieOrder.get(b.id) ?? 0)
      );
    let previousPosition = -1;
    for (const child of repositioned) {
      const position = Math.max(
        previousPosition + 1,
        Math.min(orders.get(child.id)!, stable.length),
      );
      stable.splice(position, 0, child.id);
      previousPosition = position;
    }
    children.set(group.parent, stable);
  }
  return { parents, orders, children };
}
