// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from '@lynx-js/react';
import { Component, useMemo, useRef } from '@lynx-js/react';

interface ListItemComponentAtIndexEventData {
  listID: number;
  childCtxId: number;
}

declare module '@lynx-js/types' {
  export interface ListItemProps {
    bindComponentAtIndex?: (data: ListItemComponentAtIndexEventData) => void;
  }
}

type BuiltInListProps = import('@lynx-js/types').ListProps;
type BuiltInListItemProps = import('@lynx-js/types').ListItemProps;

type ListItemLayoutProps =
  | 'reuse-identifier'
  // | 'full-span'
  | 'item-key'
  | 'sticky-top'
  | 'sticky-bottom'
  // | 'estimated-height'
  | 'estimated-height-px'
  | 'estimated-main-axis-size-px';

type GetItemLayout = Omit<Pick<BuiltInListItemProps, ListItemLayoutProps>, 'key' | 'item-key'>;
type GetItemProps = Omit<BuiltInListItemProps, 'key' | 'item-key' | ListItemLayoutProps>;

export interface ListProps<TData = unknown> {
  /**
   * Render items on-demand. Note when `lazy` is `true`, the `<list/>` will become async, which means "blank space" may appear.
   * @default true
   */
  lazy?: boolean;
  data: TData[];
  listProps?: BuiltInListProps;
  keyExtractor: (item: TData, index: number) => string;
  renderItem: (item: TData, key: string) => ReactNode;
  getItemLayout?: (data: TData, key: string) => GetItemLayout;
  getItemProps?: (item: TData, key: string) => GetItemProps;
}

export function List<TData>(props: ListProps<TData>): ReactNode {
  const { data, listProps, keyExtractor, renderItem, getItemProps, getItemLayout, lazy: __LAZY__ = true } = props;

  const preLazy = useRef(__LAZY__);
  if (__LAZY__ !== preLazy.current) {
    throw new Error('props `lazy` cannot be changed after the first render.');
  }

  if (listProps && ('class' in listProps || 'className' in listProps)) {
    throw new Error('`class` and `className` props are not supported with `listProps`. Use `style` instead.');
  }

  const ListItem = useMemo(() => {
    interface ListItemProps {
      item: TData;
      itemKey: string;
    }

    interface ListItemState {
      isReady: boolean;
    }
    return class ListItem extends Component<ListItemProps, ListItemState> {
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

        const props = getItemProps?.(item, itemKey);
        if (props && ('class' in props || 'className' in props)) {
          throw new Error(
            '`class` and `className` props are not supported with `getItemProps`. Use `style` instead.',
          );
        }

        const layout = getItemLayout?.(item, itemKey);

        if (__LAZY__) {
          return (
            <list-item
              {...props}
              {...layout /* a.k.a. list-platform-info */}
              bindComponentAtIndex={this.onComponentAtIndex}
              data-isReady={isReady}
              item-key={itemKey}
            >
              {isReady && renderItem(item, itemKey)}
            </list-item>
          );
        } else {
          return (
            <list-item
              {...props}
              {...layout /* a.k.a. list-platform-info */}
              item-key={itemKey}
            >
              {renderItem(item, itemKey)}
            </list-item>
          );
        }
      }

      override shouldComponentUpdate(
        nextProps: Readonly<ListItemProps>,
        nextState: Readonly<ListItemState>,
      ): boolean {
        return this.state.isReady !== nextState.isReady
          || this.props.item !== nextProps.item
          || this.props.itemKey !== nextProps.itemKey;
      }
    };
  }, [renderItem, getItemProps, getItemLayout]);

  return (
    <list
      {...listProps}
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
