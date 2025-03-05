import { Options } from 'tsup';
import { fixImportsPlugin } from 'esbuild-fix-imports-plugin';

const options: Options = {
  format: [
    'cjs',
    'esm',
  ],
  clean: true,
  // splitting: true,
  bundle: false,
  dts: false,
  entryPoints: [
    'src/*',
  ],
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: `.${format === 'esm' ? 'mjs' : 'cjs'}`,
    };
  },
  esbuildPlugins: [
    fixImportsPlugin(),
  ],
};

export default options;
