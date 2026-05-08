// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

export type ExtensionType = 'native-module' | 'element' | 'service';

export interface CreateLynxExtensionOptions {
  dir: string;
  types: ExtensionType[];
  packageName?: string;
  androidPackage?: string;
  moduleName?: string;
  elementName?: string;
  serviceName?: string;
}

export interface CreatedFile {
  path: string;
  content: string;
}

interface TemplateContext {
  packageName: string;
  androidPackage: string;
  androidPackagePath: string;
  moduleName: string;
  elementName: string;
  elementClassName: string;
  serviceName: string;
  serviceProtocolName: string;
  types: Set<ExtensionType>;
}

export const EXTENSION_TYPES: readonly ExtensionType[] = [
  'native-module',
  'element',
  'service',
] as const;

/**
 * Creates a Native Autolink extension scaffold on disk.
 */
export function createLynxExtension(
  options: CreateLynxExtensionOptions,
): CreatedFile[] {
  const targetDir = path.resolve(options.dir);

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }

  const types = new Set(options.types);

  if (types.size === 0) {
    throw new Error('At least one extension type must be selected');
  }

  for (const type of types) {
    if (!isExtensionType(type)) {
      throw new Error(`Unsupported extension type: ${String(type)}`);
    }
  }

  const context = createContext(options, types);
  const files = createFiles(context);

  for (const file of files) {
    const absolutePath = resolveInside(targetDir, file.path);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.content);
  }

  return files;
}

/**
 * Parses a comma-separated extension type list from CLI input.
 */
export function parseExtensionTypes(source: string): ExtensionType[] {
  const types = source.split(',').map((type) => type.trim()).filter(Boolean);

  if (types.length === 0) {
    return [];
  }

  return types.map((type) => {
    if (!isExtensionType(type)) {
      throw new Error(
        `Unsupported extension type "${type}". Expected one of: ${
          EXTENSION_TYPES.join(
            ', ',
          )
        }`,
      );
    }

    return type;
  });
}

/**
 * Derives template names and platform identifiers from scaffold options.
 */
function createContext(
  options: CreateLynxExtensionOptions,
  types: Set<ExtensionType>,
): TemplateContext {
  const directoryName = path.basename(path.resolve(options.dir));
  const packageName = options.packageName
    ?? normalizePackageName(directoryName);
  const baseName = packageName.split('/').at(-1) ?? packageName;
  const prefix = toPascalCase(baseName);
  const moduleName = options.moduleName ?? `${prefix}Module`;
  const elementName = options.elementName ?? `x-${toKebabCase(prefix)}`;
  const serviceName = options.serviceName ?? `${prefix}Service`;
  const elementPrefix = toPascalCase(elementName.replace(/^x-/, ''));
  const androidPackage = options.androidPackage
    ?? `com.example.${toJavaPackageSegment(prefix)}`;

  return {
    packageName,
    androidPackage,
    androidPackagePath: androidPackage.replaceAll('.', '/'),
    moduleName,
    elementName,
    elementClassName: `${elementPrefix}Element`,
    serviceName,
    serviceProtocolName: `${serviceName}Protocol`,
    types,
  };
}

/**
 * Creates the complete in-memory file list for the selected extension types.
 */
function createFiles(context: TemplateContext): CreatedFile[] {
  const files: CreatedFile[] = [
    { path: 'package.json', content: packageJson(context) },
    { path: 'lynx.ext.json', content: manifestJson(context) },
    { path: 'README.md', content: readme(context) },
    { path: 'tsconfig.json', content: tsconfigJson() },
    { path: 'src/index.ts', content: sourceIndex(context) },
    { path: 'types/index.d.ts', content: typesDeclaration(context) },
    { path: 'android/build.gradle.kts', content: androidBuildGradle(context) },
    {
      path: 'android/src/main/AndroidManifest.xml',
      content: androidManifest(),
    },
    { path: 'ios/build.podspec', content: iosPodspec(context) },
    { path: 'example/package.json', content: examplePackageJson(context) },
    { path: 'example/lynx.config.ts', content: exampleLynxConfig() },
    { path: 'example/src/index.tsx', content: exampleEntry() },
    { path: 'example/src/App.tsx', content: exampleApp(context) },
  ];

  if (context.types.has('native-module')) {
    files.push(
      {
        path:
          `android/src/main/java/${context.androidPackagePath}/${context.moduleName}.java`,
        content: androidNativeModule(context),
      },
      {
        path: `ios/src/${context.moduleName}.h`,
        content: iosNativeModuleHeader(context),
      },
      {
        path: `ios/src/${context.moduleName}.m`,
        content: iosNativeModuleImplementation(context),
      },
    );
  }

  if (context.types.has('element')) {
    files.push(
      {
        path:
          `android/src/main/java/${context.androidPackagePath}/${context.elementClassName}.java`,
        content: androidElement(context),
      },
      {
        path: `ios/src/${context.elementClassName}.h`,
        content: iosElementHeader(context),
      },
      {
        path: `ios/src/${context.elementClassName}.m`,
        content: iosElementImplementation(context),
      },
    );
  }

  if (context.types.has('service')) {
    files.push(
      {
        path:
          `android/src/main/java/${context.androidPackagePath}/${context.serviceName}.java`,
        content: androidService(context),
      },
      {
        path: `ios/src/${context.serviceName}.h`,
        content: iosServiceHeader(context),
      },
      {
        path: `ios/src/${context.serviceName}.m`,
        content: iosServiceImplementation(context),
      },
    );
  }

  return files;
}

/**
 * Resolves a generated path and rejects paths that escape the scaffold target directory.
 */
function resolveInside(targetDir: string, filePath: string): string {
  const resolvedTargetDir = path.resolve(targetDir);
  const absolutePath = path.resolve(resolvedTargetDir, filePath);
  const relativePath = path.relative(resolvedTargetDir, absolutePath);

  if (
    relativePath === '..' || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`Generated path escapes target directory: ${filePath}`);
  }

  return absolutePath;
}

/**
 * Generates the extension package manifest.
 */
function packageJson(context: TemplateContext): string {
  return json({
    name: context.packageName,
    version: '0.0.1',
    description: 'A Native Autolink Lynx extension',
    license: 'Apache-2.0',
    type: 'module',
    main: './src/index.ts',
    types: './types/index.d.ts',
    files: [
      'android',
      'generated',
      'ios',
      'src',
      'types',
      'lynx.ext.json',
      'README.md',
    ],
    scripts: {
      codegen: 'lynx-autolink-codegen',
    },
    devDependencies: {
      '@lynx-js/autolink-codegen': '^0.0.0',
    },
  });
}

/**
 * Generates the Native Autolink manifest.
 */
function manifestJson(context: TemplateContext): string {
  return json({
    platforms: {
      android: {
        packageName: context.androidPackage,
        sourceDir: 'android',
      },
      ios: {
        sourceDir: 'ios',
        podspecPath: 'ios/build.podspec',
      },
    },
  });
}

/**
 * Generates the scaffold README.
 */
function readme(context: TemplateContext): string {
  return `# ${context.packageName}

Native Autolink Lynx extension.

## Development

\`\`\`bash
npm install
npm run codegen
\`\`\`

The generated native specs are written to \`generated/\`, \`android/\`, and
\`ios/\`. The package is discovered by Lynx Autolink through \`lynx.ext.json\`.
`;
}

/**
 * Generates the TypeScript configuration for a scaffolded extension.
 */
function tsconfigJson(): string {
  return json({
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      module: 'ESNext',
      moduleResolution: 'Bundler',
      outDir: 'dist',
      strict: true,
      target: 'ES2022',
    },
    include: ['src', 'types', 'generated'],
  });
}

/**
 * Generates the package entry point.
 */
function sourceIndex(context: TemplateContext): string {
  if (!context.types.has('native-module')) {
    return `// Native Autolink package entry.
`;
  }

  return `export { ${context.moduleName} } from '../generated/${context.moduleName}';
`;
}

/**
 * Generates the initial native module type declarations.
 */
function typesDeclaration(context: TemplateContext): string {
  if (!context.types.has('native-module')) {
    return `// Add native module declarations here and run npm run codegen.
`;
  }

  return `/** @lynxmodule */
export declare class ${context.moduleName} {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
  clear(): void;
}
`;
}

/**
 * Generates the Android library Gradle build file.
 */
function androidBuildGradle(context: TemplateContext): string {
  return `plugins {
  id("com.android.library")
}

android {
  namespace = "${context.androidPackage}"
  compileSdk = 35

  defaultConfig {
    minSdk = 23
  }
}

dependencies {
  implementation("org.lynxsdk.lynx:lynx:0.0.1-alpha.1")
  implementation("org.lynxsdk.lynx:service-api:0.0.1-alpha.1")
  annotationProcessor("org.lynxsdk.lynx:lynx-processor:0.0.1-alpha.1")
}
`;
}

/**
 * Generates the Android library manifest.
 */
function androidManifest(): string {
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application />
</manifest>
`;
}

/**
 * Generates the Android native module example implementation.
 */
function androidNativeModule(context: TemplateContext): string {
  return `package ${context.androidPackage};

import androidx.annotation.Nullable;
import com.lynx.tasm.behavior.LynxContext;
import com.lynx.tasm.behavior.LynxMethod;
import com.lynx.tasm.behavior.annotation.LynxAutolinkNativeModule;
import ${context.androidPackage}.generated.${context.moduleName}Spec;

@LynxAutolinkNativeModule(name = "${context.moduleName}")
public class ${context.moduleName} extends ${context.moduleName}Spec {
  public ${context.moduleName}(LynxContext context) {
    super(context);
  }

  @Override
  @LynxMethod
  public void setValue(String key, String value) {
  }

  @Override
  @LynxMethod
  @Nullable
  public String getValue(String key) {
    return null;
  }

  @Override
  @LynxMethod
  public void clear() {
  }
}
`;
}

/**
 * Generates the Android element example implementation.
 */
function androidElement(context: TemplateContext): string {
  return `package ${context.androidPackage};

import android.content.Context;
import android.widget.TextView;
import com.lynx.tasm.behavior.LynxContext;
import com.lynx.tasm.behavior.ui.LynxUI;
import com.lynx.tasm.behavior.annotation.LynxAutolinkElement;

@LynxAutolinkElement(name = "${context.elementName}")
public class ${context.elementClassName} extends LynxUI<TextView> {
  public ${context.elementClassName}(LynxContext context) {
    super(context);
  }

  @Override
  protected TextView createView(Context context) {
    TextView view = new TextView(context);
    view.setText("${context.elementName}");
    return view;
  }
}
`;
}

/**
 * Generates the Android service example implementation.
 */
function androidService(context: TemplateContext): string {
  return `package ${context.androidPackage};

import com.lynx.tasm.service.LynxService;
import com.lynx.tasm.service.annotation.LynxAutolinkService;

@LynxAutolinkService
public class ${context.serviceName} implements LynxService {
  public String name() {
    return "${context.serviceName}";
  }
}
`;
}

/**
 * Generates the iOS CocoaPods podspec.
 */
function iosPodspec(context: TemplateContext): string {
  return `Pod::Spec.new do |s|
  s.name = '${podspecName(context.packageName)}'
  s.version = '0.0.1'
  s.summary = 'Native Autolink Lynx extension'
  s.license = { :type => 'Apache-2.0' }
  s.author = 'Lynx'
  s.source = { :path => '..' }
  s.source_files = 'src/**/*.{h,m,mm}'
  s.dependency 'Lynx'
end
`;
}

/**
 * Generates the iOS native module header.
 */
function iosNativeModuleHeader(context: TemplateContext): string {
  return `#import <Foundation/Foundation.h>
#import <Lynx/LynxModule.h>
#import "generated/${context.moduleName}Spec.h"

NS_ASSUME_NONNULL_BEGIN

@LynxAutolinkNativeModule("${context.moduleName}")
@interface ${context.moduleName} : NSObject <${context.moduleName}Spec>

@end

NS_ASSUME_NONNULL_END
`;
}

/**
 * Generates the iOS native module implementation.
 */
function iosNativeModuleImplementation(context: TemplateContext): string {
  return `#import "${context.moduleName}.h"

@implementation ${context.moduleName}

- (void)setValue:(NSString *)key value:(NSString *)value {
}

- (nullable NSString *)getValue:(NSString *)key {
  return nil;
}

- (void)clear {
}

@end
`;
}

/**
 * Generates the iOS element header.
 */
function iosElementHeader(context: TemplateContext): string {
  return `#import <UIKit/UIKit.h>
#import <Lynx/LynxUI.h>

NS_ASSUME_NONNULL_BEGIN

@LynxAutolinkUI("${context.elementName}")
@interface ${context.elementClassName} : LynxUI<UILabel *>

@end

NS_ASSUME_NONNULL_END
`;
}

/**
 * Generates the iOS element implementation.
 */
function iosElementImplementation(context: TemplateContext): string {
  return `#import "${context.elementClassName}.h"

@implementation ${context.elementClassName}

- (UILabel *)createView {
  UILabel *label = [[UILabel alloc] init];
  label.text = @"${context.elementName}";
  return label;
}

@end
`;
}

/**
 * Generates the iOS service header.
 */
function iosServiceHeader(context: TemplateContext): string {
  return `#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@protocol ${context.serviceProtocolName} <NSObject>

- (NSString *)name;

@end

@LynxAutolinkService(${context.serviceName}, ${context.serviceProtocolName})
@interface ${context.serviceName} : NSObject <${context.serviceProtocolName}>

@end

NS_ASSUME_NONNULL_END
`;
}

/**
 * Generates the iOS service implementation.
 */
function iosServiceImplementation(context: TemplateContext): string {
  return `#import "${context.serviceName}.h"

@implementation ${context.serviceName}

- (NSString *)name {
  return @"${context.serviceName}";
}

@end
`;
}

/**
 * Generates the example app package manifest.
 */
function examplePackageJson(context: TemplateContext): string {
  return json({
    name: `${context.packageName}-example`,
    private: true,
    type: 'module',
    dependencies: {
      [context.packageName]: 'file:..',
      '@lynx-js/react': '^0.111.0',
      '@lynx-js/react-rsbuild-plugin': '^0.11.0',
      '@lynx-js/rspeedy': '^0.11.0',
    },
    devDependencies: {
      typescript: '^5.9.3',
    },
    scripts: {
      dev: 'rspeedy dev',
      build: 'rspeedy build',
    },
  });
}

/**
 * Generates the example app Lynx config.
 */
function exampleLynxConfig(): string {
  return `import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [pluginReactLynx()],
});
`;
}

/**
 * Generates the example app entry point.
 */
function exampleEntry(): string {
  return `import { root } from '@lynx-js/react';

import { App } from './App.js';

root.render(<App />);
`;
}

/**
 * Generates the example app component for the selected extension types.
 */
function exampleApp(context: TemplateContext): string {
  const moduleButton = context.types.has('native-module')
    ? `<text bindtap={() => ${context.moduleName}.setValue('key', 'value')}>
        Native module
      </text>`
    : '';
  const element = context.types.has('element')
    ? `<${context.elementName} />`
    : '';
  const importSource = context.types.has('native-module')
    ? `import { ${context.moduleName} } from '${context.packageName}';

`
    : '';

  return `${importSource}export function App() {
  return (
    <view>
      <text>${context.packageName}</text>
      ${moduleButton}
      ${element}
    </view>
  );
}
`;
}

/**
 * Normalizes a directory or package basename into an npm package name.
 */
function normalizePackageName(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9_-]/g, '-');
}

/**
 * Converts a name into PascalCase for generated class names.
 */
function toPascalCase(name: string): string {
  const words = name.split(/[^A-Z0-9]+/i).filter(Boolean);
  const result = words.map((word) =>
    `${word.charAt(0).toUpperCase()}${word.slice(1)}`
  ).join('');

  return result.length > 0 ? result : 'LynxExtension';
}

/**
 * Converts a name into kebab-case for element tags and package segments.
 */
function toKebabCase(name: string): string {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/[^A-Z0-9]+/gi, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Converts a name into a safe Java package segment.
 */
function toJavaPackageSegment(name: string): string {
  const segment = toKebabCase(name).replaceAll('-', '');
  return segment.length > 0 ? segment : 'extension';
}

/**
 * Converts an npm package name into a podspec name.
 */
function podspecName(packageName: string): string {
  return packageName.replace(/^@/, '').replaceAll('/', '-');
}

/**
 * Checks whether a string is a supported extension type.
 */
function isExtensionType(type: string): type is ExtensionType {
  return (EXTENSION_TYPES as readonly string[]).includes(type);
}

/**
 * Serializes scaffold JSON files with a trailing newline.
 */
function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
