import type { ElementRef } from '@lynx-js/type-element-api';

import type { CounterPatch } from './events.js';
import {
  counterUpdatedEventName,
  destroyLifetimeEventName,
  incrementCounterEventName,
} from './events.js';

const page = __CreatePage('0', 0);
const pageId = __GetElementUniqueID(page);
__SetClasses(page, 'page');

Object.assign(globalThis, {
  processData: (data: unknown): unknown => data,
});

const engine = lynx.getEngine();
const backgroundThread = lynx.getJSContext();

let button: ElementRef | undefined;
let counterText: ElementRef | undefined;

function replaceText(text: ElementRef, value: string): void {
  __ReplaceElements(
    text,
    [__CreateRawText(value)],
    __GetChildren(text),
  );
}

function onTap(): void {
  backgroundThread.dispatchEvent({
    type: incrementCounterEventName,
    data: undefined,
  });
}

function onCounterUpdated(event: { data: unknown }): void {
  const patch = event.data as Partial<CounterPatch> | undefined;
  if (typeof patch?.count !== 'number' || !counterText) {
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

  __AddEventListener(button, 'tap', onTap, {});
}

function cleanup(): void {
  backgroundThread.dispatchEvent({
    type: destroyLifetimeEventName,
    data: undefined,
  });
  backgroundThread.removeEventListener(
    counterUpdatedEventName,
    onCounterUpdated,
  );
  engine.removeEventListener('__RenderPage', renderPage);
  engine.removeEventListener(destroyLifetimeEventName, cleanup);

  if (button) {
    __RemoveEventListener(button, 'tap', onTap);
  }

  button = undefined;
  counterText = undefined;
}

backgroundThread.addEventListener(counterUpdatedEventName, onCounterUpdated);
engine.addEventListener('__RenderPage', renderPage);
engine.addEventListener(destroyLifetimeEventName, cleanup);
