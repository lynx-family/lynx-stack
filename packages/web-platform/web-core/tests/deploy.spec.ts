import { describe, it, expect, rstest, beforeEach } from '@rstest/core';
import * as vm from 'vm';
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
    rstest.clearAllMocks();
  });

  it('should pass viewAttributes correctly when called with 7 arguments (legacy call)', () => {
    const mockDecodeTemplate = rstest.mocked(decodeModule.decodeTemplate);
    const mockCreateElementAPI = rstest.mocked(
      createElementAPIModule.createElementAPI,
    );

    mockDecodeTemplate.mockReturnValue({
      config: { enableCSSSelector: 'true' },
      lepusCode: {},
      styleInfo: new Uint8Array(),
    } as DecodedTemplate);

    mockCreateElementAPI.mockReturnValue({
      globalThisAPIs: {} as ElementPAPIs,
      wasmContext: { free: rstest.fn() } as unknown as MainThreadServerContext,
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

  it('should free the wasm context, including when the root code throws', () => {
    const mockDecodeTemplate = rstest.mocked(decodeModule.decodeTemplate);
    const mockCreateElementAPI = rstest.mocked(
      createElementAPIModule.createElementAPI,
    );
    const free = rstest.fn();

    mockDecodeTemplate.mockReturnValue({
      config: {},
      lepusCode: { root: new TextEncoder().encode('void 0') },
    } as unknown as DecodedTemplate);
    mockCreateElementAPI.mockReturnValue({
      globalThisAPIs: {} as ElementPAPIs,
      wasmContext: { free } as unknown as MainThreadServerContext,
    });

    executeTemplate(Buffer.from('test'), {}, {}, () => {}, false, false);
    expect(free).toHaveBeenCalledTimes(1);

    rstest.mocked(vm.runInContext).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() =>
      executeTemplate(Buffer.from('test'), {}, {}, () => {}, false, false)
    ).toThrow('boom');
    expect(free).toHaveBeenCalledTimes(2);
  });
});
