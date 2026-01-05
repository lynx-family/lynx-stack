import Inner from './inner.jsx';
export default function Outer(props) {
  return (
    <view id='root-outer'>
      <view id='view-outer' class='class-1'></view>
      <Inner id='inner-outer' class='inner-1'>
        <view id='view-slot-outer'></view>
      </Inner>
      <view id='view-outer-fixed' style='position:fixed'></view>
      {props.children}
    </view>
  );
}
