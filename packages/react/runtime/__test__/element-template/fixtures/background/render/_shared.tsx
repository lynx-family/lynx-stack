import { vi } from 'vitest';

import { resetElementTemplateHydrationListener } from '../../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';
import { root } from '../../../../../src/element-template/index.js';
import { resetElementTemplatePatchListener } from '../../../../../src/element-template/native/patch-listener.js';
import { __root, setRoot } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { serializeBackgroundTree } from '../../../test-utils/debug/serializer.js';

type CaseRunner = () => unknown;

const cases: Record<string, CaseRunner> = {};

function defineCase(name: string, runner: CaseRunner): void {
  cases[name] = runner;
}

function setup(): void {
  vi.stubGlobal('__BACKGROUND__', true);
  backgroundElementTemplateInstanceManager.clear();
  backgroundElementTemplateInstanceManager.nextId = 0;
  setRoot(new BackgroundElementTemplateInstance('root'));
}

function teardown(): void {
  resetElementTemplatePatchListener();
  resetElementTemplateHydrationListener();
  vi.unstubAllGlobals();
  (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
}

export function runCaseByName(name: string): unknown {
  const runner = cases[name];
  if (!runner) {
    throw new Error(`Unknown background-render case: ${name}`);
  }
  setup();
  try {
    return runner();
  } finally {
    teardown();
  }
}

defineCase('constructs-shadow-tree', () => {
  function App() {
    return (
      <view id='main'>
        <text>Hello Background</text>
      </view>
    );
  }

  root.render(<App />);

  return {
    isRootInstance: __root instanceof BackgroundElementTemplateInstance,
    tree: serializeBackgroundTree(__root),
  };
});

defineCase('supports-slot-component-materiality', () => {
  function Sub(props: any) {
    return <view>{props.children}</view>;
  }
  function App() {
    return (
      <view>
        <Sub>
          <text>Slot Content 1</text>
        </Sub>
        <Sub>
          <text>Slot Content 2</text>
        </Sub>
      </view>
    );
  }

  root.render(<App />);

  return {
    tree: serializeBackgroundTree(__root),
  };
});
