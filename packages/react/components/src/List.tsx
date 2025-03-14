// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import { Component } from '@lynx-js/react';
import type { ListItemProps as BuiltInListItemProps, ListProps as BuiltInListProps } from '@lynx-js/types';

interface ListItemComponentAtIndexEventData {
  listID: number;
  childCtxId: number;
}

declare module '@lynx-js/types' {
  export interface ListItemProps {
    bindComponentAtIndex?: (data: ListItemComponentAtIndexEventData) => void;
  }
}

export interface ListProps<TData = unknown> {
  data: TData[];
  renderItem: (item: TData, key: string) => ReactNode;
  keyExtractor: (item: TData, index: number) => string;
  reuseIdentifierExtractor?: (item: TData) => string;
  getItemProps?: (item: TData, key: string) => Omit<BuiltInListItemProps, 'key' | 'item-key' | 'reuse-identifier'>;
  listProps?: BuiltInListProps;
}

export function List<TData>(props: ListProps<TData>): ReactNode {
  interface ListItemProps {
    item: TData;
    itemKey: string;
  }

  interface ListItemState {
    isReady: boolean;
  }

  class ListItem extends Component<ListItemProps, ListItemState> {
    override state = {
      isReady: false,
    };

    onComponentAtIndex = (data: ListItemComponentAtIndexEventData) => {
      const { listID, childCtxId } = data;
      this.setState({ isReady: true }, () => {
        // @ts-expect-error it's a native method
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        lynx.getNativeApp().callLepusMethod('rLynxOnListItemReady', { listID, childCtxId });
      });
    };

    override render() {
      const { item, itemKey } = this.props;
      const { isReady } = this.state;

      const props = getItemProps?.(item, itemKey) ?? {};

      return (
        <list-item
          {...props}
          bindComponentAtIndex={this.onComponentAtIndex}
          data-isReady={isReady}
          reuse-identifier={reuseIdentifierExtractor?.(item)}
          item-key={itemKey}
        >
          {isReady && renderItem(item, itemKey)}
        </list-item>
      );
    }

    override shouldComponentUpdate(
      nextProps: Readonly<ListItemProps>,
      nextState: Readonly<ListItemState>,
    ): boolean {
      return this.state.isReady !== nextState.isReady
        || this.props.item !== nextProps.item
        || this.props.itemKey !== nextProps.itemKey;
    }
  }

  const { data, renderItem, keyExtractor, reuseIdentifierExtractor, getItemProps } = props;

  return (
    <list
      {...props.listProps}
      experimental-disable-platform-implementation={true}
      custom-list-name={'list-container'}
    >
      {data.map((item, index) => {
        const key = keyExtractor(item, index);
        return (
          <ListItem
            key={key}
            itemKey={key}
            item={item}
          />
        );
      })}
    </list>
  );
}
