import { initializeMainThread } from '@lynx-js/lynx-runtime/main-thread';
import type { ElementRef } from '@lynx-js/type-element-api';

import type {
  CounterPatch,
  EventsFromBackground,
  EventsToBackground,
} from './events.js';
import {
  counterUpdatedEventName,
  incrementCounterEventName,
} from './events.js';

const page = __CreatePage('0', 0);
const pageId = __GetElementUniqueID(page);
__SetClasses(page, 'page');

let button: ElementRef | undefined;
let counterText: ElementRef | undefined;
const buttonEventOptions = {};

function replaceText(text: ElementRef, value: string): void {
  __ReplaceElements(
    text,
    [__CreateRawText(value)],
    __GetChildren(text),
  );
}

function onTap(): void {
  runtime.dispatchToBackground(incrementCounterEventName, undefined);
}

function onCounterUpdated(patch: CounterPatch): void {
  if (!counterText) {
    return;
  }

  replaceText(counterText, `Clicked ${patch.count} times`);
  __FlushElementTree();
}

function renderPage(): void {
  if (button || counterText) {
    return;
  }

  const content = __CreateView(pageId);
  __SetClasses(content, 'content');
  __AppendElement(page, content);

  const text = __CreateText(pageId);
  __SetClasses(text, 'title');
  __AppendElement(text, __CreateRawText('Hello Vanilla Lynx'));
  __AppendElement(content, text);

  counterText = __CreateText(pageId);
  __SetClasses(counterText, 'counter');
  __AppendElement(counterText, __CreateRawText('Clicked 0 times'));
  __AppendElement(content, counterText);

  button = __CreateView(pageId);
  __SetClasses(button, 'button');

  const buttonLabel = __CreateText(pageId);
  __SetClasses(buttonLabel, 'button-label');
  __AppendElement(buttonLabel, __CreateRawText('Click me'));
  __AppendElement(button, buttonLabel);
  __AppendElement(content, button);

  __AddEventListener(button, 'tap', onTap, buttonEventOptions);
}

function cleanup(): void {
  if (button) {
    __RemoveEventListener(button, 'tap', onTap, buttonEventOptions);
  }

  button = undefined;
  counterText = undefined;
}

const runtime = initializeMainThread<
  EventsToBackground,
  EventsFromBackground
>({
  onDestroy: cleanup,
  onRenderPage: renderPage,
});

runtime.onBackgroundEvent(counterUpdatedEventName, onCounterUpdated);
