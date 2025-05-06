import type { LoaderContext } from 'webpack';

interface NativeModulesLoaderOptions {
  napiModulesPath: string;
}

export default function(
  this: LoaderContext<NativeModulesLoaderOptions>,
  source: string,
) {
  const options = this.getOptions();
  const { napiModulesPath } = options;
  const modifiedSource = source.replace(
    /\/\* LYNX_NAPI_MODULES_IMPORT \*\//g,
    `import CUSTOM_NAPI_MODULES from '${napiModulesPath}';`,
  ).replace(
    /\/\* LYNX_NAPI_MODULES_ADD \*\//g,
    `console.log('CUSTOM_NAPI_MODULES', CUSTOM_NAPI_MODULES);
Object.entries(CUSTOM_NAPI_MODULES).map(([moduleName, moduleFunc]) => {
  napiModules[moduleName] = moduleFunc(
    napiModules,
    (name, data) => napiModulesCall(name, data, moduleName),
    (func) => {
      rpc.registerHandler(dispatchNapiModuleEndpoint, (data) => func(data));
    },
  );
});`,
  );

  return modifiedSource;
}
