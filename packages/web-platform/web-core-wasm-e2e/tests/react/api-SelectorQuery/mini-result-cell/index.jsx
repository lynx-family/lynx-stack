import './index.css';

export default function(props) {
  return (
    <view class='result-root' flatten='false'>
      {props.desc && (
        <view class='result-cell' flatten='false'>
          <text class='desc' flatten='false'>
            {props.desc}
          </text>
        </view>
      )}
      <view class='result-cell' flatten='false'>
        {props.result
          ? (
            <view class='succ' flatten='false'>
              <text
                style='color:#fff'
                lynx-test-tag={'result' + props.idx}
                flatten='false'
              >
                {props.text ? props.text : '通过'}
              </text>
            </view>
          )
          : (
            <view class='err' flatten='false'>
              <text
                style='color:#fff'
                lynx-test-tag={'result' + props.idx}
                flatten='false'
              >
                {props.text ? props.text : '失败'}
              </text>
            </view>
          )}
      </view>
    </view>
  );
}
