import { Feed } from './Feed.jsx';
import { Skeleton } from './Skeleton.jsx';

import './App.css';

export function App() {
  return (
    <view className='App'>
      <text className='Title'>Definitions merged across threads</text>
      <text className='Description'>
        The main thread renders only the skeleton. The feed below exists solely
        in the background build; its snapshot definitions are merged into the
        main thread by id, so applying the first-screen patch no longer throws
        "Snapshot not found".
      </text>
      {__MAIN_THREAD__ ? <Skeleton /> : <Feed />}
    </view>
  );
}
