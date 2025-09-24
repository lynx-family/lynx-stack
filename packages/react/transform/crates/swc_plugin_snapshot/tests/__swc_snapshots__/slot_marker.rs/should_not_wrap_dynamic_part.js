<view className="parent">
  <view className="child"/>
  <view className="child"/>
</view>;
<view className="parent">
  <view className="child">
  </view>
  <view className="child">
  </view>
</view>;
<view className="parent">
  <view className="child">
    { /** foo */ }
  </view>
  <view className="child">
    { /** bar */ }
  </view>
</view>;
// TODO: fix the redundant <internal-slot> here
<view className="parent">
  <internal-slot><view className="child">{[].map(()=>null)}</view></internal-slot>
  <internal-slot><view className="child">{[].map(()=>null)}</view></internal-slot>
</view>;
<view style={{
    color: "red",
    'height': "100px",
    flexShrink: 1
}}>
</view>;
