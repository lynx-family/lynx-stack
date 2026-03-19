/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

export function generateRegister<
  DecoratorArgs extends any[],
  RegistryItem,
  HandlerType,
  RegisterStorageMapName extends string,
>(
  registerName: RegisterStorageMapName,
  convertHandlerToRegistryItem: (
    handler: HandlerType,
    decoratorArgs: DecoratorArgs,
  ) => RegistryItem,
) {
  return function registerHandler(key: string, ...args: DecoratorArgs) {
    return function<T>(
      this: T,
      target: HandlerType | undefined,
      context: ClassMemberDecoratorContext | ClassFieldDecoratorContext<T>,
    ) {
      if (context.kind === 'method') {
        (
          context as ClassMethodDecoratorContext<
            Record<RegisterStorageMapName, Record<string, RegistryItem>>
          >
        ).addInitializer(function() {
          this[registerName] ??= {};
          (this[registerName] as Record<string, RegistryItem>)[key] =
            convertHandlerToRegistryItem(target!, args);
        });
      } else if (context.kind === 'field') {
        return function(this: any, value: HandlerType) {
          this[registerName] ??= {};
          this[registerName][key] = convertHandlerToRegistryItem(value, args);
          return value;
        } as any;
      } else {
        throw new Error(
          `[lynx-web-components] decorator type ${context.kind} is not supported`,
        );
      }
    };
  };
}
