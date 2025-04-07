import React, { useRef, useState, useEffect } from 'react';
import {
  FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand,
} from 'react-icons/fa';
import { MdSlowMotionVideo } from 'react-icons/md';

function VideoPlayer({ src, markers = [] }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const timeDisplayRef = useRef(null);
  const segmentRefs = useRef([]);
  const clickTimeoutRef = useRef(null);
  const fullscreenControlTimerRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [muted, setMuted] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);

  // Для двойного клика с ускорением
  const lastDoubleTapTimeRef = useRef(0);
  const doubleTapCountRef = useRef(0);
  const DOUBLE_TAP_THRESHOLD = 500; // мс
  const BASE_SKIP = 10; // секунд
  const ACCELERATION_STEP = 5; // секунд

  // Восстанавливаем сохранённое время при монтировании
  useEffect(() => {
    const savedTime = localStorage.getItem(`video-progress-${src}`);
    if (savedTime && videoRef.current) {
      videoRef.current.currentTime = parseFloat(savedTime);
    }
  }, [src]);

  // После загрузки метаданных получаем длительность и вычисляем сегменты
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      setDuration(d);
      const segs = getSegments(d, markers);
      setSegments(segs);
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.muted = muted;
    }
  };

  // Формирование сегментов (глав) из markers
  function getSegments(duration, markers) {
    if (!duration) return [];
    let sorted = [...markers].sort((a, b) => a.time - b.time);
    if (sorted.length === 0 || sorted[0].time > 0) {
      sorted.unshift({ time: 0, label: sorted[0]?.label || 'Начало' });
    }
    if (sorted[sorted.length - 1].time < duration) {
      sorted.push({ time: duration, label: 'Конец' });
    }
    const segs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      segs.push({
        startTime: sorted[i].time,
        endTime: sorted[i + 1].time,
        label: sorted[i].label,
      });
    }
    return segs;
  }

  // Play/Pause переключение
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleSpeedChange = (e) => {
    const newRate = parseFloat(e.target.value);
    setPlaybackRate(newRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Императивное обновление заливки сегментов и отображения времени
  useEffect(() => {
    let rafId;
    const updateProgress = () => {
      if (videoRef.current) {
        const current = videoRef.current.currentTime;
        localStorage.setItem(`video-progress-${src}`, current);
        segments.forEach((seg, index) => {
          const fillEl = segmentRefs.current[index];
          if (fillEl) {
            let fillPercent = 0;
            if (current >= seg.endTime) {
              fillPercent = 100;
            } else if (current <= seg.startTime) {
              fillPercent = 0;
            } else {
              fillPercent =
                ((current - seg.startTime) / (seg.endTime - seg.startTime)) * 100;
            }
            fillEl.style.width = `${fillPercent}%`;
          }
        });
        if (timeDisplayRef.current) {
          timeDisplayRef.current.innerText = formatTime(current);
        }
      }
      rafId = requestAnimationFrame(updateProgress);
    };
    rafId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(rafId);
  }, [segments, src]);

  // Свободная перемотка по клику на прогресс-баре
  const handleProgressBarClick = (e) => {
    if (!videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    videoRef.current.currentTime = newTime;
    localStorage.setItem(`video-progress-${src}`, newTime);
  };

  // Обработка одиночного клика по видео для play/pause с задержкой
  const handleVideoClick = () => {
    if (clickTimeoutRef.current) return;
    clickTimeoutRef.current = setTimeout(() => {
      togglePlay();
      clickTimeoutRef.current = null;
    }, 250);
  };

  // Обработка двойного клика для перемотки с ускорением
  const handleDoubleClick = (e) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (!videoRef.current) return;
    const now = Date.now();
    if (now - lastDoubleTapTimeRef.current < DOUBLE_TAP_THRESHOLD) {
      doubleTapCountRef.current += 1;
    } else {
      doubleTapCountRef.current = 1;
    }
    lastDoubleTapTimeRef.current = now;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftSide = clickX < rect.width / 2;
    const skipAmount =
      BASE_SKIP + (doubleTapCountRef.current - 1) * ACCELERATION_STEP;
    let newTime = videoRef.current.currentTime;
    if (isLeftSide) {
      newTime = Math.max(newTime - skipAmount, 0);
    } else {
      newTime = Math.min(newTime + skipAmount, duration);
    }
    videoRef.current.currentTime = newTime;
    localStorage.setItem(`video-progress-${src}`, newTime);
  };

  // Переход в полноэкранный режим через контейнер
  const handleFullScreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  };

  // Обработчик события изменения полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement === containerRef.current) {
        setIsFullscreen(true);
        setShowFullscreenControls(true);
        resetFullscreenControlTimer();
      } else {
        setIsFullscreen(false);
        if (fullscreenControlTimerRef.current) {
          clearTimeout(fullscreenControlTimerRef.current);
          fullscreenControlTimerRef.current = null;
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Сброс таймера скрытия панели в полноэкранном режиме
  const resetFullscreenControlTimer = () => {
    if (fullscreenControlTimerRef.current) {
      clearTimeout(fullscreenControlTimerRef.current);
    }
    fullscreenControlTimerRef.current = setTimeout(() => {
      setShowFullscreenControls(false);
    }, 3000);
  };

  // При движении мыши или касании в полноэкранном режиме – показать панель и сбросить таймер
  const handleFullscreenActivity = () => {
    if (isFullscreen) {
      setShowFullscreenControls(true);
      resetFullscreenControlTimer();
    }
  };

  return (
    <div
      style={{
        maxWidth: 800,
        width: '100%',
        margin: '20px auto',
        fontFamily: 'Segoe UI, sans-serif',
      }}
    >
      <style>{`
        .chapter-segment {
          position: absolute;
          height: 100%;
          background-color: #999;
          border-right: 2px solid #fff;
          box-sizing: border-box;
          cursor: pointer;
          transform-origin: center bottom;
          transition: transform 0.2s;
          overflow: visible;
        }
        .chapter-segment:hover {
          transform: scaleY(1.2);
        }
        .chapter-fill {
          height: 100%;
          background-color: rgb(108, 134, 249);
          width: 0%;
        }
        .chapter-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translate(-50%, -4px);
          background: rgba(0,0,0,0.8);
          color: #fff;
          padding: 4px 6px;
          border-radius: 4px;
          white-space: nowrap;
          font-size: 12px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .chapter-segment:hover .chapter-tooltip {
          opacity: 1;
        }
        .speed-select {
          background: #222;
          border: none;
          border-radius: 4px;
          color: #fff;
          padding: 2px 4px;
          cursor: pointer;
          font-size: 14px;
        }
      `}</style>

      {/* Контейнер видео + (при полноэкранном режиме) оверлей с элементами управления */}
      <div
        ref={containerRef}
        style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleFullscreenActivity}
        onTouchStart={handleFullscreenActivity}
      >
        <video
          ref={videoRef}
          src={src}
          width="100%"
          controls={false}
          onLoadedMetadata={handleLoadedMetadata}
          style={{ display: 'block', width: '100%' }}
        />

        {/* Оверлей панели управления для полноэкранного режима */}
        {isFullscreen && showFullscreenControls && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0,0,0,0.7)',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Прогресс-бар */}
            <div
              ref={progressBarRef}
              style={{
                position: 'relative',
                height: '8px',
                background: '#666',
                borderRadius: '4px',
                cursor: 'pointer',
                overflow: 'visible',
              }}
              onClick={handleProgressBarClick}
            >
              {segments.map((seg, index) => {
                const leftPercent = (seg.startTime / duration) * 100;
                const widthPercent =
                  ((seg.endTime - seg.startTime) / duration) * 100;
                return (
                  <div
                    key={index}
                    className="chapter-segment"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  >
                    <div
                      className="chapter-fill"
                      ref={(el) => (segmentRefs.current[index] = el)}
                    />
                    <div className="chapter-tooltip">
                      {seg.label} ({formatTime(seg.startTime)})
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Панель управления */}
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '14px',
                  color: '#fff',
                }}
              >
                <span ref={timeDisplayRef}>0:00</span>
                <span>/ {formatTime(duration)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={togglePlay}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '18px',
                  }}
                >
                  {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                  }}
                >
                  <MdSlowMotionVideo size={18} />
                  <select
                    className="speed-select"
                    value={playbackRate}
                    onChange={handleSpeedChange}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
                <button
                  onClick={toggleMute}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '18px',
                  }}
                >
                  {muted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
                <button
                  onClick={handleFullScreen}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '18px',
                  }}
                >
                  <FaExpand />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Обычная панель управления (не в полноэкранном режиме) */}
      {!isFullscreen && (
        <div style={{ marginTop: '12px' }}>
          <div
            ref={progressBarRef}
            style={{
              position: 'relative',
              height: '8px',
              background: '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              overflow: 'visible',
            }}
            onClick={handleProgressBarClick}
          >
            {segments.map((seg, index) => {
              const leftPercent = (seg.startTime / duration) * 100;
              const widthPercent =
                ((seg.endTime - seg.startTime) / duration) * 100;
              return (
                <div
                  key={index}
                  className="chapter-segment"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                >
                  <div
                    className="chapter-fill"
                    ref={(el) => (segmentRefs.current[index] = el)}
                  />
                  <div className="chapter-tooltip">
                    {seg.label} ({formatTime(seg.startTime)})
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.7)',
              padding: '8px 12px',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '14px',
                color: '#fff',
              }}
            >
              <span ref={timeDisplayRef}>0:00</span>
              <span>/ {formatTime(duration)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={togglePlay}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                <MdSlowMotionVideo size={18} />
                <select className="speed-select" value={playbackRate} onChange={handleSpeedChange}>
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                {muted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
              <button
                onClick={handleFullScreen}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                <FaExpand />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
