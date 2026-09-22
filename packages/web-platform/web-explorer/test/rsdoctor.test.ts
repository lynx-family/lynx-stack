import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  defineConfig: vi.fn((config) => config),
  pluginWebPlatform: vi.fn((options) => ({
    name: 'web-platform',
    options,
  })),
  RsdoctorRspackPlugin: vi.fn(),
}));

vi.mock('@rsbuild/core', () => ({
  defineConfig: mocks.defineConfig,
}));

vi.mock('@lynx-js/web-platform-rsbuild-plugin', () => ({
  pluginWebPlatform: mocks.pluginWebPlatform,
}));

vi.mock('@rsdoctor/core', () => ({
  RsdoctorRspackPlugin: mocks.RsdoctorRspackPlugin,
}));

const originalRsdoctor = process.env.RSDOCTOR;

async function loadConfig(rsdoctor?: string) {
  vi.resetModules();
  mocks.defineConfig.mockClear();
  mocks.RsdoctorRspackPlugin.mockClear();

  if (rsdoctor === undefined) {
    delete process.env.RSDOCTOR;
  } else {
    process.env.RSDOCTOR = rsdoctor;
  }

  return (await import('../rsbuild.config.js')).default;
}

afterEach(() => {
  if (originalRsdoctor === undefined) {
    delete process.env.RSDOCTOR;
  } else {
    process.env.RSDOCTOR = originalRsdoctor;
  }
});

describe('web explorer Rsdoctor configuration', () => {
  it('does not register Rsdoctor unless explicitly enabled', async () => {
    const config = await loadConfig();

    expect(mocks.RsdoctorRspackPlugin).not.toHaveBeenCalled();
    expect(config.tools.rspack.plugins).toEqual([false]);
  });

  it('registers the Rsdoctor v2 plugin when enabled', async () => {
    const config = await loadConfig('true');

    expect(mocks.RsdoctorRspackPlugin).toHaveBeenCalledOnce();
    expect(config.tools.rspack.plugins).toHaveLength(1);
  });
});
