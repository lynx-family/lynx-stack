import { vi } from 'vitest';

import {
  GlobalCommitContext,
  resetGlobalCommitContext,
} from '../../../../../src/element-template/background/commit-context.js';
import {
  hydrate as hydrateBackground,
  hydrateIntoContext,
} from '../../../../../src/element-template/background/hydrate.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../../src/element-template/background/hydration-listener.js';
import '../../../../../src/element-template/native/index.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';
import { root } from '../../../../../src/element-template/index.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../../src/element-template/native/patch-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type { SerializedElementTemplate } from '../../../../../src/element-template/protocol/types.js';
import { __page } from '../../../../../src/element-template/runtime/page/page.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';
import { installMockNativePapi } from '../../../test-utils/mock/mockNativePapi.js';
import { serializeToJSX } from '../../../test-utils/debug/serializer.js';

declare const renderPage: () => void;

declare module '@lynx-js/types' {
  interface IntrinsicElements {
    child: any;
  }
}

interface CaseContext {
  hydrationData: SerializedElementTemplate[];
  onHydrate: (event: { data: unknown }) => void;
}

const envManager = new ElementTemplateEnvManager();

function createTextNode(text: string): BackgroundElementTemplateInstance {
  return new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, [text]);
}

function createHydrationTemplate(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[];
    elementSlots?: SerializedElementTemplate[][];
  } = {},
): SerializedElementTemplate {
  return {
    templateKey,
    attributeSlots: (options.attributeSlots ?? []) as SerializedElementTemplate['attributeSlots'],
    elementSlots: options.elementSlots ?? [],
    uid: handleId,
  };
}

function createHydrationChild(
  handleId: number,
  templateKey: string,
  options: {
    attributeSlots?: unknown[];
    elementSlots?: SerializedElementTemplate[][];
  } = {},
): SerializedElementTemplate {
  return createHydrationTemplate(handleId, templateKey, options);
}

function createHydrationRawTextRoot(handleId: number, text: unknown): SerializedElementTemplate {
  return createHydrationTemplate(handleId, BUILTIN_RAW_TEXT_TEMPLATE_KEY, {
    attributeSlots: [typeof text === 'string' ? text : String(text ?? '')],
    elementSlots: [],
  });
}

function createHydrationRawTextChild(handleId: number, text: unknown): SerializedElementTemplate {
  return createHydrationChild(handleId, BUILTIN_RAW_TEXT_TEMPLATE_KEY, {
    attributeSlots: [typeof text === 'string' ? text : String(text ?? '')],
    elementSlots: [],
  });
}

function setup(): CaseContext {
  vi.clearAllMocks();
  installMockNativePapi({ clearTemplatesOnCleanup: false });
  const hydrationData: SerializedElementTemplate[] = [];
  envManager.resetEnv('background');
  envManager.setUseElementTemplate(true);

  const onHydrate = vi.fn().mockImplementation((event: { data: unknown }) => {
    const data = event.data;
    if (Array.isArray(data)) {
      for (const item of data) {
        hydrationData.push(item as SerializedElementTemplate);
      }
    }
  });
  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

  return { hydrationData, onHydrate };
}

function teardown(context: CaseContext): void {
  // cleanup is automatic
  envManager.switchToBackground();
  lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, context.onHydrate);
  envManager.setUseElementTemplate(false);
  (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
}

function renderAndCollect(App: () => JSX.Element, context: CaseContext) {
  root.render(<App />);
  envManager.switchToMainThread();
  root.render(<App />);
  renderPage();
  envManager.switchToBackground();

  const before = context.hydrationData[0]!;
  const backgroundRoot = __root as BackgroundElementTemplateInstance;
  const after = backgroundRoot.firstChild!;

  return { before, after };
}

type CaseRunner = (context: CaseContext) => unknown;

const cases: Record<string, CaseRunner> = {};

function defineCase(name: string, runner: CaseRunner): void {
  cases[name] = runner;
}

export function runCaseByName(name: string): unknown {
  const runner = cases[name];
  if (!runner) {
    throw new Error(`Unknown background-hydrate case: ${name}`);
  }
  const context = setup();
  try {
    return runner(context);
  } finally {
    teardown(context);
  }
}

{
  defineCase('reports-key-mismatch', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const lynxObj = globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void };
    const oldReportError = lynxObj.reportError;
    const reportErrorSpy = vi.fn();
    lynxObj.reportError = reportErrorSpy;

    const after = new BackgroundElementTemplateInstance('after');
    const before = createHydrationTemplate(-1, 'before');

    const stream = hydrateBackground(before, after);
    const firstError = reportErrorSpy.mock.calls[0]?.[0] as Error | undefined;

    reportErrorSpy.mockClear();
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    lynxObj.reportError = oldReportError;

    return {
      stream,
      errorMessage: firstError?.message ?? null,
      afterInstanceId: after.instanceId,
    };
  });
}

{
  defineCase('updates-raw-text-instance-id', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const after = createTextNode('hi');
    const before = createHydrationRawTextRoot(-11, 'hi');

    const stream = hydrateBackground(before, after);

    return {
      stream,
      afterInstanceId: after.instanceId,
      managerHasAfter: backgroundElementTemplateInstanceManager.get(-11) === after,
    };
  });
}

{
  defineCase('attrs.aligns-ids-and-patches', (context) => {
    function App() {
      const src = __BACKGROUND__ ? 'background.png' : 'main.png';
      return <view {...({ src } as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);

    return {
      stream,
      beforeInstanceId: before.uid,
      afterInstanceId: after.instanceId,
    };
  });
}

{
  defineCase('attrs.removes-missing', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: 'same' }
        : { id: 'same', title: 'main' };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.adds-background-only', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: 'same', title: 'background' }
        : { id: 'same' };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.skips-identical', (context) => {
    function App() {
      const props = { id: 'same' };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.object-value-updates', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: 'same', data: { foo: 'bar' } }
        : { id: 'same', data: { foo: 'baz' } };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.patches-nested-component', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: 'same', info: { key: 'new' } }
        : { id: 'same', info: { key: 'old' } };
      return (
        <view>
          <child {...(props as any)} />
        </view>
      );
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.nullish-values', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: null, title: undefined }
        : { id: 'same', title: 'main' };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.array-diff', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { ids: [1, 2] }
        : { ids: [1] };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.style-object-updates', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { style: { color: 'red', fontSize: 12 } }
        : { style: { color: 'blue', fontSize: 12 } };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.type-diff', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: 123 }
        : { id: '123' };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('attrs.batch-multiple-patches', (context) => {
    function App() {
      const props = __BACKGROUND__
        ? { id: 'same', title: 'bg', index: 1 }
        : { id: 'same', title: 'main', index: 0 };
      return <view {...(props as any)} />;
    }

    const { before, after } = renderAndCollect(App, context);
    const stream = hydrateBackground(before, after);
    return { stream };
  });
}

{
  defineCase('children.missing-slot-record-on-main', (context) => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    const child = new BackgroundElementTemplateInstance('child');
    slot0.appendChild(child);
    rootInstance.appendChild(slot0);

    const before = createHydrationTemplate(-1, 'root');
    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('children.missing-slot-record-on-background', (context) => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const beforeChild = createHydrationChild(-2, 'child');
    const before = createHydrationTemplate(-1, 'root', { elementSlots: [[beforeChild]] });

    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('children.creates-missing-nodes-recursively', (context) => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    rootInstance.appendChild(slot0);

    const existing = new BackgroundElementTemplateInstance('existing');
    slot0.appendChild(existing);

    const card = new BackgroundElementTemplateInstance('card');
    card.setAttribute('attributeSlots', [{ id: 'card' }]);
    const cardSlot = new BackgroundElementTemplateSlot();
    cardSlot.setAttribute('id', 0);
    const text = createTextNode('NEW');
    cardSlot.appendChild(text);
    card.appendChild(cardSlot);
    slot0.insertBefore(card, existing);

    const beforeExisting = createHydrationChild(-2, 'existing');
    const beforeRemoved = createHydrationChild(-3, 'removed');
    const before = createHydrationTemplate(-1, 'root', {
      elementSlots: [[beforeExisting, beforeRemoved]],
    });

    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('children.raw-text-instance-empty-text', (context) => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    rootInstance.appendChild(slot0);
    const rawText = createTextNode('');
    slot0.appendChild(rawText);

    const before = createHydrationTemplate(-1, 'root', {
      elementSlots: [[createHydrationRawTextChild(3, '')]],
    });
    const stream = hydrateBackground(before, rootInstance);

    return {
      stream,
      rawTextInstanceId: rawText.instanceId,
    };
  });
}

{
  defineCase('coverage.raw-text-key-branches', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    rootInstance.appendChild(slot0);

    const rawTextText = createTextNode('bg');
    const rawTextInstance = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY);
    slot0.appendChild(rawTextText);
    slot0.appendChild(rawTextInstance);

    const beforeExistingString = createHydrationRawTextChild(rawTextText.instanceId, 'bg');
    const beforeExistingNonString = createHydrationRawTextChild(rawTextInstance.instanceId, 123);
    const beforeMissingString = createHydrationRawTextChild(-2, 'missing');
    const beforeMissingNonString = createHydrationRawTextChild(-3, 456);

    const before = createHydrationTemplate(rootInstance.instanceId, 'root', {
      elementSlots: [[
        beforeExistingString,
        beforeExistingNonString,
        beforeMissingString,
        beforeMissingNonString,
      ]],
    });

    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('children.iterates-existing-slots', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    rootInstance.appendChild(slot0);
    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 1);
    rootInstance.appendChild(slot1);

    const before = createHydrationTemplate(-1, 'root', { elementSlots: [[], []] });
    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('children.missing-attrs-element', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    rootInstance.appendChild(slot0);

    const before = createHydrationTemplate(-1, 'root', { elementSlots: [[]] });
    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('coverage.move-before-child', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;

    const rootInstance = new BackgroundElementTemplateInstance('root');
    const slot0 = new BackgroundElementTemplateSlot();
    slot0.setAttribute('id', 0);
    rootInstance.appendChild(slot0);

    const childA = new BackgroundElementTemplateInstance('a');
    const childB = new BackgroundElementTemplateInstance('b');
    const childC = new BackgroundElementTemplateInstance('c');
    slot0.appendChild(childB);
    slot0.appendChild(childA);
    slot0.appendChild(childC);

    const beforeChildA = createHydrationChild(childA.instanceId, 'a');
    const beforeChildB = createHydrationChild(childB.instanceId, 'b');
    const beforeChildC = createHydrationChild(childC.instanceId, 'c');
    const before = createHydrationTemplate(rootInstance.instanceId, 'root', {
      elementSlots: [[beforeChildA, beforeChildB, beforeChildC]],
    });

    const stream = hydrateBackground(before, rootInstance);
    return { stream };
  });
}

{
  defineCase('coverage.emit-create-raw-text', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    resetGlobalCommitContext();

    const rawText = createTextNode('raw');
    rawText.emitCreate();
    const ops = [...GlobalCommitContext.ops];
    resetGlobalCommitContext();

    return { ops };
  });
}

{
  defineCase('coverage.emit-create-raw-text-non-text', () => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    resetGlobalCommitContext();

    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY);
    rawText.emitCreate();
    const ops = [...GlobalCommitContext.ops];
    resetGlobalCommitContext();

    return { ops };
  });
}

{
  defineCase('full-flow.dispatches-update-event', (context) => {
    installElementTemplateHydrationListener();

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    envManager.switchToBackground();

    function App() {
      const id = __BACKGROUND__ ? 'bg' : 'main';
      return <view id={id} />;
    }

    renderAndCollect(App, context);

    envManager.switchToMainThread();
    const pageJsx = serializeToJSX(__page);

    resetElementTemplatePatchListener();

    envManager.switchToBackground();
    resetElementTemplateHydrationListener();

    return { pageJsx };
  });
}
