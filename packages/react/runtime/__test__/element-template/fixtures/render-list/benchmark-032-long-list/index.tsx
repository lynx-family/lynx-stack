const colors = ['#FF0033', '#F76A4F', '#F4CB5F', '#AEADB2', '#00A6FF', '#33CC66'];

export function App() {
  const renderContent = () => (
    <list
      style={{
        height: '100%',
        width: '100%',
      }}
      custom-list-name='list-container'
      experimental-disable-platform-implementation={true}
    >
      {colors.map((color, index) => (
        <list-item item-key={index.toString()}>
          <view
            style={{
              backgroundColor: color,
              height: '16.8px',
            }}
          >
            <text>{index}</text>
          </view>
        </list-item>
      ))}
    </list>
  );

  return (
    <view style={{ width: '100%', height: '100%' }}>
      {renderContent()}
    </view>
  );
}
