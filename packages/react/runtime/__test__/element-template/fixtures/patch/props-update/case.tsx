import { root } from '../../../../../src/element-template/index.js';
import { registerTemplates } from '../../../test-utils/debug/registry.js';
import { runElementTemplateUpdate } from '../../../test-utils/debug/updateRunner.js';

export function run() {
  const EtPropsUpdate = '_et_props_update' as unknown as JSX.ElementType;
  registerTemplates([
    {
      templateId: '_et_props_update',
      compiledTemplate: {
        kind: 'element',
        tag: 'view',
        attributesArray: [
          { kind: 'attribute', binding: 'slot', key: 'id', attrSlotIndex: 0 },
        ],
        children: [],
      },
    },
  ]);

  let label = 'before';

  function App() {
    return <EtPropsUpdate attributeSlots={[label]} />;
  }

  const result = runElementTemplateUpdate({
    render: () => <App />,
    update: () => {
      label = 'after';
      root.render(<App />);
    },
  });

  return {
    files: {
      'before-jsx.txt': result.beforePageJsx,
      'after-jsx.txt': result.afterPageJsx,
      'ops.txt': result.formattedOps,
    },
  };
}
