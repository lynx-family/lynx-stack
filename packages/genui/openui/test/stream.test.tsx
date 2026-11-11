// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, rstest, test } from '@rstest/core';
import { z } from 'zod/v4';

import { render, waitFor } from '@lynx-js/react/testing-library';

import { useIsStreaming } from '../src/core/context.js';
import { createLibrary, defineComponent } from '../src/core/library.jsx';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

function probe() {
  const values: Array<{ value: unknown; streaming: boolean }> = [];
  const Probe = defineComponent({
    name: 'Probe',
    description: 'Observes streamed render state.',
    props: z.object({ value: z.unknown() }),
    component({ props }) {
      values.push({ value: props.value, streaming: useIsStreaming() });
      return <text>{String(props.value)}</text>;
    },
  });
  return {
    values,
    library: createLibrary({
      root: 'Probe',
      components: [Probe],
      componentGroups: [],
    }),
  };
}

test('previews accumulated deltas and resolves forward references as text arrives', async () => {
  const { library, values } = probe();
  const view = render(
    <OpenUiRenderer
      library={library}
      response='root = Probe(message)'
      isStreaming
    />,
  );
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={'root = Probe(message)\nmessage = "fir'}
      isStreaming
    />,
  );
  await waitFor(() =>
    expect(values[values.length - 1]).toEqual({ value: 'fir', streaming: true })
  );
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={'root = Probe(message)\nmessage = "first"'}
      isStreaming
    />,
  );
  await waitFor(() =>
    expect(values[values.length - 1]).toEqual({
      value: 'first',
      streaming: true,
    })
  );
});

test('runs queries when streaming ends even if response text is unchanged', async () => {
  const { library, values } = probe();
  const tool = rstest.fn(() => 'loaded');
  const toolProvider = { load: tool };
  const response = 'data = Query("load", {}, "pending")\nroot = Probe(data)';
  const view = render(
    <OpenUiRenderer
      library={library}
      response='root = Probe("first")'
      isStreaming
      toolProvider={toolProvider}
    />,
  );
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={response}
      isStreaming
      toolProvider={toolProvider}
    />,
  );
  await waitFor(() =>
    expect(values[values.length - 1]).toEqual({ value: null, streaming: true })
  );
  expect(tool).not.toHaveBeenCalled();
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={response}
      isStreaming={false}
      toolProvider={toolProvider}
    />,
  );
  await waitFor(() =>
    expect(values[values.length - 1]).toEqual({
      value: 'loaded',
      streaming: false,
    })
  );
  expect(tool).toHaveBeenCalledTimes(1);
});

test('clears an interrupted response without executing its queries', async () => {
  const { library, values } = probe();
  const tool = rstest.fn();
  const toolProvider = { load: tool };
  const view = render(
    <OpenUiRenderer
      library={library}
      response={'data = Query("load", {}, "pending")\nroot = Probe(data)'}
      isStreaming
      toolProvider={toolProvider}
    />,
  );
  await waitFor(() =>
    expect(values[values.length - 1]).toEqual({ value: null, streaming: true })
  );
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={null}
      isStreaming={false}
      toolProvider={toolProvider}
    />,
  );
  await waitFor(() => expect(view.queryByText('null')).toBeNull());
  expect(tool).not.toHaveBeenCalled();
});

test('renders persisted text and resets form state with a new session key', async () => {
  const { library, values } = probe();
  const view = render(
    <OpenUiRenderer
      key='saved'
      library={library}
      response={'$city = "default"\nroot = Probe($city)'}
      initialState={{ $city: 'saved' }}
    />,
  );
  expect(values[0]).toEqual({ value: 'saved', streaming: false });
  view.rerender(
    <OpenUiRenderer
      key='new'
      library={library}
      response={'$city = "new"\nroot = Probe($city)'}
    />,
  );
  await waitFor(() =>
    expect(values[values.length - 1]).toEqual({
      value: 'new',
      streaming: false,
    })
  );
});
