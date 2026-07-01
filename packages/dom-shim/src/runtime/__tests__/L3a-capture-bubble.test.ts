// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EVENT_PHASE_AT_TARGET,
  EVENT_PHASE_BUBBLING,
  EVENT_PHASE_CAPTURING,
  fireEvent,
} from '../events.ts';
import { wrapPapi } from '../nodes.ts';
import type { L3aEventfulElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 11000;
function mk(): MockEl {
  return { tag: 'view', uid: nextUid++, parent: undefined, children: [] };
}

function installPapi(): void {
  nextUid = 11000;
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__GetPageElement'] = () => undefined;
  g['__AddEvent'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

function buildTree(): {
  root: MockEl;
  mid: MockEl;
  leaf: MockEl;
} {
  const root = mk();
  const mid = mk();
  const leaf = mk();
  root.children = [mid];
  mid.parent = root;
  mid.children = [leaf];
  leaf.parent = mid;
  return { root, mid, leaf };
}

describe('US-434 synthetic capture + bubble dispatch', () => {
  beforeEach(() => {
    installPapi();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('capture-phase fires top-down on ancestors only', () => {
    const tree = buildTree();
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const mid = wrapPapi(tree.mid) as L3aEventfulElement;
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const log: string[] = [];
    root.addEventListener('click', () => log.push('root-cap'), {
      capture: true,
    });
    mid.addEventListener('click', () => log.push('mid-cap'), { capture: true });
    leaf.addEventListener('click', () => log.push('leaf-cap'), {
      capture: true,
    });
    fireEvent(tree.leaf, 'click');
    expect(log).toEqual(['root-cap', 'mid-cap', 'leaf-cap']);
  });

  it('bubble-phase fires bottom-up on ancestors only (no capture handlers)', () => {
    const tree = buildTree();
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const mid = wrapPapi(tree.mid) as L3aEventfulElement;
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const log: string[] = [];
    root.addEventListener('click', () => log.push('root-bub'));
    mid.addEventListener('click', () => log.push('mid-bub'));
    leaf.addEventListener('click', () => log.push('leaf-bub'));
    fireEvent(tree.leaf, 'click');
    expect(log).toEqual(['leaf-bub', 'mid-bub', 'root-bub']);
  });

  it('full capture + target + bubble dispatch order on 3 levels', () => {
    const tree = buildTree();
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const mid = wrapPapi(tree.mid) as L3aEventfulElement;
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const log: string[] = [];
    root.addEventListener('click', () => log.push('root-cap'), {
      capture: true,
    });
    mid.addEventListener('click', () => log.push('mid-cap'), { capture: true });
    leaf.addEventListener('click', () => log.push('leaf-target-cap'), {
      capture: true,
    });
    leaf.addEventListener('click', () => log.push('leaf-target-bub'));
    mid.addEventListener('click', () => log.push('mid-bub'));
    root.addEventListener('click', () => log.push('root-bub'));
    fireEvent(tree.leaf, 'click');
    expect(log).toEqual([
      'root-cap',
      'mid-cap',
      'leaf-target-cap',
      'leaf-target-bub',
      'mid-bub',
      'root-bub',
    ]);
  });

  it('stopPropagation halts after current node finishes', () => {
    const tree = buildTree();
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const mid = wrapPapi(tree.mid) as L3aEventfulElement;
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const log: string[] = [];
    root.addEventListener('click', () => log.push('root-cap'), {
      capture: true,
    });
    mid.addEventListener('click', (e) => {
      log.push('mid-cap-stop');
      e.stopPropagation();
    }, { capture: true });
    leaf.addEventListener('click', () => log.push('leaf-cap'), {
      capture: true,
    });
    leaf.addEventListener('click', () => log.push('leaf-bub'));
    root.addEventListener('click', () => log.push('root-bub'));
    fireEvent(tree.leaf, 'click');
    // root-cap fires; mid-cap-stop fires + halts; leaf never reached.
    expect(log).toEqual(['root-cap', 'mid-cap-stop']);
  });

  it('stopImmediatePropagation halts within current target listener set', () => {
    const tree = buildTree();
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const log: string[] = [];
    leaf.addEventListener('click', (e) => {
      log.push('a');
      e.stopImmediatePropagation();
    });
    leaf.addEventListener('click', () => log.push('b'));
    root.addEventListener('click', () => log.push('root-bub'));
    fireEvent(tree.leaf, 'click');
    expect(log).toEqual(['a']);
  });

  it('bubbles=false skips the bubble phase', () => {
    const tree = buildTree();
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const log: string[] = [];
    leaf.addEventListener('click', () => log.push('leaf'));
    root.addEventListener('click', () => log.push('root-bub'));
    fireEvent(tree.leaf, 'click', { bubbles: false });
    expect(log).toEqual(['leaf']);
  });

  it('event.eventPhase tracks the active phase', () => {
    const tree = buildTree();
    const root = wrapPapi(tree.root) as L3aEventfulElement;
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    const phases: number[] = [];
    root.addEventListener('click', (e) => phases.push(e.eventPhase), {
      capture: true,
    });
    leaf.addEventListener('click', (e) => phases.push(e.eventPhase));
    root.addEventListener('click', (e) => phases.push(e.eventPhase));
    fireEvent(tree.leaf, 'click');
    expect(phases).toEqual([
      EVENT_PHASE_CAPTURING,
      EVENT_PHASE_AT_TARGET,
      EVENT_PHASE_BUBBLING,
    ]);
  });

  it('passive listener cannot preventDefault', () => {
    const tree = buildTree();
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    leaf.addEventListener('click', (e) => e.preventDefault(), {
      passive: true,
    });
    const event = fireEvent(tree.leaf, 'click');
    expect(event.defaultPrevented).toBe(false);
  });

  it('non-passive listener preventDefault flips defaultPrevented', () => {
    const tree = buildTree();
    const leaf = wrapPapi(tree.leaf) as L3aEventfulElement;
    leaf.addEventListener('click', (e) => e.preventDefault());
    const event = fireEvent(tree.leaf, 'click');
    expect(event.defaultPrevented).toBe(true);
  });
});
