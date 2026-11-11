// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Icon as IconDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/material-icons.css';
import '../../../styles/catalog/Icon.css';

function toMaterialName(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

export const Icon: DefinedComponent<typeof IconDefinition.props> = {
  ...IconDefinition,
  component: ({ props }) => {
    const size = props.size ?? 'md';
    const color = props.color ?? 'inherit';
    const sizeClass = size === 'sm'
      ? 'OpenUIIconSm'
      : (size === 'lg'
        ? 'OpenUIIconLg'
        : 'OpenUIIconMd');
    const colorClass = color === 'primary'
      ? 'OpenUIIconColorPrimary'
      : (color === 'muted'
        ? 'OpenUIIconColorMuted'
        : 'OpenUIIconColorInherit');
    return (
      <text className={`OpenUIIcon ${sizeClass} ${colorClass}`}>
        {toMaterialName(props.name)}
      </text>
    );
  },
};
