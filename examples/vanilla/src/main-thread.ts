import type { Unsubscribe } from '@lynx-js/lynx-runtime';
import {
  flushElementTree,
  onDestroy,
  onMessage,
  onRenderPage,
  sendMessage,
} from '@lynx-js/lynx-runtime/mts';
import type { ElementRef } from '@lynx-js/type-element-api';

import type { CounterPatch } from './events.js';
import {
  counterUpdatedEventName,
  incrementCounterEventName,
} from './events.js';

const page = __CreatePage('0', 0);
const pageId = __GetElementUniqueID(page);
__SetClasses(page, 'page');

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
  sendMessage(incrementCounterEventName);
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

const stops: Unsubscribe[] = [
  onMessage<Partial<CounterPatch> | undefined>(
    counterUpdatedEventName,
    (patch) => {
      if (typeof patch?.count !== 'number' || !counterText) {
        return;
      }

      replaceText(counterText, `Clicked ${patch.count} times`);
      flushElementTree();
    },
  ),
  onRenderPage(renderPage),
];

const stopDestroy = onDestroy(() => {
  for (const stop of stops) {
    stop();
  }
  stopDestroy();

  if (button) {
    __RemoveEventListener(button, 'tap', onTap, {});
  }

  button = undefined;
  counterText = undefined;
});
