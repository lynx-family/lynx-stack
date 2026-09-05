import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

describe('ElementTemplate page root helpers', () => {
  beforeEach(() => {
    rs.resetModules();
    rs.stubGlobal('__CreateTypedElementTemplate', rs.fn());
  });

  afterEach(() => {
    rs.unstubAllGlobals();
  });

  it('creates and installs the typed page root', async () => {
    const page = { type: 'page' } as unknown as ElementRef;
    rs.mocked(__CreateTypedElementTemplate).mockReturnValue(page);

    const pageModule = await import('../../../../src/element-template/runtime/page/page.js');

    expect(pageModule.createElementTemplatePage()).toBe(page);
    expect(__CreateTypedElementTemplate).toHaveBeenCalledWith('page', null, null, '0', null);

    pageModule.setupPage(page);
    expect(pageModule.__page).toBe(page);
  });
});
