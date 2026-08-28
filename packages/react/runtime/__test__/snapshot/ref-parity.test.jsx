// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component } from 'preact';
import { jsx as backgroundJsx } from 'preact/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '../../src/index';
import { createElement, cloneElement } from '../../lepus';
import { jsx as mainThreadJsx } from '../../lepus/jsx-runtime';
import { snapshotCreatorMap } from '../../src/snapshot';

describe('ref parity between the main and background threads', () => {
  function FunctionComponent() {
    return null;
  }

  class ClassComponent extends Component {
    render() {
      return null;
    }
  }

  const ref = () => {};

  beforeEach(() => {
    snapshotCreatorMap['view'] = () => {};
  });

  afterEach(() => {
    delete snapshotCreatorMap['view'];
  });

  describe.each([
    ['function component', FunctionComponent],
    ['class component', ClassComponent],
  ])('%s', (_, type) => {
    it('jsx keeps the same ref prop as the background thread', () => {
      const background = backgroundJsx(type, { ref, id: 'x' });
      const mainThread = mainThreadJsx(type, { ref, id: 'x' });

      expect(mainThread.props).toEqual(background.props);
    });

    it('createElement keeps the same ref prop as the background thread', () => {
      const background = backgroundJsx(type, { ref, id: 'x' });
      const mainThread = createElement(type, { ref, id: 'x' });

      expect(mainThread.props).toEqual(background.props);
    });

    it('cloneElement keeps the same ref prop as the background thread', () => {
      const background = backgroundJsx(type, { ref, id: 'x' });
      const mainThread = cloneElement(createElement(type, { id: 'x' }), { ref });

      expect(mainThread.props).toEqual(background.props);
    });
  });

  it('createElement lifts ref off props for host elements, like the background thread', () => {
    const background = backgroundJsx('view', { ref, id: 'x' });
    const mainThread = createElement('view', { ref, id: 'x' });

    expect(mainThread.props).toEqual(background.props);
  });

  it('renders the same tree on both threads when a component reads props.ref', () => {
    function Branching(props) {
      return props.ref ? 'with-ref' : 'without-ref';
    }

    const background = Branching(backgroundJsx(Branching, { ref }).props);
    const mainThread = Branching(mainThreadJsx(Branching, { ref }).props);

    expect(mainThread).toBe(background);
  });
});
