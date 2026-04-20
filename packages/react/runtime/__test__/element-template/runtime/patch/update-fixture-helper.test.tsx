import { describe, expect, it } from 'vitest';

import { root } from '../../../../src/element-template/index.js';
import { registerTemplates } from '../../test-utils/debug/registry.js';
import { runElementTemplateUpdate } from '../../test-utils/debug/updateRunner.js';

describe('patch update fixture helper', () => {
  it('collects update ops for a props update', () => {
    const EtUpdateView = '_et_update_fixture_helper' as unknown as JSX.ElementType;
    registerTemplates([
      {
        templateId: '_et_update_fixture_helper',
        compiledTemplate: {
          kind: 'element',
          type: 'view',
          attributesArray: [
            { kind: 'attribute', binding: 'slot', key: 'id', attrSlotIndex: 0 },
          ],
          children: [],
        },
      },
    ]);

    let label = 'before';
    function App() {
      return <EtUpdateView attributeSlots={[label]} />;
    }

    const result = runElementTemplateUpdate({
      render: () => <App />,
      update: () => {
        label = 'after';
        root.render(<App />);
      },
    });

    expect(Array.isArray(result.formattedOps)).toBe(true);
    expect(result.backgroundJsx).toContain('_et_update_fixture_helper');
  });
});
