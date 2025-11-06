import type { ViteUserConfig } from 'vitest/config.js';

export interface CreateVitestConfigOptions {
  /**
   * The package name of the ReactLynx runtime package.
   *
   * @defaultValue `@lynx-js/react`
   */
  runtimePkgName?: string;
  /**
   * Enable React Compiler for this build.
   *
   * @link https://react.dev/learn/react-compiler
   *
   * @defaultValue false
   */
  experimental_enableReactCompiler?: boolean;
}

export function createVitestConfig(options?: CreateVitestConfigOptions): Promise<ViteUserConfig>;
