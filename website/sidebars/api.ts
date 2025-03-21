// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ApiDeclaredItem,
  ApiItemKind,
  ApiModel,
} from '@microsoft/api-extractor-model';
import type { ApiItem } from '@microsoft/api-extractor-model';
import type { SidebarGroup } from '@rspress/shared';
import { pascalCase } from 'change-case';

function transformSingle(
  apiModel: ApiModel,
  apiItem: ApiItem,
  prefix: string,
  depth: number,
): SidebarGroup {
  if (apiItem.kind === ApiItemKind.Enum) {
    // The children of an Enum will be 404
    // Explicitly ignore here
    return {
      text: apiItem.displayName,
      link: `${prefix}.${apiItem.displayName.toLowerCase()}`,
      items: [],
    };
  }

  // A Constructor has no report.name and children
  // It uses ._constructor_ as suffix
  if (apiItem.kind === ApiItemKind.Constructor) {
    return {
      link: `${prefix}._constructor_`,
      text: apiItem.kind,
      items: [],
    };
  }

  if (apiItem instanceof ApiDeclaredItem) {
    const children = apiItem.excerptTokens
      .filter(item => item.canonicalReference)
      .map(
        item => {
          const { resolvedApiItem } = apiModel.resolveDeclarationReference(
            item.canonicalReference!,
            apiItem,
          );
          if (
            resolvedApiItem
            && resolvedApiItem.displayName !== apiItem.displayName
          ) {
            return resolvedApiItem;
          }
          return null;
        },
      )
      .filter(i => i !== null);

    if (children.length > 0) {
      const link = `${prefix}.${apiItem.displayName.toLowerCase()}`;

      const childNameSet = new Set();
      const items = children.flatMap(child => {
        // Only add the non-exists members
        const members = child.members.filter(member =>
          !childNameSet.has(member.displayName)
        );
        // Mark current members as exists
        child.members.forEach(member => {
          childNameSet.add(member.displayName);
        });
        return transform(
          apiModel,
          members,
          `${prefix.split('.')[0]}.${child?.displayName.toLowerCase()}`,
          depth + 1,
        );
      })
        .filter(i => i !== null);

      return {
        link,
        text: apiItem.displayName,
        items,
        collapsible: items.length > 0,
      };
    }
  }

  if (apiItem.displayName) {
    const link = `${prefix}.${apiItem.displayName.toLowerCase()}`;
    return {
      link,
      text: apiItem.displayName,
      items: transform(apiModel, apiItem.members, link, depth - 1),
    };
  }

  throw new Error(`Unsupported report kind: ${apiItem.kind}`);
}

function transform(
  apiModel: ApiModel,
  apiItems: readonly ApiItem[] | undefined,
  prefix: string,
  depth: number,
): SidebarGroup[] {
  if (!apiItems) {
    return [];
  }

  if (depth === 0) {
    return [];
  }

  const s = new Set<string>();

  return apiItems
    .map(report => {
      const { text, link, items } = transformSingle(
        apiModel,
        report,
        prefix,
        depth,
      );

      if (s.has(text)) {
        return null;
      }

      s.add(text);

      return {
        text,
        link: link!,
        collapsed: depth < 3,
        // Force non-collapsible when no children
        collapsible: (depth >= 2 && items.length > 0),
        items,
      };
    })
    .filter(item => item !== null);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createAPI(options: {
  name: string;
  base?: string;
  collapsed?: boolean;
  collapsible?: boolean;
  depth?: number;
  skips?: string[] | undefined;
  text?: string;
}): SidebarGroup {
  const {
    base = 'api',
    name,
    collapsed = true,
    collapsible = true,
    depth = 2,
    skips = [],
    text = pascalCase(name),
  } = options;
  const s = new Set(skips);
  const apiModel = new ApiModel();

  const apiPackage = apiModel.loadPackage(
    path.join(__dirname, '..', 'temp', `${name}.api.json`),
  );

  const items = apiPackage.members[0]!.members.filter(({ displayName }) =>
    !s.has(displayName)
  );
  const link = `${base}/${name}`;

  return {
    collapsed,
    collapsible,
    link,
    text,
    items: transform(apiModel, items, link, depth),
  };
}
