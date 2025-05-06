import type { LoaderContext } from 'webpack';

interface NativeModulesLoaderOptions {
  nativeModulesPath: string;
}

export default function(
  this: LoaderContext<NativeModulesLoaderOptions>,
  source: string,
) {
  const options = this.getOptions();
  const { nativeModulesPath } = options;
  const modifiedSource = source.replace(
    /\/\* LYNX_NATIVE_MODULES_IMPORT \*\//g,
    `import CUSTOM_NATIVE_MODULES from '${nativeModulesPath}';`,
  ).replace(
    /\/\* LYNX_NATIVE_MODULES_ADD \*\//g,
    `Object.entries(CUSTOM_NATIVE_MODULES).map(([moduleName, moduleFunc]) => {
    customNativeModules[moduleName] = moduleFunc(
      nativeModules,
      (name, data) =>
        nativeModulesCall(name, data, moduleName),
    );
  });`,
  );

  return modifiedSource;
}
