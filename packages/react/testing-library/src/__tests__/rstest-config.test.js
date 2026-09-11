import { describe, expect, it } from 'vitest';

import { isRspeedyProject } from '../rstest-config.js';

const hasLynxConfig = (path) => path.endsWith('lynx.config.ts');
const hasNothing = () => false;

describe('isRspeedyProject', () => {
  it('follows an explicit build tool', () => {
    expect(isRspeedyProject({ buildTool: 'rspeedy' }, hasNothing)).toBe(true);
    expect(isRspeedyProject({ buildTool: 'rsbuild' }, hasLynxConfig)).toBe(false);
  });

  it('reads the build tool out of a default config path', () => {
    expect(isRspeedyProject({ configPath: 'lynx.config.ts' }, hasNothing))
      .toBe(true);
  });

  // A custom path names no build tool, so the project root decides.
  it('falls back to the project root for a custom config path', () => {
    expect(isRspeedyProject({ configPath: 'config/test.ts' }, hasLynxConfig))
      .toBe(true);
    expect(isRspeedyProject({ configPath: 'config/test.ts' }, hasNothing))
      .toBe(false);
  });

  it('detects the project from its config files', () => {
    expect(isRspeedyProject(undefined, hasLynxConfig)).toBe(true);
    expect(isRspeedyProject(undefined, hasNothing)).toBe(false);
  });
});
