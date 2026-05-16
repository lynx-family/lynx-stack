// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { sortPackageJson } from 'sort-package-json';

const REPOSITORY_TYPE = 'git';
const REPOSITORY_URL = 'https://github.com/lynx-family/lynx-stack.git';

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const resolvePackageDir = (dirOrOptions) => {
  if (typeof dirOrOptions === 'string') return dirOrOptions;
  if (!dirOrOptions || typeof dirOrOptions !== 'object') return null;

  if (typeof dirOrOptions.dir === 'string') return dirOrOptions.dir;

  if (typeof dirOrOptions.resolvedPath === 'string') {
    return path.dirname(dirOrOptions.resolvedPath);
  }

  if (typeof dirOrOptions.filePath === 'string') {
    return path.dirname(dirOrOptions.filePath);
  }

  return null;
};

const createRepository = (dirOrOptions, workspaceDir) => {
  const packageDir = resolvePackageDir(dirOrOptions);
  const directory = packageDir == null
    ? ''
    : toPosixPath(path.relative(workspaceDir, packageDir));

  return {
    type: REPOSITORY_TYPE,
    url: REPOSITORY_URL,
    ...(directory ? { directory } : {}),
  };
};

export default function createLynxStackMetaUpdateOptions(workspaceDir) {
  return {
    'package.json': (manifest, options) => {
      if (manifest?.private === true || manifest?.repository != null) {
        return sortPackageJson(manifest);
      }

      return sortPackageJson({
        ...manifest,
        repository: createRepository(options, workspaceDir),
      });
    },
  };
}
