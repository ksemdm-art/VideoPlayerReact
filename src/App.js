import React from 'react';
import VideoPlayer from './VideoPlayer';

function App() {
  const videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  // Пример маркеров, передаваемых в компонент:
  const markers = [
    { time: 20, label: 'Начало' },
    { time: 45, label: 'Ключевой момент' },
    { time: 120, label: 'Финал' }
  ];
  
  return (
    <div>
      <VideoPlayer src={videoUrl} markers={markers} />
    </div>
  );
}

export default App;
