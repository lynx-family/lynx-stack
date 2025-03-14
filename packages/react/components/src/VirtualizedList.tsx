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
    bindEnqueueComponent?: () => void;
  }
}

type BuiltInListProps = import('@lynx-js/types').ListProps;
type BuiltInListItemProps = import('@lynx-js/types').ListItemProps;

type ListItemLayoutProps =
  | 'full-span'
  | 'item-key'
  | 'sticky-top'
  | 'sticky-bottom'
  | 'estimated-height'
  | 'estimated-height-px'
  | 'estimated-main-axis-size-px';

type GetItemLayout = Omit<Pick<BuiltInListItemProps, ListItemLayoutProps>, 'key' | 'item-key' | 'reuse-identifier'>;
type GetItemProps = Omit<BuiltInListItemProps, 'key' | 'item-key' | 'reuse-identifier' | ListItemLayoutProps>;

export interface ListProps<TData = unknown> {
  /**
   * Render items on-demand. Note when `lazy` is `true`, the `<list/>` will become async, which means "blank space" may appear.
   * @default true
   */
  lazy?: boolean;
  data: TData[];
  listProps?: BuiltInListProps;
  keyExtractor: (item: TData, index: number) => string;
  reuseIdentifierExtractor: (item: TData, key: string) => string;
  renderItem: (item: TData, key: string) => ReactNode;
  getItemLayout?: (data: TData, key: string) => GetItemLayout;
  getItemProps?: (item: TData, key: string) => GetItemProps;
}

export function VirtualizedList<TData>(props: ListProps<TData>): ReactNode {
  const {
    data,
    listProps,
    keyExtractor,
    reuseIdentifierExtractor,
    renderItem,
    getItemProps,
    getItemLayout,
    lazy: __LAZY__ = true,
  } = props;

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

      onEnqueueComponent = () => {
        this.setState({ isReady: false });
      };

      override render() {
        const { item, itemKey } = this.props;
        const { isReady } = this.state;

        let props: GetItemProps | undefined;
        {
          if (__LAZY__) {
            props = isReady ? getItemProps?.(item, itemKey) : undefined;
          } else {
            props = getItemProps?.(item, itemKey);
          }
          if (props && ('class' in props || 'className' in props)) {
            throw new Error(
              '`class` and `className` props are not supported with `getItemProps`. Use `style` instead.',
            );
          }
        }
        const layout = getItemLayout?.(item, itemKey);
        const reuseIdentifier = reuseIdentifierExtractor?.(item, itemKey);

        if (__LAZY__) {
          return (
            <list-item
              {...props}
              {...layout /* a.k.a. list-platform-info */}
              bindComponentAtIndex={this.onComponentAtIndex}
              bindEnqueueComponent={this.onEnqueueComponent}
              data-isReady={isReady}
              item-key={itemKey}
              reuse-identifier={reuseIdentifier}
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
              reuse-identifier={reuseIdentifier}
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
  }, [reuseIdentifierExtractor, renderItem, getItemProps, getItemLayout]);

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
