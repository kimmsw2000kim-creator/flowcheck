import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { UIUXTestDefect } from '../../api/UIUXTestApi';
import './CustomVideoPlayer.css';

interface CustomVideoPlayerProps {
  src: string;
  defects?: UIUXTestDefect[];
  onTimeUpdate?: (currentTime: number) => void;
  activeDefectId?: number | null;
  onDefectClick?: (offset: number) => void;
}

export interface CustomVideoPlayerRef {
  seekTo: (time: number) => void;
}

const CustomVideoPlayer = forwardRef<CustomVideoPlayerRef, CustomVideoPlayerProps>(({ src, defects = [], onTimeUpdate, activeDefectId, onDefectClick }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        if (!isPlaying) {
          videoRef.current.play().catch(console.error);
          setIsPlaying(true);
        }
      }
    }
  }));

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
      if (onTimeUpdate) onTimeUpdate(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTo = parseFloat(e.target.value);
    if (videoRef.current) {
      const newTime = (seekTo / 100) * duration;
      videoRef.current.currentTime = newTime;
      setProgress(seekTo);
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const handleMouseLeave = () => {
    if (isPlaying) setShowControls(false);
  };

  return (
    <div 
      className={`custom-video-container ${!showControls ? 'hide-cursor' : ''}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        className="custom-video-element"
        onClick={togglePlay}
        muted={isMuted}
        autoPlay
      />

      <div className={`video-controls-overlay ${showControls ? 'show' : 'hide'}`}>
        <div className="video-progress-container">
          <input
            type="range"
            className="video-progress-bar"
            value={progress || 0}
            onChange={handleSeek}
            min="0"
            max="100"
            step="0.1"
            style={{ backgroundSize: `${progress}% 100%` }}
          />
          {defects.map((defect) => {
            const leftPos = (defect.timestampOffset / duration) * 100;
            const isHovered = activeDefectId === defect.id;
            let markerColor = '#eab308';
            if (defect.severity === 'CRITICAL') markerColor = '#ef4444';
            else if (defect.severity === 'MAJOR') markerColor = '#f59e0b';
            
            return (
              <div 
                key={defect.id}
                className={`defect-marker ${isHovered ? 'active' : ''}`}
                style={{ 
                  left: `${leftPos}%`,
                  backgroundColor: markerColor
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    videoRef.current.currentTime = defect.timestampOffset;
                    if (onDefectClick) onDefectClick(defect.timestampOffset);
                  }
                }}
                title={`${defect.severity}: ${defect.category}`}
              >
                {isHovered && (
                  <div className="defect-marker-tooltip">
                    <div className="tooltip-title">{defect.category}</div>
                    <div className="tooltip-desc">{defect.description}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="video-controls-row">
          <div className="video-controls-left">
            <button className="control-btn" onClick={togglePlay}>
              {isPlaying ? '일시정지' : '재생'}
            </button>
            <button className="control-btn" onClick={toggleMute}>
              {isMuted ? '음소거 해제' : '음소거'}
            </button>
            <div className="video-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          <div className="video-controls-right">
            <button className="control-btn" onClick={toggleFullscreen}>
              전체화면
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CustomVideoPlayer;
