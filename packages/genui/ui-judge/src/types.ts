// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Page } from '@playwright/test';

export type UiJudgeDimension =
  | 'visual-correctness'
  | 'usability-interaction'
  | 'visual-aesthetics'
  | 'consistency-standards'
  | 'architecture-writing'
  | 'accessibility-performance';

export type UiJudgeScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface JudgePageOptions {
  dimension?: UiJudgeDimension;
  page: Page;
  reference?: string;
  steps?: string[];
  task: string;
  timeoutMs?: number;
}

export interface KittenLynxJudgePage {
  screenshot(options?: {
    format?: 'jpeg' | 'png' | 'webp';
    path?: string;
    quality?: number;
  }): Promise<Buffer>;
  url(): string;
}

export interface JudgeAndroidAgentOptions {
  dimension?: UiJudgeDimension;
  page: KittenLynxJudgePage;
  reference?: string;
  steps?: string[];
  task: string;
  timeoutMs?: number;
}

export interface UiJudgeError {
  message: string;
}

export interface UiJudgeResult {
  dimension: UiJudgeDimension;
  error?: UiJudgeError;
  score: UiJudgeScore;
  steps: string[];
  url: string;
}

export interface NormalizedJudgeOptions {
  dimension: UiJudgeDimension;
  reference?: string;
  steps: string[];
  task: string;
  timeoutMs: number;
}

export interface NormalizedJudgePageOptions extends NormalizedJudgeOptions {
  page: Page;
}

export interface NormalizedJudgeAndroidAgentOptions
  extends NormalizedJudgeOptions
{
  page: KittenLynxJudgePage;
}
