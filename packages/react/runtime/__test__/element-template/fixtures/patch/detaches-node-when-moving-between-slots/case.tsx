import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import { root } from '../../../../../src/element-template/index.js';
import { __page } from '../../../../../src/element-template/runtime/page/page.js';
import { applyElementTemplateUpdateCommands } from '../../../../../src/element-template/runtime/patch.js';
import { ElementTemplateRegistry } from '../../../../../src/element-template/runtime/template/registry.js';
import { registerTemplates } from '../../../test-utils/debug/registry.js';
import { serializeToJSX } from '../../../test-utils/debug/serializer.js';
import { setupPatchContext, teardownPatchContext } from '../_shared.js';

declare const renderPage: () => void;

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '__et_builtin_raw_text__',
    null,
    [text],
    [],
  ] as const;
}

export function run() {
  const context = setupPatchContext();
  try {
    const jsx = <view />;
    root.render(jsx);
    context.envManager.switchToMainThread();
    root.render(jsx);
    renderPage();

    registerTemplates([
      {
        templateId: '_et_test_detach',
        compiledTemplate: {
          kind: 'element',
          tag: 'view',
          children: [
            { kind: 'elementSlot', tag: 'slot', elementSlotIndex: 0 },
            { kind: 'elementSlot', tag: 'slot', elementSlotIndex: 1 },
          ],
        },
      },
    ]);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      20,
      '_et_test_detach',
      null,
      [],
      [],
    ]);
    const page = __page as unknown as { children?: unknown[] };
    page.children ??= [];
    page.children.push(ElementTemplateRegistry.get(20)!);

    applyElementTemplateUpdateCommands([
      ...createRawTextOps(10, 'A'),
      ...createRawTextOps(11, 'B'),
    ]);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      20,
      0,
      10,
      0,
      ElementTemplateUpdateOps.insertNode,
      20,
      0,
      11,
      0,
    ]);

    const beforeMove = serializeToJSX(__page);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      20,
      1,
      10,
      0,
    ]);

    const afterMove = serializeToJSX(__page);

    return {
      files: {
        'before-jsx.txt': beforeMove,
        'after-jsx.txt': afterMove,
      },
    };
  } finally {
    teardownPatchContext(context);
  }
}
