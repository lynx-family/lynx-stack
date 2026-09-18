// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';
import { z } from 'zod/v4';

import { render, waitFor } from '@lynx-js/react/testing-library';

import { createLibrary, defineComponent } from '../src/core/library.jsx';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

describe('OpenUI renderer error feedback', () => {
  test('reports final prop errors and clears them for the next stream', async () => {
    const Probe = defineComponent({
      name: 'Probe',
      description: 'Requires a string.',
      props: z.object({ value: z.string() }),
      component: ({ props }) => <text>{props.value}</text>,
    });
    const library = createLibrary({ root: 'Probe', components: [Probe] });
    const onError = rstest.fn();
    const view = render(
      <OpenUiRenderer
        library={library}
        response='root = Probe(12)'
        isStreaming
        onError={onError}
      />,
    );

    expect(onError).not.toHaveBeenCalled();
    view.rerender(
      <OpenUiRenderer
        library={library}
        response='root = Probe(12)'
        onError={onError}
      />,
    );
    await waitFor(() => {
      expect(onError).toHaveBeenLastCalledWith(expect.arrayContaining([
        expect.objectContaining({
          source: 'parser',
          code: 'type-mismatch',
          component: 'Probe',
          statementId: 'root',
          path: '/value',
        }),
      ]));
    });

    view.rerender(
      <OpenUiRenderer
        library={library}
        response='root = Probe("fixed")'
        isStreaming
        onError={onError}
      />,
    );
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith([]));
    view.rerender(
      <OpenUiRenderer
        library={library}
        response='root = Probe("fixed")'
        onError={onError}
      />,
    );
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith([]));
  });

  test('reports a pruned nested value while rendering valid siblings', async () => {
    const observations: unknown[] = [];
    const Probe = defineComponent({
      name: 'Probe',
      description: 'Records validated rows.',
      props: z.object({ rows: z.array(z.object({ label: z.string() })) }),
      component({ props }) {
        observations.push(props.rows);
        return <text>{JSON.stringify(props.rows)}</text>;
      },
    });
    const library = createLibrary({ root: 'Probe', components: [Probe] });
    const onError = rstest.fn();
    render(
      <OpenUiRenderer
        library={library}
        response={'root = Probe([{ label: "kept" }, { label: 12 }])'}
        onError={onError}
      />,
    );

    await waitFor(() => {
      expect(onError).toHaveBeenLastCalledWith(expect.arrayContaining([
        expect.objectContaining({
          source: 'parser',
          code: 'type-mismatch',
          path: '/rows/1/label',
        }),
      ]));
    });
    expect(observations[observations.length - 1]).toEqual([{ label: 'kept' }]);
  });
});
