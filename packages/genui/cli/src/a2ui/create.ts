// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readValue } from '../utils.js';

const createUsage = `Usage: genui a2ui create [project-name] [options]

Options:
  --template <name>  Template to use (default: "default").
  --help             Print this help message.
`;

const AVAILABLE_TEMPLATES = ['default'];

interface CreateOptions {
  programName: string;
}

interface ParsedCreateArgs {
  help: boolean;
  template?: string;
  projectName?: string;
}

export function runA2UICreateCli(
  args: string[],
  cwd: string,
  options: CreateOptions,
): number {
  const programName = options.programName;
  const parsed = parseCreateArgs(args);
  if (parsed.help) {
    console.info(createUsage);
    return 0;
  }

  const projectName = parsed.projectName ?? 'my-a2ui-app';
  const template = parsed.template ?? 'default';

  if (!AVAILABLE_TEMPLATES.includes(template)) {
    throw new Error(
      `[${programName}] Unknown template: "${template}". Available templates: ${
        AVAILABLE_TEMPLATES.join(', ')
      }`,
    );
  }

  const targetDir = path.resolve(cwd, projectName);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(
      `[${programName}] Target directory "${projectName}" is not empty. Please choose a different name or remove the existing directory.`,
    );
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const templateDir = path.resolve(
    __dirname,
    '../../templates',
    template,
  );

  copyDir(templateDir, targetDir);

  // Replace {{projectName}} and resolve workspace:* versions in package.json
  const pkgName = path.basename(targetDir);
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const require = createRequire(import.meta.url);
    const cliPkg = require('../../package.json') as {
      devDependencies?: Record<string, string>;
    };
    const versionMap = resolveVersionMap(cliPkg.devDependencies ?? {}, require);
    let content = fs.readFileSync(pkgJsonPath, 'utf-8');
    content = content.replaceAll('{{projectName}}', pkgName);
    content = replaceWorkspaceVersions(content, versionMap, require);
    fs.writeFileSync(pkgJsonPath, content);
  }

  console.info(`\nProject created at ${projectName}/\n`);
  console.info(`Next steps:\n`);
  console.info(`  cd ${projectName}`);
  console.info(`  pnpm install`);
  console.info(`  pnpm run dev\n`);

  return 0;
}

function parseCreateArgs(args: string[]): ParsedCreateArgs {
  const options: ParsedCreateArgs = { help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--template') {
      options.template = readValue(args, ++index, arg);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.projectName = arg;
    }
  }
  return options;
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function replaceWorkspaceVersions(
  content: string,
  versionMap: Record<string, string>,
  requireFn: (id: string) => unknown,
): string {
  const pkg = JSON.parse(content) as Record<string, Record<string, string>>;
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (deps[name] === 'workspace:*') {
        const resolved = versionMap[name]
          ?? resolvePackageVersion(name, requireFn);
        if (resolved) {
          deps[name] = resolved;
        }
      }
    }
  }
  return JSON.stringify(pkg, null, 2) + '\n';
}

function resolvePackageVersion(
  name: string,
  requireFn: (id: string) => unknown,
): string | undefined {
  try {
    const pkg = requireFn(`${name}/package.json`) as { version: string };
    return `^${pkg.version}`;
  } catch {
    // Package might have strict exports; try resolving via main entry
    try {
      const mainPath =
        (requireFn as unknown as { resolve: (id: string) => string }).resolve(
          name,
        );
      // Walk up to find package.json
      let dir = path.dirname(mainPath);
      while (dir !== path.dirname(dir)) {
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
            name?: string;
            version?: string;
          };
          if (pkg.name === name && pkg.version) {
            return `^${pkg.version}`;
          }
        }
        dir = path.dirname(dir);
      }
    } catch {
      // Cannot resolve package at all
    }
    return undefined;
  }
}

/**
 * Resolve workspace:^ / workspace:* values in devDependencies to real versions.
 * In published packages, pnpm already resolves these. In dev mode, we read
 * each package's actual version from its package.json.
 */
function resolveVersionMap(
  devDeps: Record<string, string>,
  requireFn: (id: string) => unknown,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [name, version] of Object.entries(devDeps)) {
    if (version.startsWith('workspace:')) {
      // Dev mode: resolve from the package's own package.json
      try {
        const pkg = requireFn(`${name}/package.json`) as { version: string };
        const prefix = version === 'workspace:*' ? '' : '^';
        resolved[name] = `${prefix}${pkg.version}`;
      } catch {
        // Package not resolvable, skip
      }
    } else if (!version.startsWith('catalog:')) {
      resolved[name] = version;
    }
  }
  return resolved;
}
