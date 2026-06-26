// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Centralized Lucide icon re-exports. Two reasons to funnel through this file:
// 1. Picking icons from one list keeps the visual vocabulary consistent — same
//    stroke weight, same metaphor library, no one-off emojis sneaking back in.
// 2. Tree-shaking still works because each icon is a named export.
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Copy,
  History,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Moon,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Copy,
  History,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Moon,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
};

export type IconProps = LucideProps;

// Size convention paired with Button sizes. Icons sit ~2px under cap height so
// they never visually outweigh the label.
export const ICON_SIZE = {
  sm: 14,
  md: 15,
  lg: 16,
  xl: 18,
} as const;
