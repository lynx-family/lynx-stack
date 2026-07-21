// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type LibraryFeature =
  | 'native-module'
  | 'napi-native-module'
  | 'element'
  | 'service';
export type LibraryPlatform = 'android' | 'ios' | 'lynxtron';

export interface CreateLynxLibraryOptions {
  dir: string;
  features: LibraryFeature[];
  platforms?: LibraryPlatform[];
  packageName?: string;
  androidPackage?: string;
  moduleName?: string;
  elementName?: string;
  serviceName?: string;
  dependencyVersions?: Record<string, string>;
}

export interface CreatedFile {
  path: string;
  content: string;
}

interface TemplateContext {
  addonBinaryName: string;
  nodeApiAddonName: string;
  addonTargetName: string;
  packageName: string;
  androidPackage: string;
  androidPackagePath: string;
  moduleName: string;
  napiModuleName: string;
  elementName: string;
  elementClassName: string;
  elementSymbolName: string;
  serviceName: string;
  serviceProtocolName: string;
  dependencyVersions: Record<string, string>;
  features: Set<LibraryFeature>;
  platforms: Set<LibraryPlatform>;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export const LIBRARY_FEATURES: readonly LibraryFeature[] = [
  'native-module',
  'napi-native-module',
  'element',
  'service',
] as const;
export const LIBRARY_PLATFORMS: readonly LibraryPlatform[] = [
  'android',
  'ios',
  'lynxtron',
] as const;
export const DEFAULT_LIBRARY_PLATFORMS: readonly LibraryPlatform[] = [
  'android',
  'ios',
  'lynxtron',
] as const;

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const moduleRequire = createRequire(import.meta.url);
const TEMPLATE_FILE_SUFFIX = '.tmpl';
const LYNX_EXTENSION_HEADERS_PACKAGE = '@lynx-js/lynx-library-headers';
const LYNX_EXTENSION_HEADERS_VERSION = '*';
const WEAK_NODE_API_PACKAGE = '@lynx-js/weak-node-api';
const WEAK_NODE_API_VERSION = '^0.0.9';
const PACKAGE_JSON_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const satisfies ReadonlyArray<keyof PackageJson>;

/**
 * Creates a Lynx library scaffold on disk.
 */
export function createLynxLibrary(
  options: CreateLynxLibraryOptions,
): CreatedFile[] {
  const targetDir = path.resolve(options.dir);

  if (fs.existsSync(targetDir)) {
    const stat = fs.statSync(targetDir);

    if (!stat.isDirectory()) {
      throw new Error(`Target path is not a directory: ${targetDir}`);
    }

    if (fs.readdirSync(targetDir).length > 0) {
      throw new Error(`Target directory is not empty: ${targetDir}`);
    }
  }

  const features = new Set(options.features);

  if (features.size === 0) {
    throw new Error('At least one library feature must be selected');
  }

  for (const feature of features) {
    if (!isLibraryFeature(feature)) {
      throw new Error(`Unsupported library feature: ${String(feature)}`);
    }
  }

  const platforms = new Set(options.platforms ?? DEFAULT_LIBRARY_PLATFORMS);

  if (platforms.size === 0) {
    throw new Error('At least one Native platform must be selected');
  }

  for (const platform of platforms) {
    if (!isLibraryPlatform(platform)) {
      throw new Error(`Unsupported Native platform: ${String(platform)}`);
    }
  }

  const context = createContext(options, features, platforms);
  const files = createFiles(context);

  for (const file of files) {
    const absolutePath = resolveInside(targetDir, file.path);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.content);
  }

  return files;
}

/**
 * Parses a comma-separated library feature list from CLI input.
 */
export function parseLibraryFeatures(source: string): LibraryFeature[] {
  const normalizedSource = source.trim().toLowerCase();

  if (normalizedSource === 'all') {
    return [...LIBRARY_FEATURES];
  }

  const features = normalizedSource.split(',').map((feature) => feature.trim())
    .filter(Boolean);

  if (features.length === 0) {
    return [];
  }

  return features.map((feature) => {
    if (!isLibraryFeature(feature)) {
      throw new Error(
        `Unsupported library feature "${feature}". Expected one of: ${
          LIBRARY_FEATURES.join(
            ', ',
          )
        }`,
      );
    }

    return feature;
  });
}

/**
 * Parses a comma-separated Native platform list from CLI input.
 */
export function parseLibraryPlatforms(source: string): LibraryPlatform[] {
  const normalizedSource = source.trim().toLowerCase();

  if (normalizedSource === 'all') {
    return [...LIBRARY_PLATFORMS];
  }

  const platforms = normalizedSource.split(',').map((platform) =>
    platform.trim()
  )
    .filter(Boolean);

  if (platforms.length === 0) {
    return [];
  }

  return platforms.map((platform) => {
    if (!isLibraryPlatform(platform)) {
      throw new Error(
        `Unsupported Native platform "${platform}". Expected one of: ${
          LIBRARY_PLATFORMS.join(
            ', ',
          )
        }`,
      );
    }

    return platform;
  });
}

/**
 * Derives template names and platform identifiers from scaffold options.
 */
function createContext(
  options: CreateLynxLibraryOptions,
  features: Set<LibraryFeature>,
  platforms: Set<LibraryPlatform>,
): TemplateContext {
  const directoryName = path.basename(path.resolve(options.dir));
  const packageName = options.packageName
    ?? normalizePackageName(directoryName);
  const baseName = packageName.split('/').at(-1) ?? packageName;
  const prefix = toPascalCase(baseName);
  const moduleName = options.moduleName ?? `${prefix}Module`;
  const napiModuleName = features.has('native-module')
    ? `${moduleName}Napi`
    : moduleName;
  const elementName = options.elementName ?? `x-${toKebabCase(prefix)}`;
  const serviceName = options.serviceName ?? `${prefix}Service`;
  const elementPrefix = toPascalCase(elementName.replace(/^x-/, ''));
  const androidPackage = options.androidPackage
    ?? `com.example.${toJavaPackageSegment(prefix)}`;

  return {
    addonBinaryName: toKebabCase(baseName) || 'lynx-library',
    nodeApiAddonName: napiModuleName,
    addonTargetName: `${toCIdentifier(prefix, 'LynxLibrary')}Addon`,
    packageName,
    androidPackage,
    androidPackagePath: androidPackage.replaceAll('.', '/'),
    moduleName,
    napiModuleName,
    elementName,
    elementClassName: `${elementPrefix}Element`,
    elementSymbolName: toCIdentifier(`${elementPrefix}Element`, 'LynxElement'),
    serviceName,
    serviceProtocolName: `${serviceName}Protocol`,
    dependencyVersions: options.dependencyVersions
      ?? readDefaultDependencyVersions(),
    features,
    platforms,
  };
}

/**
 * Creates the complete in-memory file list from template directories.
 */
function createFiles(context: TemplateContext): CreatedFile[] {
  const groups = ['template-common'];

  if (hasSharedSources(context)) {
    groups.push('template-shared');
  }

  if (context.features.has('native-module')) {
    groups.push('template-native-module');
  }

  if (context.features.has('napi-native-module')) {
    groups.push('template-napi-native-module');
  }

  if (context.features.has('element')) {
    groups.push('template-element');
  }

  if (context.features.has('service')) {
    groups.push('template-service');
  }

  return groups.flatMap((group) =>
    createFilesFromTemplateGroup(group, context)
  );
}

/**
 * Reads one template group and renders its paths and file contents.
 */
function createFilesFromTemplateGroup(
  group: string,
  context: TemplateContext,
): CreatedFile[] {
  const root = path.join(PACKAGE_ROOT, group);
  const replacements = createTemplateReplacements(context);

  return listTemplateFiles(root).flatMap((absolutePath) => {
    const relativePath = toPosixPath(path.relative(root, absolutePath));

    if (!shouldCreateTemplateFile(relativePath, context)) {
      return [];
    }

    const renderedPath = renderTemplate(relativePath, replacements);
    const filePath = stripTemplateFileSuffix(renderedPath);
    const content = renderTemplate(
      fs.readFileSync(absolutePath, 'utf8'),
      replacements,
    );

    return [{
      path: filePath,
      content: filePath.endsWith('package.json')
        ? replacePackageDependencyVersions(
          content,
          context.dependencyVersions,
          filePath,
        )
        : content,
    }];
  });
}

/**
 * Drops native platform directories that the scaffold does not target.
 */
function shouldCreateTemplateFile(
  relativePath: string,
  context: TemplateContext,
): boolean {
  if (relativePath.startsWith('android/')) {
    return context.platforms.has('android');
  }

  if (relativePath.startsWith('ios/')) {
    return context.platforms.has('ios');
  }

  if (relativePath === 'types/platform-native-module.d.ts.tmpl') {
    return context.features.has('native-module');
  }

  if (relativePath === 'types/napi-native-module.d.ts.tmpl') {
    return context.features.has('napi-native-module');
  }

  if (relativePath.startsWith('lynxtron/')) {
    return hasLynxtronTarget(context);
  }

  if (relativePath.startsWith('shared/')) {
    return hasSharedSources(context);
  }

  if (
    relativePath === 'types/index.d.ts.tmpl'
  ) {
    return true;
  }

  return true;
}

/**
 * Reads dependency versions carried by the published scaffold package metadata.
 *
 * This intentionally uses the target dependency's published version rewritten
 * from workspace protocol during packing, not create-lynx-library's own
 * package version.
 */
function readDefaultDependencyVersions(): Record<string, string> {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
  ) as PackageJson;
  const versions: Record<string, string> = {};

  for (const field of ['dependencies', 'devDependencies'] as const) {
    for (
      const [name, version] of Object.entries(packageJson[field] ?? {})
    ) {
      versions[name] = version.startsWith('workspace:')
        ? readPackageVersion(name)
        : version;
    }
  }

  return versions;
}

/**
 * Reads the installed package version for a workspace dependency.
 */
function readPackageVersion(packageName: string): string {
  const packageJsonPath = resolvePackageJson(packageName);
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf8'),
  ) as { version?: unknown };

  if (
    typeof packageJson.version !== 'string' || packageJson.version.length === 0
  ) {
    throw new Error(`Unable to read package version for ${packageName}`);
  }

  return packageJson.version;
}

function resolvePackageJson(packageName: string): string {
  try {
    return findPackageJson(moduleRequire.resolve(packageName));
  } catch (error) {
    const packageJsonPath = path.join(
      PACKAGE_ROOT,
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    );

    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }

    throw error;
  }
}

/**
 * Finds the package metadata for a resolved package entry without relying on package.json exports.
 */
function findPackageJson(entrypoint: string): string {
  let current = path.dirname(entrypoint);

  while (current !== path.dirname(current)) {
    const packageJsonPath = path.join(current, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }

    current = path.dirname(current);
  }

  throw new Error(`Unable to find package.json from ${entrypoint}`);
}

/**
 * Replaces workspace template dependency versions with the scaffold package's current version table.
 */
function replacePackageDependencyVersions(
  source: string,
  dependencyVersions: Record<string, string>,
  filePath: string,
): string {
  let packageJson: PackageJson;

  try {
    packageJson = JSON.parse(source) as PackageJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid package.json template after rendering: ${filePath}: ${message}`,
    );
  }

  const missingVersionPackages = new Set<string>();

  for (const field of PACKAGE_JSON_DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field];

    if (dependencies === undefined) {
      continue;
    }

    for (const [name, version] of Object.entries(dependencies)) {
      if (version.startsWith('workspace:')) {
        const replacement = dependencyVersions[name];

        if (replacement === undefined) {
          missingVersionPackages.add(name);
        } else {
          dependencies[name] = replacement;
        }
      }
    }
  }

  if (missingVersionPackages.size > 0) {
    throw new Error(
      `Template package.json "${filePath}" contains workspace dependencies without version mappings: ${
        Array.from(missingVersionPackages).join(', ')
      }. Add these packages to create-lynx-library's dependencies or devDependencies.`,
    );
  }

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/**
 * Recursively lists template files in deterministic order.
 */
function listTemplateFiles(root: string): string[] {
  const files: string[] = [];

  for (
    const entry of fs.readdirSync(root, { withFileTypes: true }).sort((
      left,
      right,
    ) => left.name.localeCompare(right.name))
  ) {
    const absolutePath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...listTemplateFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

/**
 * Normalizes template paths so generated file records are platform-independent.
 */
function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * Removes the suffix used to keep placeholder templates out of source linters.
 */
function stripTemplateFileSuffix(filePath: string): string {
  return filePath.endsWith(TEMPLATE_FILE_SUFFIX)
    ? filePath.slice(0, -TEMPLATE_FILE_SUFFIX.length)
    : filePath;
}

/**
 * Creates placeholder values used by template files and template paths.
 */
function createTemplateReplacements(
  context: TemplateContext,
): Record<string, string> {
  return {
    ADDON_BINARY_NAME: context.addonBinaryName,
    NODE_API_ADDON_NAME: context.nodeApiAddonName,
    ADDON_TARGET_NAME: context.addonTargetName,
    ANDROID_PACKAGE: context.androidPackage,
    ANDROID_PACKAGE_PATH: context.androidPackagePath,
    ELEMENT_CLASS_NAME: context.elementClassName,
    ELEMENT_NAME: context.elementName,
    ELEMENT_SYMBOL_NAME: context.elementSymbolName,
    EXAMPLE_ELEMENT: exampleElement(context),
    EXAMPLE_IMPORT: exampleImport(context),
    EXAMPLE_MODULE_BUTTON: exampleModuleButton(context),
    ANDROID_NAPI_BUILD_SETUP: androidNapiBuildSetup(context),
    ANDROID_NAPI_DEFAULT_CONFIG: androidNapiDefaultConfig(context),
    ANDROID_NAPI_DEPENDENCIES: androidNapiDependencies(context),
    ANDROID_NAPI_EXTERNAL_NATIVE_BUILD: androidNapiExternalNativeBuild(context),
    ANDROID_NAPI_TASK_WIRING: androidNapiTaskWiring(context),
    ANDROID_PLATFORM_DEPENDENCIES: androidPlatformDependencies(context),
    IOS_SERVICE_API_DEPENDENCY: iosServiceApiDependency(context),
    IOS_NAPI_ADDON_PODSPEC: iosNapiAddonPodspec(context),
    LYNX_ELEMENT_MODULE_NAME: elementModuleName(context),
    MODULE_NAME: context.moduleName,
    NAPI_MODULE_NAME: context.napiModuleName,
    NAPI_NATIVE_MODULE_README: napiNativeModuleReadme(context),
    PACKAGE_NAME: context.packageName,
    PACKAGE_EXPORTS_FIELD: packageExportsField(context),
    PACKAGE_FILES: packageFiles(context),
    PACKAGE_RUNTIME_DEPENDENCIES: packageRuntimeDependencies(context),
    PACKAGE_SELF_RENDER_DEV_DEPENDENCY: packageSelfRenderDevDependency(context),
    PACKAGE_SELF_RENDER_SCRIPTS: packageSelfRenderScripts(context),
    PLATFORM_DIRECTORY_LIST: platformDirectoryList(context),
    PLATFORM_MANIFEST_ENTRIES: platformManifestEntries(context),
    PODSPEC_NAME: podspecName(context.packageName),
    SERVICE_NAME: context.serviceName,
    SERVICE_PROTOCOL_NAME: context.serviceProtocolName,
    SELF_RENDER_README: selfRenderReadme(context),
    SOURCE_INDEX: sourceIndex(context),
    NAPI_NATIVE_MODULE_TYPES: napiNativeModuleTypes(context),
    PLATFORM_NATIVE_MODULE_TYPES: platformNativeModuleTypes(context),
    TYPES_INDEX: typesIndex(context),
    TYPE_DECLARATION_README: typeDeclarationReadme(context),
  };
}

/**
 * Applies placeholder values and fails if a template still contains a token.
 */
function renderTemplate(
  source: string,
  replacements: Record<string, string>,
): string {
  const rendered = source.replaceAll(
    /__([A-Z0-9_]+)__/g,
    (match: string, key: string): string => {
      return replacements[key] ?? match;
    },
  ).replaceAll(
    /\*\*([A-Z0-9_]+)\*\*/g,
    (match: string, key: string): string => {
      return replacements[key] ?? match;
    },
  );
  const unresolvedToken = /__[A-Z0-9_]+__|\*\*[A-Z0-9_]+\*\*/.exec(rendered);

  if (unresolvedToken !== null) {
    throw new Error(`Unresolved template token: ${unresolvedToken[0]}`);
  }

  return rendered;
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

function hasSharedSources(context: TemplateContext): boolean {
  return context.features.has('napi-native-module')
    || (
      context.platforms.has('lynxtron')
      && context.features.has('element')
    );
}

function hasLynxtronTarget(context: TemplateContext): boolean {
  return context.platforms.has('lynxtron')
    && (context.features.has('napi-native-module') || context.features.has(
      'element',
    ));
}

function packageExportsField(context: TemplateContext): string {
  if (!hasLynxtronTarget(context)) {
    return '';
  }

  return `  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "default": "./src/index.ts"
    },
    "./lynxtron": "./lynxtron/index.cjs",
    "./package.json": "./package.json"
  },
`;
}

function packageSelfRenderScripts(context: TemplateContext): string {
  if (!hasLynxtronTarget(context)) {
    return '';
  }

  return `,
    "build:lynxtron": "cmake -S lynxtron -B build/lynxtron -DCMAKE_BUILD_TYPE=Release && cmake --build build/lynxtron --config Release"`;
}

function packageSelfRenderDevDependency(context: TemplateContext): string {
  if (!hasSharedSources(context)) {
    return '';
  }

  const dependencies: string[] = [];

  if (!context.features.has('napi-native-module')) {
    const headersVersion =
      context.dependencyVersions[LYNX_EXTENSION_HEADERS_PACKAGE]
        ?? LYNX_EXTENSION_HEADERS_VERSION;
    const weakNodeApiVersion = context.dependencyVersions[WEAK_NODE_API_PACKAGE]
      ?? WEAK_NODE_API_VERSION;
    dependencies.push(
      `    "${LYNX_EXTENSION_HEADERS_PACKAGE}": "${headersVersion}"`,
      `    "${WEAK_NODE_API_PACKAGE}": "${weakNodeApiVersion}"`,
    );
  }

  if (dependencies.length === 0) {
    return '';
  }

  return `,
${dependencies.join(',\n')}`;
}

function packageRuntimeDependencies(context: TemplateContext): string {
  if (!context.features.has('napi-native-module')) {
    return '';
  }

  const weakNodeApiVersion = context.dependencyVersions[WEAK_NODE_API_PACKAGE]
    ?? WEAK_NODE_API_VERSION;
  const headersVersion =
    context.dependencyVersions[LYNX_EXTENSION_HEADERS_PACKAGE]
      ?? LYNX_EXTENSION_HEADERS_VERSION;

  return `  "dependencies": {
    "${WEAK_NODE_API_PACKAGE}": "${weakNodeApiVersion}",
    "${LYNX_EXTENSION_HEADERS_PACKAGE}": "${headersVersion}"
  },`;
}

/**
 * Generates the package entry point.
 */
function sourceIndex(context: TemplateContext): string {
  const exportLines: string[] = [];

  if (context.features.has('native-module')) {
    exportLines.push(
      `export { ${context.moduleName} } from '../generated/${context.moduleName}';`,
    );
  }

  if (context.features.has('napi-native-module')) {
    exportLines.push(
      `export { ${context.napiModuleName} } from '../generated/${context.napiModuleName}';`,
    );
  }

  if (exportLines.length === 0) {
    return `// Lynx library package entry.
`;
  }

  return `${exportLines.join('\n')}\n`;
}

/**
 * Generates the aggregate type declarations entry.
 */
function typesIndex(context: TemplateContext): string {
  const exportLines: string[] = [];

  if (context.features.has('native-module')) {
    exportLines.push(`export * from './platform-native-module';`);
  }

  if (context.features.has('napi-native-module')) {
    exportLines.push(`export * from './napi-native-module';`);
  }

  if (exportLines.length === 0) {
    return `// Add native module declarations here and run npm run codegen.
`;
  }

  return `${exportLines.join('\n')}\n`;
}

/**
 * Generates the initial platform native module type declarations.
 */
function platformNativeModuleTypes(context: TemplateContext): string {
  return `/** @lynxmodule */
export declare class ${context.moduleName} {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
  clear(): void;
}
`;
}

/**
 * Generates the initial NAPI native module type declarations.
 */
function napiNativeModuleTypes(context: TemplateContext): string {
  return `/** @lynxmodule */
export declare class ${context.napiModuleName} {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
  clear(): void;
}
`;
}

/**
 * Generates the example app import for the selected library features.
 */
function exampleImport(context: TemplateContext): string {
  const modules: string[] = [];

  if (context.features.has('native-module')) {
    modules.push(context.moduleName);
  }

  if (context.features.has('napi-native-module')) {
    modules.push(context.napiModuleName);
  }

  if (modules.length === 0) {
    return '';
  }

  return `import { ${modules.join(', ')} } from '${context.packageName}';

`;
}

/**
 * Generates the example app native module action.
 */
function exampleModuleButton(context: TemplateContext): string {
  const buttons: string[] = [];

  if (context.features.has('native-module')) {
    buttons.push(
      `<text bindtap={() => ${context.moduleName}.setValue('key', 'value')}>
        Native module
      </text>`,
    );
  }

  if (context.features.has('napi-native-module')) {
    buttons.push(
      `<text bindtap={() => ${context.napiModuleName}.setValue('key', 'value')}>
        NAPI native module
      </text>`,
    );
  }

  return buttons.join('\n      ');
}

/**
 * Generates the example app custom element usage.
 */
function exampleElement(context: TemplateContext): string {
  return context.features.has('element') ? `<${context.elementName} />` : '';
}

/**
 * Adds the service API pod only when the generated iOS service marker needs it.
 */
function iosServiceApiDependency(context: TemplateContext): string {
  return context.platforms.has('ios') && context.features.has('service')
    ? `  s.dependency 'LynxServiceAPI'`
    : '';
}

function androidNapiExternalNativeBuild(context: TemplateContext): string {
  if (
    !context.platforms.has('android')
    || !context.features.has('napi-native-module')
  ) {
    return '';
  }

  return `

  externalNativeBuild {
    cmake {
      path = file("CMakeLists.txt")
      version = "3.18.1"
    }
  }`;
}

function hasAndroidNapiNativeModule(context: TemplateContext): boolean {
  return context.platforms.has('android')
    && context.features.has('napi-native-module');
}

function androidPlatformDependencies(context: TemplateContext): string {
  if (
    !context.platforms.has('android')
    || ![...context.features].some((feature) =>
      feature !== 'napi-native-module'
    )
  ) {
    return '';
  }

  return `  implementation("org.lynxsdk.lynx:lynx:0.0.1-alpha.1")
  implementation("org.lynxsdk.lynx:service-api:0.0.1-alpha.1")
  annotationProcessor("org.lynxsdk.lynx:lynx-processor:0.0.1-alpha.1")`;
}

function androidNapiBuildSetup(context: TemplateContext): string {
  if (!hasAndroidNapiNativeModule(context)) {
    return '';
  }

  return `val lynxPrimjsVersion = providers.gradleProperty("lynx.primjs.version").orElse("4.+").get()
val primjsNativeAar by configurations.creating
val primjsNativeAarFiles = primjsNativeAar.incoming.artifactView {}.files
val extractPrimjsNativeLibraries by tasks.registering(Sync::class) {
  from(primjsNativeAarFiles.elements.map { files ->
    files.map { zipTree(it.asFile) }
  })
  include("jni/**/*.so")
  into(layout.buildDirectory.dir("primjs-native"))
}

`;
}

function androidNapiDefaultConfig(context: TemplateContext): string {
  if (!hasAndroidNapiNativeModule(context)) {
    return '';
  }

  return `

    externalNativeBuild {
      cmake {
        arguments(
          "-DLYNX_PRIMJS_JNI_DIR=${'$'}{layout.buildDirectory.dir("primjs-native/jni").get().asFile.absolutePath}"
        )
      }
    }`;
}

function androidNapiDependencies(context: TemplateContext): string {
  if (!hasAndroidNapiNativeModule(context)) {
    return '';
  }

  return `
  implementation("org.lynxsdk.lynx:primjs:${'$'}lynxPrimjsVersion")
  primjsNativeAar("org.lynxsdk.lynx:primjs:${'$'}lynxPrimjsVersion@aar")`;
}

function androidNapiTaskWiring(context: TemplateContext): string {
  if (!hasAndroidNapiNativeModule(context)) {
    return '';
  }

  return `

tasks.configureEach {
  if (name.startsWith("configureCMake")
      || name.startsWith("generateJsonModel")
      || name.startsWith("externalNativeBuild")) {
    dependsOn(extractPrimjsNativeLibraries)
  }
}`;
}

function iosNapiAddonPodspec(context: TemplateContext): string {
  if (
    !context.platforms.has('ios') || !context.features.has('napi-native-module')
  ) {
    return '';
  }

  return `
  s.source_files = 'src/**/*.{h,m,mm}', 'generated/**/*.{cc,h,mm}', 'addon_use.h'
  s.public_header_files = 'addon_use.h'
  s.dependency 'LynxWeakNodeAPI'
  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '$(inherited) "\${PODS_ROOT}/LynxWeakNodeAPI/packages/weak-node-api/headers" "\${PODS_ROOT}/PrimJS/src/napi" "\${PODS_ROOT}/PrimJS/src/napi/js_native_api"',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1'
  }`;
}

function elementModuleName(context: TemplateContext): string {
  return `${
    toCIdentifier(toPascalCase(context.addonBinaryName), 'LynxLibrary')
  }ElementModule`;
}

function typeDeclarationReadme(context: TemplateContext): string {
  const declarations = [
    ...(context.features.has('native-module')
      ? [
        'Platform native module typings live in `types/platform-native-module.d.ts`.',
      ]
      : []),
    ...(context.features.has('napi-native-module')
      ? [
        'NAPI native module typings live in `types/napi-native-module.d.ts` and use a minimal shared C++ N-API callback stub.',
      ]
      : []),
  ];

  if (declarations.length === 0) {
    return 'This feature selection does not include native module typings.';
  }

  return `Generated JS specs are written to \`generated/\`.

${declarations.join('\n\n')}`;
}

function napiNativeModuleReadme(context: TemplateContext): string {
  if (!context.features.has('napi-native-module')) {
    return '';
  }

  const mobilePlatforms = [
    ...(context.platforms.has('android') ? ['Android'] : []),
    ...(context.platforms.has('ios') ? ['iOS'] : []),
  ];
  const mobileShimReadme = mobilePlatforms.length > 0
    ? `

On ${formatList(mobilePlatforms)}, import the package root in BTS to install the
generated \`NativeModules.${context.napiModuleName}\` shim. The generated
TypeScript shim is only for the selected mobile runtimes; Lynxtron does not
import it.
`
    : '';

  return `

## NAPI Native Module

Codegen creates \`shared/nativeModule/${context.napiModuleName}.cc\` once and
preserves it on later runs. After changing the typings, rerun codegen to refresh
generated facade and registration files, then manually keep the user-owned C++
callbacks and exports in sync. If the module class is renamed, also rename or
remove the old C++ file and update the addon name in \`lynx.lib.json\`; codegen
does not delete stale user-owned files or rewrite the manifest.${mobileShimReadme}
${androidNapiReadme(context)}
`;
}

function androidNapiReadme(context: TemplateContext): string {
  if (!hasAndroidNapiNativeModule(context)) {
    return '';
  }

  return `
Android source builds resolve \`org.lynxsdk.lynx:primjs\` using the Gradle
property \`lynx.primjs.version\`, defaulting to \`4.+\`. Set the property from
the host root build when the App needs to pin the same PrimJS runtime version
used by other Lynx dependencies.
`;
}

function selfRenderReadme(context: TemplateContext): string {
  if (!hasLynxtronTarget(context)) {
    return '';
  }

  const napiBtsUsage = context.features.has('napi-native-module')
    ? `

Lynxtron BTS code does not import the package root or the generated mobile shim.
It calls the registered runtime module directly:

\`\`\`ts
NativeModules.${context.napiModuleName}.<method>(...);
\`\`\`
`
    : '';

  return `
## Lynxtron Library Target

This package contains shared C++ sources for any selected NAPI Native Module or
Element features. Build the current OS/architecture Lynxtron library with:

\`\`\`bash
npm run build:lynxtron
\`\`\`

The build writes \`dist/<platform>/<arch>/${context.addonBinaryName}.node\`.
Run it on each OS/architecture you want to publish. The package also exposes
\`./lynxtron\`, which loads the matching artifact for Lynxtron based hosts.
\`npm pack\` and \`npm publish\` do not build native artifacts, so collect every
supported platform/architecture under \`dist/\` before publishing.

In the Lynxtron Node.js main thread:

\`\`\`cjs
const addon = require('${context.packageName}/lynxtron');
addon.initialize();
\`\`\`
${napiBtsUsage}
`;
}

/**
 * Generates the package files list for the selected native platforms.
 */
function packageFiles(context: TemplateContext): string {
  const files = [
    ...(context.platforms.has('android') ? ['android'] : []),
    ...(hasLynxtronTarget(context) ? ['dist', 'lynxtron'] : []),
    ...(hasSharedSources(context) ? ['shared'] : []),
    'generated',
    ...(context.platforms.has('ios') ? ['ios'] : []),
    'src',
    'types',
    'lynx.lib.json',
    'README.md',
  ];

  return files.map((file) => `    ${JSON.stringify(file)}`).join(',\n');
}

/**
 * Generates the platform entries in lynx.lib.json.
 */
function platformManifestEntries(context: TemplateContext): string {
  const entries: string[] = [];
  const iosPodspecPath = `ios/${podspecName(context.packageName)}.podspec`;

  if (context.platforms.has('android')) {
    entries.push(`    "android": {
      "packageName": ${JSON.stringify(context.androidPackage)},
      "sourceDir": "android"${androidNodeApiAddonsManifest(context)}
    }`);
  }

  if (context.platforms.has('ios')) {
    entries.push(`    "ios": {
      "sourceDir": "ios",
      "podspecPath": ${JSON.stringify(iosPodspecPath)}${
      iosNodeApiAddonsManifest(context, iosPodspecPath)
    }
    }`);
  }

  if (hasLynxtronTarget(context)) {
    entries.push(`    "lynxtron": {
      "path": "dist"
    }`);
    entries.push(`    "macos": {
      "sourceDir": "shared"
    }`);
    entries.push(`    "windows": {
      "sourceDir": "shared"
    }`);
  }

  return entries.join(',\n');
}

function androidNodeApiAddonsManifest(context: TemplateContext): string {
  if (!context.features.has('napi-native-module')) {
    return '';
  }

  return `,
      "nodeApiAddons": [
        {
          "name": ${JSON.stringify(context.nodeApiAddonName)},
          "libraryName": ${JSON.stringify(context.nodeApiAddonName)},
          "jniLibsDir": "android/src/main/jniLibs",
          "required": false
        }
      ]`;
}

function iosNodeApiAddonsManifest(
  context: TemplateContext,
  podspecPath: string,
): string {
  if (!context.features.has('napi-native-module')) {
    return '';
  }

  return `,
      "nodeApiAddons": [
        {
          "name": ${JSON.stringify(context.nodeApiAddonName)},
          "podName": ${JSON.stringify(podspecName(context.packageName))},
          "podspecPath": ${JSON.stringify(podspecPath)},
          "addonUseHeader": "addon_use.h",
          "required": true
        }
      ]`;
}

/**
 * Formats the selected native platform directories for generated README text.
 */
function platformDirectoryList(context: TemplateContext): string {
  const dirs = [
    ...(context.platforms.has('android') ? ['`android/`'] : []),
    ...(context.platforms.has('ios') ? ['`ios/`'] : []),
    ...(hasLynxtronTarget(context) ? ['`lynxtron/`'] : []),
    ...(hasSharedSources(context) ? ['`shared/`'] : []),
  ];

  return formatList(dirs);
}

function formatList(items: string[]): string {
  if (items.length <= 2) {
    return items.join(' and ');
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1) ?? ''}`;
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

  return result.length > 0 ? result : 'LynxLibrary';
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
  return segment.length > 0 ? segment : 'library';
}

function toCIdentifier(name: string, fallback: string): string {
  const identifier = name.replaceAll(/\W/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_|_$/g, '');
  const safeIdentifier = identifier.length > 0 ? identifier : fallback;

  return /^\d/.test(safeIdentifier) ? `_${safeIdentifier}` : safeIdentifier;
}

/**
 * Converts an npm package name into a podspec name.
 */
function podspecName(packageName: string): string {
  return packageName.replace(/^@/, '').replaceAll('/', '-');
}

/**
 * Checks whether a string is a supported library feature.
 */
function isLibraryFeature(type: string): type is LibraryFeature {
  return (LIBRARY_FEATURES as readonly string[]).includes(type);
}

/**
 * Checks whether a string is a supported Native platform.
 */
function isLibraryPlatform(type: string): type is LibraryPlatform {
  return (LIBRARY_PLATFORMS as readonly string[]).includes(type);
}
