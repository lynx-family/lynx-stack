interface LynxTestModule {
  reloadTemplate: (data: unknown, props: unknown) => void;
}

export function reloadTemplate(): void {
  const modules = NativeModules as unknown as {
    LynxTestModule?: LynxTestModule | undefined;
  };

  modules.LynxTestModule?.reloadTemplate({}, {});
}
