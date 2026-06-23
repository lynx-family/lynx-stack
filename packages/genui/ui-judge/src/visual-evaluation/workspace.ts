// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface VisualEvaluationWorkspace {
  alignedReferencePath: string;
  alignedRenderedPath: string;
  diffPath: string;
  referencePath: string;
  renderedPath: string;
  root: string;
}

export async function createVisualEvaluationWorkspace(): Promise<
  VisualEvaluationWorkspace
> {
  const root = await mkdtemp(join(tmpdir(), 'visual-evaluation-'));
  return {
    alignedReferencePath: join(root, 'reference.aligned.png'),
    alignedRenderedPath: join(root, 'rendered.aligned.png'),
    diffPath: join(root, 'diff.png'),
    referencePath: join(root, 'reference.png'),
    renderedPath: join(root, 'rendered.png'),
    root,
  };
}

export async function writeInputImages(
  workspace: VisualEvaluationWorkspace,
  referenceBuffer: Buffer,
  renderedBuffer: Buffer,
): Promise<void> {
  await Promise.all([
    writeFile(workspace.referencePath, referenceBuffer),
    writeFile(workspace.renderedPath, renderedBuffer),
  ]);
}

export async function removeVisualEvaluationWorkspace(
  workspace: VisualEvaluationWorkspace,
): Promise<void> {
  await rm(workspace.root, { force: true, recursive: true }).catch(() => {
    // Temporary workspace cleanup is best-effort.
  });
}
