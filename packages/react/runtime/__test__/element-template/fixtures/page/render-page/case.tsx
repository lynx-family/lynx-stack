import { root } from '../../../../../src/element-template/index.js';
import { __page } from '../../../../../src/element-template/runtime/page/page.js';
import { resetTemplateId } from '../../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../../src/element-template/runtime/template/registry.js';
import { installMockNativePapi } from '../../../test-utils/mock/mockNativePapi.js';
import { serializeToJSX } from '../../../test-utils/debug/serializer.js';

declare const renderPage: () => void;

export function run() {
  const mockContext = installMockNativePapi({ clearTemplatesOnCleanup: true });
  ElementTemplateRegistry.clear();
  resetTemplateId();
  (globalThis as { __USE_ELEMENT_TEMPLATE__?: boolean }).__USE_ELEMENT_TEMPLATE__ = true;

  try {
    function App() {
      return (
        <view id='main'>
          <text>Hello</text>
        </view>
      );
    }

    root.render(<App />);

    renderPage();

    const actualJSX = serializeToJSX(__page);

    return {
      output: actualJSX,
      files: {
        'native-log.txt': mockContext.nativeLog,
      },
    };
  } finally {
    (globalThis as { __USE_ELEMENT_TEMPLATE__?: boolean }).__USE_ELEMENT_TEMPLATE__ = undefined;
    mockContext.cleanup();
  }
}
