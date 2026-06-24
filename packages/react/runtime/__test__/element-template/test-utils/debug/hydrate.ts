import {
  globalCommitContext,
  resetGlobalCommitContext,
} from '../../../../src/element-template/background/commit-context.js';
import { hydrateRootChildrenIntoContext } from '../../../../src/element-template/background/hydrate.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import type {
  ElementTemplateUpdateCommandStream,
  SerializedEtNode,
} from '../../../../src/element-template/protocol/types.js';

export function hydrateBackground(
  serialized: SerializedEtNode,
  instance: BackgroundElementTemplateInstance,
): ElementTemplateUpdateCommandStream {
  const root = { childNodes: [instance] } as unknown as BackgroundElementTemplateInstance;

  resetGlobalCommitContext();
  if (!hydrateRootChildrenIntoContext([serialized], root)) {
    resetGlobalCommitContext();
  }
  return globalCommitContext.ops;
}
