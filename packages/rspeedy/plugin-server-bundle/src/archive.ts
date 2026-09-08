// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { deflateSync, zipSync } from 'fflate'
import type { Zippable } from 'fflate'

const MIB = 1024 * 1024

// Keep these bounds aligned with genui/ui-judge/src/zip/mod.rs.
export function validatePath(name: string): void {
  const parts = name.split('/')
  if (
    !name || /[\\\0:]/.test(name)
    || parts.some(part => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe ZIP path: ${name}`)
  }
  if (
    parts.length > 20 || Buffer.byteLength(name) > 4096
    || parts.some(part => Buffer.byteLength(part) > 255)
  ) {
    throw new Error(`ZIP path exceeds UI Judge limits: ${name}`)
  }
}

export async function readOutput(
  directory: string,
  filename: string,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  let total = 0

  async function visit(relative: string): Promise<void> {
    const names = await readdir(path.join(directory, relative))
    for (const name of names.sort()) {
      const entry = relative ? `${relative}/${name}` : name
      if (entry === filename) continue
      validatePath(entry)
      const absolute = path.join(directory, entry)
      const stat = await lstat(absolute)
      if (stat.isDirectory()) {
        await visit(entry)
      } else if (stat.isFile()) {
        if (files.size >= 100) {
          throw new Error('ZIP exceeds UI Judge limit of 100 files')
        }
        if (stat.size > 50 * MIB || total + stat.size > 100 * MIB) {
          throw new Error('ZIP exceeds UI Judge uncompressed size limits')
        }
        const contents = await readFile(absolute)
        total += contents.byteLength
        files.set(entry, contents)
      } else {
        throw new Error(
          `ZIP only supports regular files and directories: ${entry}`,
        )
      }
    }
  }

  await visit('')
  return files
}

export function createArchive(files: Map<string, Uint8Array>): Uint8Array {
  const entries: Zippable = Object.create(null) as Zippable
  for (const [name, contents] of files) {
    // Highly repetitive bundles can exceed the extractor's 100:1 ratio.
    // Store those files without compression instead of emitting a rejected ZIP.
    const compressed = deflateSync(contents)
    entries[name] = [contents, {
      level: contents.byteLength > compressed.byteLength * 100 ? 0 : 6,
      mtime: new Date(1980, 0, 1),
    }]
  }
  const archive = zipSync(entries)
  if (archive.byteLength > 10 * MIB) {
    throw new Error('ZIP exceeds UI Judge upload limit of 10 MiB')
  }
  return archive
}
