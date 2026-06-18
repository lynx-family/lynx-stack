import { describe, it, expect, rstest as vi, beforeEach } from '@rstest/core';
import { rstest } from '@rstest/core';
import { executeTemplate } from '../ts/server/deploy.js';
import * as decodeModule from '../ts/server/decode.js';
import type { DecodedTemplate } from '../ts/server/decode.js';
import * as createElementAPIModule from '../ts/server/elementAPIs/createElementAPI.js';
import type { MainThreadServerContext } from '../ts/server/wasm.js';
import type { ElementPAPIs } from '../ts/types/index.js';

rstest.mock('../ts/server/decode.js', () => ({
  decodeTemplate: rstest.fn(),
}));

rstest.mock('../ts/server/elementAPIs/createElementAPI.js', () => ({
  createElementAPI: rstest.fn(),
}));

rstest.mock('vm', () => ({
  createContext: rstest.fn(),
  runInContext: rstest.fn(),
}));

describe('executeTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass viewAttributes correctly when called with 7 arguments (legacy call)', () => {
    const mockDecodeTemplate = vi.mocked(decodeModule.decodeTemplate);
    const mockCreateElementAPI = vi.mocked(
      createElementAPIModule.createElementAPI,
    );

    mockDecodeTemplate.mockReturnValue({
      config: { enableCSSSelector: 'true' },
      lepusCode: {},
      styleInfo: new Uint8Array(),
    } as DecodedTemplate);

    mockCreateElementAPI.mockReturnValue({
      globalThisAPIs: {} as ElementPAPIs,
      wasmContext: {} as MainThreadServerContext,
    });

    const dummyBuffer = Buffer.from('test');

    executeTemplate(
      dummyBuffer,
      {},
      {},
      () => {},
      true, // transformVW
      true, // transformVH
      'my-view-attr="123"', // viewAttributes
    );

    expect(mockCreateElementAPI).toHaveBeenCalled();
    // 3rd arg is viewAttributes
    expect(mockCreateElementAPI.mock.calls[0][2]).toBe('my-view-attr="123"');
  });
});
