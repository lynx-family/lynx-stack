// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type WatchCallback = (
  error: Error | null,
  fileTimeInfoEntries: Map<string, unknown>,
  contextTimeInfoEntries: Map<string, unknown>,
  changedFiles: Set<string>,
  removedFiles: Set<string>,
) => void;

interface PurgeableCompiler {
  inputFileSystem?: { purge?: (path?: string) => void } | null;
}

/**
 * The watch file system of the kit's compiler.
 *
 * It does not watch anything: memfs only changes through
 * `WebBundler.applyChanges`, which reports every change here. One report
 * makes one rebuild, with no timers involved. A report that arrives while a
 * compilation runs is kept and starts the next one as soon as Rspack watches
 * again.
 */
export class ChangeWatchFileSystem {
  private pending: { changed: Set<string>; removed: Set<string> } | undefined;
  private current:
    | {
      callback: WatchCallback;
      callbackUndelayed?: ((file: string, time: number) => void) | undefined;
    }
    | undefined;

  constructor(private readonly compiler: PurgeableCompiler) {}

  watch(
    _files: Iterable<string>,
    _directories: Iterable<string>,
    _missing: Iterable<string>,
    _startTime: number,
    _options: unknown,
    callback: WatchCallback,
    callbackUndelayed?: (file: string, time: number) => void,
  ) {
    const watcher = { callback, callbackUndelayed };
    this.current = watcher;
    if (this.pending) queueMicrotask(() => this.flush());
    const stop = () => {
      if (this.current === watcher) this.current = undefined;
    };
    return {
      close: stop,
      pause: stop,
      getInfo: () => ({
        changes: new Set(this.pending?.changed),
        removals: new Set(this.pending?.removed),
        fileTimeInfoEntries: new Map(),
        contextTimeInfoEntries: new Map(),
      }),
    };
  }

  /** Reports files that `applyChanges` wrote or removed. */
  notify(changed: Iterable<string>, removed: Iterable<string>): void {
    this.pending ??= { changed: new Set(), removed: new Set() };
    for (const file of changed) {
      this.pending.removed.delete(file);
      this.pending.changed.add(file);
    }
    for (const file of removed) {
      this.pending.changed.delete(file);
      this.pending.removed.add(file);
    }
    if (this.current) this.flush();
  }

  private flush(): void {
    const watcher = this.current;
    const pending = this.pending;
    if (!watcher || !pending) return;
    this.current = undefined;
    this.pending = undefined;
    // Drop everything the cached input file system remembers: a new file
    // also changes what its parent directories list.
    this.compiler.inputFileSystem?.purge?.();
    const first = pending.changed.values().next().value
      ?? pending.removed.values().next().value;
    if (first !== undefined) watcher.callbackUndelayed?.(first, Date.now());
    watcher.callback(
      null,
      new Map(),
      new Map(),
      pending.changed,
      pending.removed,
    );
  }
}
