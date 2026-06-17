import type { ReactNode } from 'react';

import {
  cloneElement,
  createElement,
  useCallback,
  useEffect,
  useState,
} from '@lynx-js/react';

import './App.css';

function DynamicTag(props: {
  tag: string;
  children: ReactNode;
  bindtap?: () => void;
  className?: string;
  style?: Record<string, string | number>;
}) {
  const { tag, children, ...rest } = props;
  return createElement(tag, rest, children);
}

function ClonePanel(props: {
  bindtap?: () => void;
  children?: ReactNode;
  className: string;
  title: string;
}) {
  const tapProps = props.bindtap ? { bindtap: props.bindtap } : {};
  return (
    <view className={props.className} {...tapProps}>
      <text className='CloneTitle'>{props.title}</text>
      {props.children}
    </view>
  );
}

export function App() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const onTap = useCallback(() => {
    'background-only';
    setCount(count + 1);
  }, [count]);

  const onDynamicViewTap = useCallback(() => {
    'background-only';
    setCount(count + 2);
  }, [count]);

  const onDynamicTextTap = useCallback(() => {
    'background-only';
    setCount(count + 3);
  }, [count]);

  const onCloneNodeTap = useCallback(() => {
    'background-only';
    setCount(count + 4);
  }, [count]);

  const onCloneComponentTap = useCallback(() => {
    'background-only';
    setCount(count + 5);
  }, [count]);

  const viewElement = (
    <view className='CloneCard'>
      <text className='CloneBody'>Original view node: {count}</text>
    </view>
  );
  const clonedViewElement = cloneElement(viewElement, {
    bindtap: onCloneNodeTap,
    className: 'CloneCard CloneNode',
  });

  const componentElement = (
    <ClonePanel className='CloneCard' title='Original component'>
      <text className='CloneBody'>Component child: {count}</text>
    </ClonePanel>
  );
  const clonedComponentElement = cloneElement(componentElement, {
    bindtap: onCloneComponentTap,
    className: 'CloneCard CloneComponent',
    title: 'Cloned component',
  }, <text className='CloneBody'>Replaced component child: {count}</text>);

  return (
    <view>
      <view className='App'>
        <text
          className='Content'
          bindtap={onTap}
          style={{ marginBottom: '50px' }}
        >
          Count: {count}
        </text>
        <DynamicTag tag='view' bindtap={onDynamicViewTap}>
          <text className='Content'>Dynamic view: {count}</text>
          {count > 10 && <text className='Content'>------------------</text>}
        </DynamicTag>
        <DynamicTag
          tag='text'
          className='Content'
          bindtap={onDynamicTextTap}
          style={{ height: '50px' }}
        >
          <text className='Content'>Dynamic text: {count}</text>
        </DynamicTag>
        <view className='CloneSection'>
          <text className='SectionTitle'>viewElement</text>
          {viewElement}
          <text className='SectionTitle'>clonedViewElement</text>
          {clonedViewElement}
          <text className='SectionTitle'>componentElement</text>
          {componentElement}
          <text className='SectionTitle'>clonedComponentElement</text>
          {clonedComponentElement}
        </view>
      </view>
    </view>
  );
}
