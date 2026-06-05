// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type LibraryFeature = 'native-module' | 'element' | 'service';

export interface CreateLynxLibraryOptions {
  dir: string;
  features: LibraryFeature[];
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
  packageName: string;
  androidPackage: string;
  androidPackagePath: string;
  moduleName: string;
  elementName: string;
  elementClassName: string;
  serviceName: string;
  serviceProtocolName: string;
  dependencyVersions: Record<string, string>;
  features: Set<LibraryFeature>;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export const LIBRARY_FEATURES: readonly LibraryFeature[] = [
  'native-module',
  'element',
  'service',
] as const;

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const TEMPLATE_FILE_SUFFIX = '.tmpl';
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

  const context = createContext(options, features);
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
 * Derives template names and platform identifiers from scaffold options.
 */
function createContext(
  options: CreateLynxLibraryOptions,
  features: Set<LibraryFeature>,
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
    dependencyVersions: options.dependencyVersions
      ?? readDefaultDependencyVersions(),
    features,
  };
}

/**
 * Creates the complete in-memory file list from template directories.
 */
function createFiles(context: TemplateContext): CreatedFile[] {
  const groups = ['template-common'];

  if (context.features.has('native-module')) {
    groups.push('template-native-module');
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

  return listTemplateFiles(root).map((absolutePath) => {
    const relativePath = toPosixPath(path.relative(root, absolutePath));
    const renderedPath = renderTemplate(relativePath, replacements);
    const filePath = stripTemplateFileSuffix(renderedPath);
    const content = renderTemplate(
      fs.readFileSync(absolutePath, 'utf8'),
      replacements,
    );

    return {
      path: filePath,
      content: filePath.endsWith('package.json')
        ? replacePackageDependencyVersions(
          content,
          context.dependencyVersions,
          filePath,
        )
        : content,
    };
  });
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

  return packageJson.devDependencies ?? {};
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
      }. Add these packages to create-lynx-library's devDependencies.`,
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
    ANDROID_PACKAGE: context.androidPackage,
    ANDROID_PACKAGE_PATH: context.androidPackagePath,
    ELEMENT_CLASS_NAME: context.elementClassName,
    ELEMENT_NAME: context.elementName,
    EXAMPLE_ELEMENT: exampleElement(context),
    EXAMPLE_IMPORT: exampleImport(context),
    EXAMPLE_MODULE_BUTTON: exampleModuleButton(context),
    IOS_SERVICE_API_DEPENDENCY: iosServiceApiDependency(context),
    MODULE_NAME: context.moduleName,
    PACKAGE_NAME: context.packageName,
    PODSPEC_NAME: podspecName(context.packageName),
    SERVICE_NAME: context.serviceName,
    SERVICE_PROTOCOL_NAME: context.serviceProtocolName,
    SOURCE_INDEX: sourceIndex(context),
    TYPES_DECLARATION: typesDeclaration(context),
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
  );
  const unresolvedToken = /__[A-Z0-9_]+__/.exec(rendered);

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

/**
 * Generates the package entry point.
 */
function sourceIndex(context: TemplateContext): string {
  if (!context.features.has('native-module')) {
    return `// Lynx library package entry.
`;
  }

  return `export { ${context.moduleName} } from '../generated/${context.moduleName}';
`;
}

/**
 * Generates the initial native module type declarations.
 */
function typesDeclaration(context: TemplateContext): string {
  if (!context.features.has('native-module')) {
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
 * Generates the example app import for the selected library features.
 */
function exampleImport(context: TemplateContext): string {
  if (!context.features.has('native-module')) {
    return '';
  }

  return `import { ${context.moduleName} } from '${context.packageName}';

`;
}

/**
 * Generates the example app native module action.
 */
function exampleModuleButton(context: TemplateContext): string {
  if (!context.features.has('native-module')) {
    return '';
  }

  return `<text bindtap={() => ${context.moduleName}.setValue('key', 'value')}>
        Native module
      </text>`;
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
  return context.features.has('service')
    ? `  s.dependency 'LynxServiceAPI'`
    : '';
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
