// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createParser } from '@openuidev/lang-core';
import { afterEach, expect, rstest, test } from '@rstest/core';

import { act, fireEvent, render } from '@lynx-js/react/testing-library';

import { createOpenUiChatPromptLibrary } from '../src/chat/agent.js';
import { createOpenUiChatLibrary } from '../src/chat/index.js';
import { createOpenUiLibrary } from '../src/core/createLibrary.jsx';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

const library = createOpenUiChatLibrary();

afterEach(() => {
  rstest.useRealTimers();
  rstest.restoreAllMocks();
});

test('the missing Chat vocabulary accepts upstream arguments and nested uses', () => {
  const source =
    `root = Card([CardHeader(), CardHeader(null, "Subtitle only"), InlineHeader("**Heading**", "Details"), Callout("info", "Notice", "**Read this**"), Image("Photo", "/photo.jpg"), Image("Pending image"), ImageBlock("/map.jpg", "Map"), Separator(), Separator("vertical", false), form, cards])
form = Form("feedback", Buttons([]), [FormControl("Notes", TextArea("notes", null, 5, {required:true}, $notes))])
$notes = "First line"
cards = CompositeCardBlock([CompositeCardItem("one", Image("Cover", "/cover.jpg"), [Image("Detail", "/detail.jpg")]), CompositeCardItem("two", Image("Other", "/other.jpg"))])`;
  for (const catalog of [library, createOpenUiChatPromptLibrary()]) {
    const result = createParser(catalog.toJSONSchema(), catalog.root).parse(
      source,
    );
    expect(result.meta.errors).toEqual([]);
    expect(result.meta.unresolved).toEqual([]);
    expect(result.meta.incomplete).toBe(false);
  }
  // A same-named Stack component must retain its original positional contract.
  const stack = createOpenUiLibrary();
  const result = createParser(stack.toJSONSchema(), stack.root).parse(
    'root = Stack([CardHeader("Title"), Image("/photo.jpg", "contain", "header"), Separator()])',
  );
  expect(result.meta.errors).toEqual([]);
});

test('Chat headings, Markdown, image arguments and divider orientation render', () => {
  const view = render(
    <OpenUiRenderer
      library={library}
      response={'root = Card([CardHeader(null, "Subtitle only"), InlineHeader("**Compact title**", "Description"), Callout("warning", "Notice", "Keep **warm**"), Image("Photo label", "/photo.jpg"), ImageBlock("/map.jpg", "Map label"), Separator(), Separator("vertical", false)])'}
    />,
  );
  for (
    const label of [
      'Subtitle only',
      'Compact title',
      'Description',
      'Notice',
      'warm',
    ]
  ) {
    expect(view.getByText(label)).toBeTruthy();
  }
  const photo = view.container.querySelector('image[src="/photo.jpg"]');
  expect(photo?.getAttribute('accessibility-label')).toBe('Photo label');
  expect(photo?.getAttribute('mode')).toBe('aspectFill');
  const map = view.container.querySelector('image[src="/map.jpg"]');
  expect(map?.getAttribute('accessibility-label')).toBe('Map label');
  expect(map?.getAttribute('mode')).toBe('aspectFit');
  expect(view.container.querySelector('.OpenUIChatSeparator-horizontal'))
    .toBeTruthy();
  expect(
    view.container.querySelector('.OpenUIChatSeparator-vertical')?.getAttribute(
      'accessibility-role-description',
    ),
  ).toBe('separator');
});

function imageEvent(element: Element, name: 'load' | 'error', detail: unknown) {
  fireEvent(
    element,
    Object.assign(new Event(`bindEvent:${name}`), {
      eventType: 'bindEvent',
      eventName: name,
      detail,
    }),
  );
}

const imageResponse = (src: string) =>
  `root = Card([ImageBlock("${src}", "Travel photo")])`;

test('image blocks load, recover on source replacement and expose failed-image text', () => {
  const view = render(
    <OpenUiRenderer library={library} response={imageResponse('/first.jpg')} />,
  );
  const first = view.container.querySelector('image')!;
  expect(view.container.querySelector('.OpenUIChatImageLoading')).toBeTruthy();
  imageEvent(first, 'load', { width: 800, height: 400 });
  expect(view.container.querySelector('.OpenUIChatImageLoading')).toBeNull();
  expect(
    view.container.querySelector('.OpenUIChatImage')?.getAttribute('style'),
  ).toContain('aspect-ratio: 2');
  view.rerender(
    <OpenUiRenderer library={library} response={imageResponse('/next.jpg')} />,
  );
  expect(view.container.querySelector('.OpenUIChatImageLoading')).toBeTruthy();
  const next = view.container.querySelector('image')!;
  imageEvent(next, 'error', { error_code: 1 });
  expect(view.container.querySelector('.OpenUIChatImageLoading')).toBeNull();
  expect(view.getByText('Travel photo')).toBeTruthy();
  imageEvent(next, 'load', { width: 400, height: 800 });
  expect(view.queryByText('Travel photo')).toBeNull();
  expect(
    view.container.querySelector('.OpenUIChatImage')?.getAttribute('style'),
  ).toContain('aspect-ratio: 0.5');
});

test('reactive callouts dismiss after three seconds without restarting on unrelated renders', async () => {
  rstest.useFakeTimers();
  const response =
    `root = Card([Callout("success", "Saved", "Ready", $visible), Callout("neutral", "Persistent", "No binding"), TextContent($visible ? "Shown" : "Hidden"), Button("Show again", Action([@Set($visible, true)]))])
$visible = true`;
  const view = render(<OpenUiRenderer library={library} response='' />);
  view.rerender(<OpenUiRenderer library={library} response={response} />);
  expect(view.getByText('Saved')).toBeTruthy();
  await act(async () => {
    await rstest.advanceTimersByTimeAsync(2000);
  });
  view.rerender(
    <OpenUiRenderer library={library} response={response + '\nunused = 1'} />,
  );
  await act(async () => {
    await rstest.advanceTimersByTimeAsync(999);
  });
  expect(view.getByText('Saved')).toBeTruthy();
  await act(async () => {
    await rstest.advanceTimersByTimeAsync(1);
  });
  expect(view.queryByText('Saved')).toBeNull();
  expect(view.getByText('Hidden')).toBeTruthy();
  expect(view.getByText('Persistent')).toBeTruthy();
  fireEvent.tap(view.getByText('Show again'));
  await act(() => Promise.resolve());
  expect(view.getByText('Saved')).toBeTruthy();
  await act(async () => {
    await rstest.advanceTimersByTimeAsync(3000);
  });
  expect(view.queryByText('Saved')).toBeNull();
});

test('a hidden hydrated callout stays hidden and timers are cleared on unmount', async () => {
  rstest.useFakeTimers();
  const response =
    'root = Card([Callout("info", "Temporary", "Notice", $visible)])\n$visible = true';
  const hidden = render(
    <OpenUiRenderer
      library={library}
      response={response}
      initialState={{ $visible: false }}
    />,
  );
  expect(hidden.queryByText('Temporary')).toBeNull();
  hidden.unmount();
  const schedule = rstest.spyOn(globalThis, 'setTimeout');
  const cancel = rstest.spyOn(globalThis, 'clearTimeout');
  const visible = render(
    <OpenUiRenderer library={library} response={response} />,
  );
  expect(visible.getByText('Temporary')).toBeTruthy();
  const index = schedule.mock.calls.findIndex(([, delay]) => delay === 3000);
  expect(index).toBeGreaterThanOrEqual(0);
  const timer: unknown = schedule.mock.results[index]?.value;
  visible.unmount();
  expect(cancel).toHaveBeenCalledWith(timer);
  await act(async () => {
    await rstest.advanceTimersByTimeAsync(3000);
  });
});
