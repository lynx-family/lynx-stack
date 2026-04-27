import { createElement } from 'preact';

import { root } from '../../../../src/element-template/index.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { ElementTemplateEnvManager } from './envManager.js';
import type { CompiledFixtureModuleExports } from './compiledFixtureModule.js';

declare const renderPage: () => void;

function resolveThreadProps(
  moduleExports: CompiledFixtureModuleExports,
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
  moduleExports: CompiledFixtureModuleExports,
  props: Record<string, unknown>,
) {
  return createElement(moduleExports.App, props);
}

export function renderCompiledFixtureOnMainThread(
  moduleExports: CompiledFixtureModuleExports,
  envManager: ElementTemplateEnvManager,
  props?: Record<string, unknown>,
): void {
  envManager.switchToMainThread();
  const resolvedProps = resolveThreadProps(moduleExports, 'main', props);
  const vnode = createAppVNode(moduleExports, resolvedProps);
  root.render(vnode);
  renderPage();
  root.render(vnode);
  envManager.switchToBackground();
}

export function renderCompiledFixtureOnBackground(
  moduleExports: CompiledFixtureModuleExports,
  envManager: ElementTemplateEnvManager,
  props?: Record<string, unknown>,
): BackgroundElementTemplateInstance | null {
  envManager.switchToBackground();
  const resolvedProps = resolveThreadProps(moduleExports, 'background', props);
  root.render(createAppVNode(moduleExports, resolvedProps));
  const backgroundRoot = __root as BackgroundElementTemplateInstance;
  return backgroundRoot.firstChild;
}
