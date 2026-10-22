// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  FileText,
  Layers,
  MessageSquare,
  Paintbrush,
  Sparkles,
  Tag,
  Zap,
} from '../../components/Icon.js';

const CATEGORY_ICONS: Record<string, typeof Tag> = {
  'OpenUI Chat': MessageSquare,
  'Stack Examples': Layers,
  'Canvas · Web only': Paintbrush,
  'Playground Examples': Layers,
  'A2UI Gallery': Paintbrush,
  'Interactive Examples': Zap,
  'Templates': FileText,
  'Examples': Layers,
  'Markdown + UI': FileText,
  'Action + Mutation': Zap,
  'v0.5': Sparkles,
};

export function ScenarioBadge({ label }: { label?: string }) {
  if (!label) return null;
  const Icon = CATEGORY_ICONS[label] ?? Tag;
  const description = label.startsWith('Canvas') && !label.includes('Web only')
    ? `${label} · Web only`
    : label;
  return (
    <span
      className='scenarioBadge'
      title={description}
      aria-label={description}
    >
      <Icon size={14} aria-hidden='true' />
    </span>
  );
}
