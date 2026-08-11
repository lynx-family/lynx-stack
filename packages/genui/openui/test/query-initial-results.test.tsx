// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';
import { z } from 'zod/v4';

import { render, waitFor } from '@lynx-js/react/testing-library';

import { useIsQueryLoading } from '../src/core/context.js';
import { createLibrary, defineComponent } from '../src/core/library.jsx';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

interface Observation {
  loading: boolean;
  value: unknown;
}

function createProbeLibrary(
  observations: Observation[],
  events?: string[],
) {
  const Probe = defineComponent({
    name: 'Probe',
    description: 'Records one value for runtime tests.',
    props: z.object({ value: z.unknown() }),
    component({ props }) {
      observations.push({
        loading: useIsQueryLoading(),
        value: props.value,
      });
      events?.push(`render:${String(props.value)}`);
      return <text>{JSON.stringify(props.value)}</text>;
    },
  });

  return createLibrary({
    root: 'Probe',
    components: [Probe],
    componentGroups: [],
  });
}

describe('OpenUI Query initial results', () => {
  test('renders Query defaults on the first screen without running tools', () => {
    const observations: Observation[] = [];
    const tool = rstest.fn(() => 'network');

    render(
      <OpenUiRenderer
        response={'data = Query("load_data", {}, "default")\nroot = Probe(data)'}
        library={createProbeLibrary(observations)}
        toolProvider={{ load_data: tool }}
      />,
      { enableMainThread: true, enableBackgroundThread: false },
    );

    expect(observations[0]).toEqual({ loading: false, value: 'default' });
    expect(tool).not.toHaveBeenCalled();
  });

  test('renders prefetched results on the first screen before revalidation', async () => {
    const observations: Observation[] = [];
    const events: string[] = [];
    const library = createProbeLibrary(observations, events);
    const tool = rstest.fn(() => {
      events.push('provider');
      return 'fresh';
    });

    render(
      <OpenUiRenderer
        response={'data = Query("load_data", {}, "default")\nroot = Probe(data)'}
        library={library}
        initialQueryResults={{ data: 'prefetched' }}
        toolProvider={{ load_data: tool }}
      />,
    );

    expect(events[0]).toBe('render:prefetched');
    await waitFor(() => {
      expect(observations[observations.length - 1]?.value).toBe('fresh');
    });
    expect(tool).toHaveBeenCalledTimes(1);
  });

  test('keys results by statement ID and preserves falsy values', () => {
    const observations: Array<Record<string, unknown>> = [];
    const ProbeValues = defineComponent({
      name: 'ProbeValues',
      description: 'Records multiple values for runtime tests.',
      props: z.object({
        first: z.unknown(),
        second: z.unknown(),
        third: z.unknown(),
      }),
      component({ props }) {
        observations.push(props);
        return <view />;
      },
    });
    const library = createLibrary({
      root: 'ProbeValues',
      components: [ProbeValues],
      componentGroups: [],
    });

    render(
      <OpenUiRenderer
        response={[
          'first = Query("shared_tool", { id: 1 }, "first default")',
          'second = Query("shared_tool", { id: 2 }, "second default")',
          'third = Query("shared_tool", { id: 3 }, "third default")',
          'root = ProbeValues(first, second, third)',
        ].join('\n')}
        library={library}
        initialQueryResults={{ first: 0, second: false, third: null }}
      />,
      { enableMainThread: true, enableBackgroundThread: false },
    );

    expect(observations[0]).toEqual({
      first: 0,
      second: false,
      third: null,
    });
  });

  test('uses initial state when evaluating the first Query request', async () => {
    const observations: Observation[] = [];
    const tool = rstest.fn(() => 'fresh');

    render(
      <OpenUiRenderer
        response={[
          '$city = "declaration"',
          'data = Query("load_data", { city: $city }, "default")',
          'root = Probe(data)',
        ].join('\n')}
        library={createProbeLibrary(observations)}
        initialState={{ $city: 'persisted' }}
        initialQueryResults={{ data: 'prefetched' }}
        toolProvider={{ load_data: tool }}
      />,
    );

    await waitFor(() => expect(tool).toHaveBeenCalled());
    expect(tool).toHaveBeenCalledTimes(1);
    expect(tool).toHaveBeenCalledWith({ city: 'persisted' });
    expect(observations[0]?.value).toBe('prefetched');
  });

  test('does not reuse Query data when a new response keeps the statement ID', async () => {
    const observations: Observation[] = [];
    const library = createProbeLibrary(observations);
    const networkError = new Error('network unavailable');
    const tool = rstest.fn(({ version }: Record<string, unknown>) => {
      return version === 'A' ? 'fresh A' : Promise.reject(networkError);
    });
    const consoleError = rstest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const responseA =
      'data = Query("load_data", { version: "A" }, "default A")\nroot = Probe(data)';
    const responseB =
      'data = Query("load_data", { version: "B" }, "default B")\nroot = Probe(data)';

    const view = render(
      <OpenUiRenderer
        response={responseA}
        library={library}
        initialQueryResults={{ data: 'prefetched A' }}
        toolProvider={{ load_data: tool }}
      />,
    );

    await waitFor(() => {
      expect(observations[observations.length - 1]?.value).toBe('fresh A');
    });

    const firstBRender = observations.length;
    view.rerender(
      <OpenUiRenderer
        response={responseB}
        library={library}
        initialQueryResults={{ data: 'prefetched B' }}
        toolProvider={{ load_data: tool }}
      />,
    );

    expect(observations[firstBRender]?.value).toBe('prefetched B');
    await waitFor(() => expect(tool).toHaveBeenCalledTimes(2));
    expect(observations[observations.length - 1]?.value).toBe('prefetched B');
    expect(consoleError).toHaveBeenCalledWith(
      'Query "load_data" failed:',
      networkError,
    );
    consoleError.mockRestore();
  });
});
