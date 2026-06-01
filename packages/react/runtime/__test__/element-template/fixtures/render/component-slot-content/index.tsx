function CustomComponent(props: { children: any }) {
  return (
    <view>
      <text>custom</text>
      {props.children}
    </view>
  );
}

export function App() {
  return (
    <view>
      <CustomComponent>
        <text>child</text>
      </CustomComponent>
    </view>
  );
}
