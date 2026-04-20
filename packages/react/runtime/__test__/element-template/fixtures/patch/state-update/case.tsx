import { useState } from '@lynx-js/react';
import { options } from 'preact';

import { root } from '../../../../../src/element-template/index.js';
import { registerTemplates } from '../../../test-utils/debug/registry.js';
import { runElementTemplateUpdate } from '../../../test-utils/debug/updateRunner.js';

export async function run() {
  // Capture scheduled renders so we can flush them while still on background thread.
  const scheduledRenders: Array<() => void> = [];
  const previousDebounce = options.debounceRendering;
  options.debounceRendering = (cb) => {
    scheduledRenders.push(cb);
  };

  try {
    let triggerUpdate: (() => void) | undefined;
    const EtStateUpdate = '_et_state_update' as unknown as JSX.ElementType;
    registerTemplates([
      {
        templateId: '_et_state_update',
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

    function App() {
      const [label, setLabel] = useState('before');

      if (__BACKGROUND__) {
        triggerUpdate = () => setLabel('after');
      }

      return <EtStateUpdate attributeSlots={[label]} />;
    }

    const result = runElementTemplateUpdate({
      render: () => <App />,
      update: () => {
        triggerUpdate!();
        while (scheduledRenders.length > 0) {
          const flush = scheduledRenders.shift();
          flush?.();
        }
      },
    });

    return {
      files: {
        'before-jsx.txt': result.beforePageJsx,
        'after-jsx.txt': result.afterPageJsx,
        'ops.txt': result.formattedOps,
      },
    };
  } finally {
    options.debounceRendering = previousDebounce;
  }
}
