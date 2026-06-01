import { createElement } from 'preact';

import { root } from '../../../../src/element-template/index.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { ElementTemplateEnvManager } from './envManager.js';
import type { CompiledFixtureModuleExports } from './compiledFixtureModule.js';

declare const renderPage: () => void;

interface RenderableCompiledFixture<TProps extends object> {
  App: (props: TProps) => JSX.Element;
  mainProps?: TProps;
  backgroundProps?: TProps;
}

function resolveThreadProps(
  moduleExports: RenderableCompiledFixture<Record<string, unknown>> | CompiledFixtureModuleExports,
  thread: 'main' | 'background',
  overrideProps?: Record<string, unknown>,
): Record<string, unknown> {
  if (overrideProps) {
    return overrideProps;
  }

  return thread === 'main'
    ? (moduleExports.mainProps ?? {})
    : (moduleExports.backgroundProps ?? {});
}

function createAppVNode(
  moduleExports: RenderableCompiledFixture<Record<string, unknown>> | CompiledFixtureModuleExports,
  props: Record<string, unknown>,
) {
  return createElement(moduleExports.App as (props: Record<string, unknown>) => JSX.Element, props);
}

export function renderCompiledFixtureOnMainThread<TProps extends object = Record<string, unknown>>(
  moduleExports: RenderableCompiledFixture<TProps> | CompiledFixtureModuleExports,
  envManager: ElementTemplateEnvManager,
  props?: TProps,
): void {
  envManager.switchToMainThread();
  const resolvedProps = resolveThreadProps(
    moduleExports,
    'main',
    props as Record<string, unknown> | undefined,
  );
  const vnode = createAppVNode(moduleExports, resolvedProps);
  root.render(vnode);
  renderPage();
  root.render(vnode);
  envManager.switchToBackground();
}

export function renderCompiledFixtureOnBackground<TProps extends object = Record<string, unknown>>(
  moduleExports: RenderableCompiledFixture<TProps> | CompiledFixtureModuleExports,
  envManager: ElementTemplateEnvManager,
  props?: TProps,
): BackgroundElementTemplateInstance | null {
  envManager.switchToBackground();
  const resolvedProps = resolveThreadProps(
    moduleExports,
    'background',
    props as Record<string, unknown> | undefined,
  );
  root.render(createAppVNode(moduleExports, resolvedProps));
  const backgroundRoot = __root as BackgroundElementTemplateInstance;
  return backgroundRoot.firstChild;
}
