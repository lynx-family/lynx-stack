import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetElementTemplateCommitState } from '../../../../src/element-template/background/commit-hook.js';
import { globalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundPageRootInstance,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { installElementTemplateRenderScopeHooks } from '../../../../src/element-template/background/render-scope.js';
import { callDestroyLifetimeFun } from '../../../../src/element-template/native/callDestroyLifetimeFun.js';
import { root, useState } from '../../../../src/element-template/index.js';
import { clearRefState, flushPendingRefs } from '../../../../src/element-template/prop-adapters/ref.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { __ElementTemplatePage } from '../../../../src/element-template/runtime/page/authored-page.js';
import {
  __etAttrPlanMap,
  adaptRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

function waitSchedule(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve);
    });
  });
}

describe('ElementTemplate root render timing', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    clearEtAttrPlanMap();
    clearRefState();
    resetElementTemplateCommitState();
    envManager.resetEnv('background');
  });

  it('does not eagerly render on main thread and only caches jsx on root', () => {
    envManager.switchToMainThread();
    const oldJsx = (__root as { __jsx?: unknown }).__jsx;

    root.render(<view id='main-thread' />);

    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::renderBackground');
    expect(lynx.performance.profileEnd).not.toHaveBeenCalled();
    expect((__root as { __jsx?: unknown }).__jsx ?? oldJsx).toBeDefined();
  });

  it('wraps background render with profile timing', () => {
    root.render(<view />);

    const { performance } = lynx;
    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::renderBackground');
    expect(performance.profileEnd).toHaveBeenCalled();
  });

  it('keeps render scope hook installation idempotent', () => {
    expect(() => {
      installElementTemplateRenderScopeHooks();
      installElementTemplateRenderScopeHooks();
    }).not.toThrow();
  });

  it('does not emit a page attr update for an initial page without attrs', () => {
    root.render(
      <__ElementTemplatePage $0={<view />} />,
    );

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toBeNull();
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:1')).toBeUndefined();
    expect((__root as BackgroundPageRootInstance).getRawAttributeSlot(1)).toBeUndefined();
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('keeps the keyed replacement attrs when the old helper cleanup runs', async () => {
    let replacePage: (() => void) | undefined;
    function App() {
      const [pageId, setPageId] = useState('first');
      replacePage = () => setPageId('second');
      return <__ElementTemplatePage key={pageId} attributes={{ id: pageId }} $0={<view />} />;
    }

    root.render(<App />);
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toEqual({
      id: 'first',
    });

    await waitSchedule();
    replacePage?.();
    await waitSchedule();

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toEqual({
      id: 'second',
    });
  });

  it('updates authored page attrs through real background renders', async () => {
    let setPageId: ((value: string) => void) | undefined;

    function App() {
      const [pageId, setId] = useState('first');
      setPageId = setId;
      return <__ElementTemplatePage attributes={{ id: pageId }} $0={<view />} />;
    }

    root.render(<App />);
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toEqual({
      id: 'first',
    });

    setPageId?.('second');
    await waitSchedule();

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toEqual({
      id: 'second',
    });
  });

  it('preserves authored page attrs through descendant-only updates', async () => {
    let updateChild: (() => void) | undefined;

    function Child() {
      const [count, setCount] = useState(0);
      updateChild = () => setCount(value => value + 1);
      return <view data-count={count} />;
    }

    function App() {
      return <__ElementTemplatePage attributes={{ id: 'stable' }} $0={<Child />} />;
    }

    root.render(<App />);
    const pageAttributes = backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0');

    updateChild?.();
    await waitSchedule();

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toBe(pageAttributes);
  });

  it('clears authored page attrs after the page is removed', async () => {
    let hidePage: (() => void) | undefined;

    function App() {
      const [withPage, setWithPage] = useState(true);
      hidePage = () => setWithPage(false);
      return withPage
        ? <__ElementTemplatePage attributes={{ id: 'temporary' }} $0={<view />} />
        : <view />;
    }

    root.render(<App />);
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toEqual({
      id: 'temporary',
    });

    await waitSchedule();
    hidePage?.();
    await waitSchedule();

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toBeNull();
  });

  it('clears authored page state on background destroy', async () => {
    root.render(
      <__ElementTemplatePage attributes={{ id: 'destroyed' }} $0={<view />} />,
    );
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toEqual({
      id: 'destroyed',
    });

    await waitSchedule();
    callDestroyLifetimeFun();

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0')).toBeNull();
  });

  it('cleans direct refs through root unmount on background destroy', () => {
    const ref = { current: null };

    root.render(<view />);
    const instance = (__root as BackgroundElementTemplateInstance).firstChild;
    expect(instance).toBeInstanceOf(BackgroundElementTemplateInstance);
    __etAttrPlanMap[instance!.type] = [0, adaptRefAttrSlot];
    instance?.setAttribute('attributeSlots', [ref]);
    expect(instance?.attributeSlots).toEqual([`${instance?.instanceId}-0`]);
    flushPendingRefs();
    expect(ref.current).toMatchObject({ selector: expect.stringMatching(/^\[ref=\d+-0\]$/) });

    callDestroyLifetimeFun();

    expect(ref.current).toBeNull();
  });
});
