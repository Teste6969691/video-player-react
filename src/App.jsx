import { useEffect, useMemo, useRef, useState } from 'react';
import './app.css';

const MAX_VIDEO_INDEX = 92;
const VIDEOS_PER_PAGE = 8;

function formatDuration(time) {
  if (!Number.isFinite(time)) return '0:00';
  const seconds = Math.floor(time % 60);
  const minutes = Math.floor(time / 60) % 60;
  const hours = Math.floor(time / 3600);
  const leadingZeroFormatter = new Intl.NumberFormat(undefined, { minimumIntegerDigits: 2 });

  if (hours === 0) {
    return `${minutes}:${leadingZeroFormatter.format(seconds)}`;
  }

  return `${hours}:${leadingZeroFormatter.format(minutes)}:${leadingZeroFormatter.format(seconds)}`;
}

function getVideoSrc(index) {
  return `/videos/video${index}.mp4`;
}

function getThumbnailSrc(index) {
  return `/images/image${index}.png`;
}

function findVideoIndexByName(name) {
  const normalizedName = name.toLowerCase();
  for (let i = 1; i <= MAX_VIDEO_INDEX; i += 1) {
    if (`video${i}`.includes(normalizedName)) return i;
  }
  return null;
}

export default function App() {
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const controlsRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [videoTitle, setVideoTitle] = useState('Video 1');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [isRandomActive, setIsRandomActive] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [progressPosition, setProgressPosition] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState('high');
  const [videoQueue, setVideoQueue] = useState(() => Array.from({ length: MAX_VIDEO_INDEX }, (_, index) => index + 1));
  const [randomHistory, setRandomHistory] = useState([]);

  const totalPages = Math.ceil(MAX_VIDEO_INDEX / VIDEOS_PER_PAGE);

  const visibleVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE + 1;
    const endIndex = Math.min(startIndex + VIDEOS_PER_PAGE - 1, MAX_VIDEO_INDEX);
    return Array.from({ length: endIndex - startIndex + 1 }, (_, index) => startIndex + index);
  }, [currentPage]);

  const loadVideo = (index) => {
    const safeIndex = Math.min(Math.max(1, index), MAX_VIDEO_INDEX);
    setCurrentVideoIndex(safeIndex);
    setVideoTitle(`Video ${safeIndex}`);
    if (videoRef.current) {
      videoRef.current.src = getVideoSrc(safeIndex);
      videoRef.current.load();
      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => undefined);
      }
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    loadVideo(1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const handleLoadedData = () => {
      setDuration(video.duration || 0);
      setCurrentTime(0);
      setProgressPosition(0);
      if (video.muted || video.volume === 0) {
        setVolumeLevel('muted');
      } else if (video.volume >= 0.5) {
        setVolumeLevel('high');
      } else {
        setVolumeLevel('low');
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgressPosition(video.duration ? video.currentTime / video.duration : 0);
    };

    const handleEnded = () => {
      if (isRandomActive) {
        getRandomVideo();
      } else {
        const nextIndex = currentVideoIndex < MAX_VIDEO_INDEX ? currentVideoIndex + 1 : 1;
        loadVideo(nextIndex);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      const nextVolume = video.volume;
      setVolume(nextVolume);
      setIsMuted(video.muted);
      if (video.muted || nextVolume === 0) {
        setVolumeLevel('muted');
      } else if (nextVolume >= 0.5) {
        setVolumeLevel('high');
      } else {
        setVolumeLevel('low');
      }
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [currentVideoIndex, isRandomActive]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tagName = document.activeElement?.tagName?.toLowerCase();
      if (tagName === 'input') return;

      switch (event.key.toLowerCase()) {
        case ' ':
          if (tagName === 'button') return;
        case 'k':
          togglePlay();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'arrowleft':
        case 'j':
          skip(-5);
          break;
        case 'arrowright':
        case 'l':
          skip(5);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentVideoIndex, isPlaying, isMuted, volume, isLoopActive, isRandomActive]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const skip = (amount) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + amount), video.duration || 0);
  };

  const toggleFullscreen = () => {
    const videoContainer = controlsRef.current?.closest('.video-container');
    if (!videoContainer) return;
    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen();
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = window.setTimeout(() => {
        if (!videoRef.current?.paused) {
          controlsRef.current.style.opacity = '0';
          document.body.style.cursor = 'none';
        }
      }, 2000);
    } else {
      document.exitFullscreen();
      controlsRef.current.style.opacity = '1';
      document.body.style.cursor = 'auto';
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    }
  };

  const handleTimelineMouseMove = (event) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = Math.min(Math.max(0, event.clientX - rect.left), rect.width) / rect.width;
    if (isScrubbing) {
      event.preventDefault();
      setProgressPosition(percent);
      if (videoRef.current) videoRef.current.currentTime = percent * (videoRef.current.duration || 0);
    }
  };

  const handleTimelineMouseDown = (event) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = Math.min(Math.max(0, event.clientX - rect.left), rect.width) / rect.width;
    const nextScrubbing = event.buttons === 1;
    setIsScrubbing(nextScrubbing);
    if (videoRef.current) {
      if (nextScrubbing) {
        videoRef.current.pause();
      } else {
        videoRef.current.currentTime = percent * (videoRef.current.duration || 0);
        if (!videoRef.current.paused) videoRef.current.play();
      }
    }
    if (nextScrubbing) {
      setProgressPosition(percent);
      if (videoRef.current) videoRef.current.currentTime = percent * (videoRef.current.duration || 0);
    }
  };

  const handleTimelineMouseUp = () => {
    if (isScrubbing) {
      setIsScrubbing(false);
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleTimelineMouseUp);
    return () => document.removeEventListener('mouseup', handleTimelineMouseUp);
  }, [isScrubbing]);

  const handleVolumeChange = (event) => {
    const nextValue = Number(event.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = nextValue;
    video.muted = nextValue === 0;
    setVolume(nextValue);
    setIsMuted(nextValue === 0);
    setVolumeLevel(nextValue === 0 ? 'muted' : nextValue >= 0.5 ? 'high' : 'low');
  };

  const handleVideoSelect = (index) => {
    setCurrentPage(1);
    loadVideo(index);
  };

  const goToPrevious = () => {
    if (isRandomActive) {
      const nextHistory = [...randomHistory];
      if (nextHistory.length > 1) {
        nextHistory.pop();
        const previousIndex = nextHistory[nextHistory.length - 1];
        setRandomHistory(nextHistory);
        loadVideo(previousIndex);
      }
    } else if (currentVideoIndex > 1) {
      loadVideo(currentVideoIndex - 1);
    }
  };

  const getRandomVideo = () => {
    if (videoQueue.length === 0) {
      setVideoQueue(Array.from({ length: MAX_VIDEO_INDEX }, (_, index) => index + 1));
      return;
    }

    const nextQueue = [...videoQueue];
    const randomIndex = Math.floor(Math.random() * nextQueue.length);
    const selectedIndex = nextQueue[randomIndex];
    nextQueue.splice(randomIndex, 1);
    setVideoQueue(nextQueue);
    setRandomHistory((prev) => [...prev, selectedIndex]);
    loadVideo(selectedIndex);
  };

  const goToNext = () => {
    if (isRandomActive) {
      getRandomVideo();
    } else {
      const nextIndex = currentVideoIndex < MAX_VIDEO_INDEX ? currentVideoIndex + 1 : 1;
      loadVideo(nextIndex);
    }
  };

  const handleSearch = () => {
    const match = findVideoIndexByName(searchTerm);
    if (match) {
      loadVideo(match);
      setSearchTerm('');
    } else {
      window.alert('Vídeo não encontrado. Tente outro termo de pesquisa.');
    }
  };

  const toggleLoop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = !video.loop;
    setIsLoopActive(video.loop);
  };

  const toggleRandom = () => {
    setIsRandomActive((prev) => !prev);
    setRandomHistory([]);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <a className="navbar-brand" href="#">NHere</a>
        <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav mr-auto">
            <li className="nav-item dropdown">
              <a className="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                Sites
              </a>
              <div className="dropdown-menu" aria-labelledby="navbarDropdown">
                <a className="dropdown-item" href="#">Test</a>
              </div>
            </li>
          </ul>
          <form className="form-inline my-2 my-lg-0" onSubmit={(event) => { event.preventDefault(); handleSearch(); }}>
            <input id="search-input" className="form-control mr-sm-2" type="search" placeholder="Search" aria-label="Search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <button id="search-button" className="btn my-2 my-sm-0" type="button" onClick={handleSearch}>Search</button>
          </form>
        </div>
      </nav>

      <div className="container-main mt-5">
        <div>
          <div className="video-title-container">
            <h2 className="video-title">{videoTitle}</h2>
          </div>
          <div className={`video-container ${isPlaying ? '' : 'paused'}`} data-volume-level={volumeLevel}>
            <img className="thumbnail-img" src={getThumbnailSrc(currentVideoIndex)} alt={videoTitle} />
            <div className="video-controls-container" ref={controlsRef}>
              <div className="timeline-container" ref={timelineRef} onMouseMove={handleTimelineMouseMove} onMouseDown={handleTimelineMouseDown} onMouseUp={handleTimelineMouseUp}>
                <div className="timeline" style={{ '--progress-position': progressPosition }}>
                  <div className="thumb-indicator" style={{ left: `${progressPosition * 100}%` }} />
                </div>
              </div>
              <div className="controls">
                <button id="prev-button" type="button" onClick={goToPrevious}>
                  <i className="fa-solid fa-backward" />
                </button>
                <button className="play-pause-btn" type="button" onClick={togglePlay}>
                  <i className={`play-icon fa-solid fa-play ${isPlaying ? 'd-none' : ''}`} />
                  <i className={`pause-icon fa-solid fa-pause ${!isPlaying ? 'd-none' : ''}`} />
                </button>
                <button id="next-button" type="button" onClick={goToNext}>
                  <i className="fa-solid fa-forward" />
                </button>
                <div className="volume-container">
                  <button className="mute-btn" type="button" onClick={toggleMute}>
                    <i className={`volume-high-icon fa-solid fa-volume-high ${volumeLevel === 'high' ? '' : 'd-none'}`} />
                    <i className={`volume-low-icon fa-solid fa-volume-low ${volumeLevel === 'low' ? '' : 'd-none'}`} />
                    <i className={`volume-muted-icon fa-solid fa-volume-off ${volumeLevel === 'muted' ? '' : 'd-none'}`} />
                  </button>
                  <input className="volume-slider" type="range" min="0" max="1" step="any" value={volume} onChange={handleVolumeChange} />
                </div>
                <div className="duration-container">
                  <div className="current-time">{formatDuration(currentTime)}</div>
                  /
                  <div className="total-time">{formatDuration(duration)}</div>
                </div>
                <button id="random-button" type="button" className={isRandomActive ? 'active-random' : ''} onClick={toggleRandom}>
                  <i className="fa-solid fa-shuffle" />
                </button>
                <button id="loop-button" type="button" className={isLoopActive ? 'active-loop' : ''} onClick={toggleLoop}>
                  <i className="fa-solid fa-repeat" />
                </button>
                <button className="full-screen-btn" type="button" onClick={toggleFullscreen}>
                  <i className="fa-solid fa-expand" />
                </button>
              </div>
            </div>
            <video id="video-player" ref={videoRef} onClick={togglePlay}>
              <source src={getVideoSrc(currentVideoIndex)} type="video/mp4" />
            </video>
          </div>
        </div>

        <div id="video-list" className="video-list mt-5">
          {visibleVideos.map((videoIndex) => (
            <div key={videoIndex} className="video-card" onClick={() => handleVideoSelect(videoIndex)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') handleVideoSelect(videoIndex); }}>
              <div className="video-title">Vídeo {videoIndex}</div>
              <img className="video-frame" src={getThumbnailSrc(videoIndex)} alt={`Vídeo ${videoIndex}`} />
            </div>
          ))}
        </div>

        <div className="pagination-container mt-2">
          <div className="principal">
            <button id="prev-button-pages" className="btn me-2" type="button" onClick={() => handlePageChange(Math.max(1, currentPage - 1))}>
              <i className="fa-solid fa-backward" />
            </button>
            <div id="page-info">{currentPage} de {totalPages}</div>
            <button id="next-button-pages" className="btn me-2" type="button" onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}>
              <i className="fa-solid fa-forward" />
            </button>
          </div>
          <div>
            <button id="first-page-button" className="btn me-2" type="button" onClick={() => handlePageChange(1)}>Primeira</button>
            <button id="last-page-button" className="btn" type="button" onClick={() => handlePageChange(totalPages)}>Última</button>
          </div>
        </div>
      </div>
    </>
  );
}
