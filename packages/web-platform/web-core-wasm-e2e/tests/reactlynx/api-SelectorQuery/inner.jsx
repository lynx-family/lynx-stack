export default function Outer(props) {
  return (
    <view id='root-inner'>
      <view id='view-inner' class='class-1'>
        {' '}
      </view>
      {props.children}
    </view>
  );
}
