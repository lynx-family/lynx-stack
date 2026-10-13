// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createParser } from '@openuidev/lang-core';
import type { ActionEvent } from '@openuidev/lang-core';
import { beforeEach, expect, rstest, test } from '@rstest/core';

import * as actualLynxUI from '@lynx-js/lynx-ui' with {
  rstest: 'importActual',
};
import type { InputProps, SliderRootProps } from '@lynx-js/lynx-ui';
import { useEffect } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@lynx-js/react/testing-library';

import { createOpenUiChatLibrary } from '../src/chat/index.js';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

// Native input invocation and slider gestures are owned by lynx-ui. Keep their
// typed value/callback boundary, exercising our parser, adapters, store and forms.
const controls = rstest.hoisted(() => ({
  inputs: new Map<string, InputProps>(),
  mounts: new Map<string, number>(),
  sliders: [] as SliderRootProps[],
}));
rstest.mock('@lynx-js/lynx-ui', () => {
  const container = ({ children }: { children?: ReactNode }) => (
    <view>{children}</view>
  );
  return {
    ...actualLynxUI,
    Input: (props: InputProps) => {
      const id = props.id ?? '';
      controls.inputs.set(id, props);
      useEffect(() => {
        controls.mounts.set(id, (controls.mounts.get(id) ?? 0) + 1);
      }, [id]);
      return <text>{`${id}: ${props.value ?? ''}`}</text>;
    },
    SliderRoot: (props: SliderRootProps) => {
      controls.sliders.push(props);
      return <view>{props.children}</view>;
    },
    SliderTrack: container,
    SliderIndicator: container,
    SliderThumb: container,
  };
});

beforeEach(() => {
  controls.inputs.clear();
  controls.mounts.clear();
  controls.sliders.length = 0;
});
const library = createOpenUiChatLibrary();

async function enter(name: string, value: string) {
  const input = controls.inputs.get(name);
  expect(input).toBeDefined();
  await act(() => input?.onInput?.(value, value.length, value.length, false));
}

const checklist = `root = Card([form, count])
$ready = {visa:false,boots:false}
form = Form("trip", Buttons([Button("Continue")]), [a,b])
a = FormControl("Documents", CheckBoxGroup("ready", [CheckBoxItem("Visa", "Check documents", "visa")], {required:true}, $ready))
b = FormControl("Clothes", CheckBoxGroup("ready", [CheckBoxItem("Boots", "Pack footwear", "boots")], {required:true}, $ready))
count = TextContent("Ready " + ($ready.visa ? 1 : 0) + " / " + ($ready.boots ? 1 : 0))`;

test('shared checkbox bindings merge across groups and validate each group', async () => {
  const onAction = rstest.fn<(event: ActionEvent) => void>();
  const view = render(
    <OpenUiRenderer
      library={library}
      response={checklist}
      onAction={onAction}
    />,
  );
  fireEvent.tap(view.getByText('Visa'));
  await waitFor(() => expect(view.getByText('Ready 1 / 0')).toBeTruthy());
  fireEvent.tap(view.getByText('Continue'));
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.tap(view.getByText('Boots'));
  await waitFor(() => expect(view.getByText('Ready 1 / 1')).toBeTruthy());
  fireEvent.tap(view.getByText('Continue'));
  await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  expect(onAction.mock.calls[0]?.[0].formState).toMatchObject({
    $ready: { visa: true, boots: true },
  });
});

const billSource = (fields: string[]) =>
  `root = Card([Form("bill", Buttons([Button("Save")]), [${fields.join(',')}])])
item01 = FormControl("Item 01", Input("dish01"))
item02 = FormControl("Item 02", Input("dish02"))
item03 = FormControl("Item 03", Input("dish03"))
item04 = FormControl("Item 04", Input("dish04"))`;

test('deleting and adding siblings preserves the remaining input and its instance', async () => {
  const view = render(
    <OpenUiRenderer
      library={library}
      response={billSource(['item01', 'item02', 'item03'])}
    />,
  );
  await enter('dish03', 'Cacio e Pepe');
  await waitFor(() =>
    expect(controls.inputs.get('dish03')?.value).toBe('Cacio e Pepe')
  );
  const mounts = controls.mounts.get('dish03');
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={billSource(['item01', 'item03'])}
    />,
  );
  await waitFor(() =>
    expect(view.getByText('dish03: Cacio e Pepe')).toBeTruthy()
  );
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={billSource(['item04', 'item03', 'item01'])}
    />,
  );
  await waitFor(() => expect(controls.inputs.get('dish04')?.value).toBe(''));
  expect(controls.inputs.get('dish03')?.value).toBe('Cacio e Pepe');
  expect(controls.mounts.get('dish03')).toBe(mounts);
});

test('required fields block submission until valid and send named form data', async () => {
  const response =
    'root = Card([Form("contact", Buttons([Button("Submit")]), [FormControl("Email", Input("email", "name@example.com", "email", {required:true,email:true}))])])';
  const onAction = rstest.fn<(event: ActionEvent) => void>();
  const view = render(
    <OpenUiRenderer
      library={library}
      response={response}
      onAction={onAction}
    />,
  );
  fireEvent.tap(view.getByText('Submit'));
  expect(onAction).not.toHaveBeenCalled();
  await enter('email', 'invalid');
  fireEvent.tap(view.getByText('Submit'));
  expect(onAction).not.toHaveBeenCalled();
  await enter('email', 'traveler@example.com');
  fireEvent.tap(view.getByText('Submit'));
  await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  expect(onAction.mock.calls[0]?.[0].formState).toMatchObject({
    contact: { email: { value: 'traveler@example.com' } },
  });
});

test('slider array bindings update dependent calculations with the configured step', async () => {
  const response =
    'root = Card([Form("budget", Buttons([]), [FormControl("Budget", Slider("amount", "discrete", 100, 1000, 10, [500], "Budget", null, $amount))]), TextContent("Amount " + @First($amount))])\n$amount = [500]';
  const parsed = createParser(library.toJSONSchema(), library.root).parse(
    response,
  );
  expect(parsed.meta.errors).toEqual([]);
  const view = render(<OpenUiRenderer library={library} response={response} />);
  expect(view.getByText('Amount 500')).toBeTruthy();
  await act(() =>
    controls.sliders[controls.sliders.length - 1]?.onValueChange?.(
      0.673,
      'drag',
    )
  );
  await waitFor(() => expect(view.getByText('Amount 710')).toBeTruthy());
});

test('radio defaults hydrate and streaming blocks edits without losing stored values', async () => {
  const response =
    'root = Card([Form("trip", Buttons([]), [FormControl("City", Input("city", null, "text", null, $city)), FormControl("Style", RadioGroup("style", [RadioItem("Quiet", "Rest", "quiet"), RadioItem("Central", "Transport", "central")], "quiet", null, $style))]), TextContent("Style " + $style)])\n$city = ""\n$style = "quiet"';
  const initialState = { $city: 'Osaka', $style: 'central' };
  const view = render(
    <OpenUiRenderer
      library={library}
      response={response}
      initialState={initialState}
    />,
  );
  expect(view.getByText('city: Osaka')).toBeTruthy();
  expect(view.getByText('Style central')).toBeTruthy();
  fireEvent.tap(view.getByText('Quiet'));
  await waitFor(() => expect(view.getByText('Style quiet')).toBeTruthy());
  view.rerender(
    <OpenUiRenderer
      library={library}
      response={response}
      initialState={initialState}
      isStreaming
    />,
  );
  expect(controls.inputs.get('city')?.readonly).toBe(true);
  await enter('city', 'changed');
  expect(controls.inputs.get('city')?.value).toBe('Osaka');
});
