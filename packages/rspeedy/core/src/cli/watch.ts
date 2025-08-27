// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Config } from '../config/index.js'

export async function watchFiles(
  files: string[],
  callback: (
    filePath: string,
    startTime: number,
    event: string,
  ) => Promise<void>,
): Promise<void> {
  const chokidar = await import('chokidar')
  const watcher = chokidar.default.watch(files, {
    // do not trigger add for initial files
    ignoreInitial: true,
    // If watching fails due to read permissions, the errors will be suppressed silently.
    ignorePermissionErrors: true,
  })

  const cb = debounce(
    (event: string, filePath: string) => {
      const startTime = Date.now()
      void watcher.close().then(() => callback(filePath, startTime, event))
    },
    // set 300ms debounce to avoid restart frequently
    300,
  )

  watcher.once('add', cb.bind(null, 'add'))
  watcher.once('change', cb.bind(null, 'change'))
  watcher.once('unlink', cb.bind(null, 'unlink'))
}

// biome-ignore lint/suspicious/noExplicitAny: Make TS happy
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export function getWatchedFiles(
  configPath: string,
  rspeedyConfig: Config,
): string[] {
  const watchedFiles = [configPath]
  if (Array.isArray(rspeedyConfig.dev?.watchFiles)) {
    watchedFiles.push(
      ...rspeedyConfig.dev.watchFiles
        .filter(item => item.type === 'reload-server')
        .flatMap(item => item.paths),
    )
  } else if (rspeedyConfig.dev?.watchFiles?.type === 'reload-server') {
    const { paths } = rspeedyConfig.dev.watchFiles
    watchedFiles.push(...Array.isArray(paths) ? paths : [paths])
  }
  return watchedFiles
}
