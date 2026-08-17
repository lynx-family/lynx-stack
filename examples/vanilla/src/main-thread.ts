import type { ElementRef } from '@lynx-js/type-element-api';

import type { CounterPatch, PerformancePatch } from './events.js';
import {
  counterUpdatedEventName,
  destroyLifetimeEventName,
  incrementCounterEventName,
  performanceUpdatedEventName,
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
let initialRenderText: ElementRef | undefined;
let updateText: ElementRef | undefined;

const tapEventOptions = {};

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
  if (
    typeof patch?.count !== 'number'
    || !counterText
  ) {
    return;
  }

  replaceText(counterText, `Clicked ${patch.count} times`);
  __FlushElementTree(page, { pipelineOptions: patch.pipelineOptions ?? {} });
}

function onPerformanceUpdated(event: { data: unknown }): void {
  const patch = event.data as Partial<PerformancePatch> | undefined;
  if (typeof patch?.summary !== 'string') {
    return;
  }

  let target: ElementRef | undefined;
  switch (patch.kind) {
    case 'initialRender':
      target = initialRenderText;
      break;
    case 'update':
      target = updateText;
      break;
  }

  if (!target) {
    return;
  }

  replaceText(target, patch.summary);
  __FlushElementTree();
}

function renderPerformancePanel(content: ElementRef): void {
  const performancePanel = __CreateView(pageId);
  __SetClasses(performancePanel, 'performance-panel');
  __AppendElement(content, performancePanel);

  const performanceTitle = __CreateText(pageId);
  __SetClasses(performanceTitle, 'performance-title');
  __AppendElement(
    performanceTitle,
    __CreateRawText('Performance API'),
  );
  __AppendElement(performancePanel, performanceTitle);

  initialRenderText = __CreateText(pageId);
  __SetClasses(initialRenderText, 'performance-row');
  __AppendElement(
    initialRenderText,
    __CreateRawText('Initial render: waiting for loadBundle...'),
  );
  __AppendElement(performancePanel, initialRenderText);

  updateText = __CreateText(pageId);
  __SetClasses(updateText, 'performance-row');
  __AppendElement(
    updateText,
    __CreateRawText('Update: tap the button to measure the pipeline'),
  );
  __AppendElement(performancePanel, updateText);

  const performanceHint = __CreateText(pageId);
  __SetClasses(performanceHint, 'performance-hint');
  __AppendElement(
    performanceHint,
    __CreateRawText('Full entries are logged on the background thread.'),
  );
  __AppendElement(performancePanel, performanceHint);
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

  __AddEventListener(button, 'tap', onTap, tapEventOptions);
  renderPerformancePanel(content);
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
  backgroundThread.removeEventListener(
    performanceUpdatedEventName,
    onPerformanceUpdated,
  );
  engine.removeEventListener('__RenderPage', renderPage);
  engine.removeEventListener(destroyLifetimeEventName, cleanup);

  if (button) {
    __RemoveEventListener(button, 'tap', onTap, tapEventOptions);
  }

  button = undefined;
  counterText = undefined;
  initialRenderText = undefined;
  updateText = undefined;
}

backgroundThread.addEventListener(counterUpdatedEventName, onCounterUpdated);
backgroundThread.addEventListener(
  performanceUpdatedEventName,
  onPerformanceUpdated,
);
engine.addEventListener('__RenderPage', renderPage);
engine.addEventListener(destroyLifetimeEventName, cleanup);
