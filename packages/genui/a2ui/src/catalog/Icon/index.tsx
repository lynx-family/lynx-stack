// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Icon.css';

function toMaterialName(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/**
 * @a2uiCatalog Icon
 */
export interface IconProps extends GenericComponentProps {
  /** Material icon name (camelCase or snake_case), e.g. "info", "skipNext", "play_arrow". */
  name: string | { path: string };
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'muted' | 'inherit';
}

export function Icon(
  props: IconProps,
): import('@lynx-js/react').ReactNode {
  const { id, name, size = 'md', color = 'inherit' } = props;
  const iconName = toMaterialName(name as string);

  return (
    <text
      key={id}
      className={`a2ui-icon a2ui-icon-${size} a2ui-icon-color-${color}`}
    >
      {iconName}
    </text>
  );
}
