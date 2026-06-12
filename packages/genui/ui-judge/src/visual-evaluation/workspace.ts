// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface VisualEvaluationWorkspace {
  alignedDevicePath: string;
  alignedReferencePath: string;
  devicePath: string;
  diffPath: string;
  referencePath: string;
  root: string;
}

export async function createVisualEvaluationWorkspace(): Promise<
  VisualEvaluationWorkspace
> {
  const root = await mkdtemp(join(tmpdir(), 'visual-evaluation-'));
  return {
    alignedDevicePath: join(root, 'device.aligned.png'),
    alignedReferencePath: join(root, 'reference.aligned.png'),
    devicePath: join(root, 'device.png'),
    diffPath: join(root, 'diff.png'),
    referencePath: join(root, 'reference.png'),
    root,
  };
}

export async function writeInputImages(
  workspace: VisualEvaluationWorkspace,
  referenceBuffer: Buffer,
  deviceBuffer: Buffer,
): Promise<void> {
  await Promise.all([
    writeFile(workspace.referencePath, referenceBuffer),
    writeFile(workspace.devicePath, deviceBuffer),
  ]);
}

export async function removeVisualEvaluationWorkspace(
  workspace: VisualEvaluationWorkspace,
): Promise<void> {
  await rm(workspace.root, { force: true, recursive: true }).catch(() => {
    // Temporary workspace cleanup is best-effort.
  });
}
