import { useEffect, useMemo, useRef, useState } from 'react';
import './app.css';

const VIDEOS_DATA_URL = 'https://huggingface.co/datasets/Testefirst44/videos-bunker/raw/videos/data.json';
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

function createShuffledList(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export default function App() {
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const controlsRef = useRef(null);
  const controlsUpRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);
  const controlsReappearTimeoutRef = useRef(null);
  const currentVideoRef = useRef(null);

  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [videoTitle, setVideoTitle] = useState('Carregando vídeo...');
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
  const [videoQueue, setVideoQueue] = useState([]);
  const [randomHistory, setRandomHistory] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoriesInitialized, setCategoriesInitialized] = useState(false);

  const allCategories = useMemo(() => Array.from(new Set(videos.map((video) => video.categoria).filter(Boolean))), [videos]);

  useEffect(() => {
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  useEffect(() => {
    let isMounted = true;

    fetch(VIDEOS_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load videos');
        }
        return response.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const normalizedVideos = Array.isArray(data) ? data : [];
        setVideos(normalizedVideos);
        setCurrentVideo(null);
        setVideoTitle(normalizedVideos[0] ? 'Carregando vídeo...' : 'Nenhum vídeo disponível');
      })
      .catch(() => {
        if (isMounted) {
          setVideos([]);
          setCurrentVideo(null);
          setVideoTitle('Nenhum vídeo disponível');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!videos.length || categoriesInitialized || !allCategories.length) return;
    setSelectedCategories(allCategories);
    setCategoriesInitialized(true);
  }, [videos, allCategories, categoriesInitialized]);

  const filteredVideos = useMemo(() => {
    if (!videos.length || !selectedCategories.length) return [];
    return videos.filter((video) => selectedCategories.includes(video.categoria));
  }, [videos, selectedCategories]);

  const galleryItems = useMemo(() => filteredVideos, [filteredVideos]);
  const totalPages = Math.max(1, Math.ceil(galleryItems.length / VIDEOS_PER_PAGE));
  const shouldShowPagination = totalPages > 1;

  useEffect(() => {
    setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories.join('|')]);

  useEffect(() => {
    if (!videos.length) return;

    if (!categoriesInitialized) {
      if (allCategories.length) {
        setSelectedCategories(allCategories);
        setCategoriesInitialized(true);
      }
      return;
    }

    if (!filteredVideos.length) {
      setCurrentVideo(null);
      setVideoTitle('Nenhum vídeo disponível');
      return;
    }

    if (!currentVideo || !filteredVideos.some((video) => video.nome === currentVideo.nome)) {
      const randomVideo = filteredVideos[Math.floor(Math.random() * filteredVideos.length)];
      loadVideo(randomVideo, { pushToHistory: false });
    }
  }, [allCategories, categoriesInitialized, currentVideo?.nome, filteredVideos, videos.length]);

  const visibleVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
    return galleryItems.slice(startIndex, startIndex + VIDEOS_PER_PAGE);
  }, [galleryItems, currentPage]);

  const loadVideo = (video, options = {}) => {
    if (!video) return;

    const shouldRecordHistory = options.pushToHistory !== false;
    const previousVideo = currentVideoRef.current;

    if (shouldRecordHistory && previousVideo && previousVideo.nome !== video.nome) {
      setRandomHistory((prev) => [...prev, previousVideo]);
    }

    setCurrentVideo(video);
    setVideoTitle(video.nome || 'Vídeo');

    if (videoRef.current) {
      videoRef.current.src = video.url_video;
      videoRef.current.poster = video.url_thumbnail;
      videoRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setProgressPosition(0);
      if (options.autoplay) {
        window.setTimeout(() => {
          videoRef.current?.play().catch(() => undefined);
        }, 120);
      }
    }
  };

  useEffect(() => {
    if (!currentVideo) return undefined;

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
      if (isLoopActive) {
        video.currentTime = 0;
        video.play().catch(() => undefined);
        return;
      }

      if (isRandomActive) {
        getRandomVideo();
      } else {
        const currentIndex = filteredVideos.findIndex((videoItem) => videoItem.nome === currentVideo?.nome);
        const nextVideo = filteredVideos[(currentIndex + 1) % filteredVideos.length] || filteredVideos[0];
        if (nextVideo) {
          loadVideo(nextVideo, { autoplay: true });
        }
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
  }, [currentVideo?.nome, filteredVideos, isLoopActive, isRandomActive]);

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
  }, [currentVideo?.nome, isPlaying, isMuted, volume, isLoopActive, isRandomActive]);

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

  const setControlsOpacity = (opacity) => {
    [controlsRef.current, controlsUpRef.current].forEach((controlElement) => {
      if (controlElement) {
        controlElement.style.opacity = opacity;
      }
    });
  };

  const showControls = () => {
    setControlsOpacity('1');
  };

  const hideControls = () => {
    if (!videoRef.current?.paused) {
      setControlsOpacity('0');
    }
  };

  const scheduleHideControls = () => {
    if (videoRef.current?.paused) return;

    if (controlsReappearTimeoutRef.current) {
      window.clearTimeout(controlsReappearTimeoutRef.current);
    }

    showControls();

    controlsReappearTimeoutRef.current = window.setTimeout(() => {
      hideControls();
    }, 2000);
  };

  const toggleFullscreen = () => {
    const videoContainer = controlsRef.current?.closest('.video-container') || controlsUpRef.current?.closest('.video-container');
    if (!videoContainer) return;
    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen();
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      showControls();
    } else {
      document.exitFullscreen();
      showControls();
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    }
  };

  const getTimelinePercent = (clientX) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
  };

  const seekToPosition = (percent) => {
    const video = videoRef.current;
    if (!video) return;

    const nextTime = percent * (video.duration || 0);
    const shouldResumePlayback = !video.paused && !video.ended;

    video.currentTime = nextTime;
    setProgressPosition(percent);

    if (shouldResumePlayback) {
      video.play().catch(() => undefined);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleTimelineMouseMove = (event) => {
    if (!isScrubbing) return;
    event.preventDefault();
    const percent = getTimelinePercent(event.clientX);
    seekToPosition(percent);
  };

  const handleTimelineMouseDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsScrubbing(true);
    seekToPosition(getTimelinePercent(event.clientX));
  };

  const handleTimelineClick = (event) => {
    event.preventDefault();
    seekToPosition(getTimelinePercent(event.clientX));
  };

  const handleTimelineTouchStart = (event) => {
    if (!event.touches?.length) return;
    event.preventDefault();
    setIsScrubbing(true);
    seekToPosition(getTimelinePercent(event.touches[0].clientX));
  };

  const handleTimelineTouchMove = (event) => {
    if (!isScrubbing || !event.touches?.length) return;
    event.preventDefault();
    seekToPosition(getTimelinePercent(event.touches[0].clientX));
  };

  const handleTimelineTouchEnd = () => {
    setIsScrubbing(false);
  };

  const handleTimelineMouseUp = () => {
    setIsScrubbing(false);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleTimelineMouseUp);
    return () => document.removeEventListener('mouseup', handleTimelineMouseUp);
  }, [isScrubbing]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      showControls();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  const handleVideoSelect = (video) => {
    loadVideo(video);
  };

  const goToPrevious = () => {
    if (isRandomActive) {
      const nextHistory = [...randomHistory];
      const previousVideo = nextHistory.pop();
      if (previousVideo) {
        setRandomHistory(nextHistory);
        loadVideo(previousVideo, { pushToHistory: false });
      }
      return;
    }

    if (!currentVideo) return;
    const currentIndex = filteredVideos.findIndex((videoItem) => videoItem.nome === currentVideo.nome);
    if (currentIndex <= 0) {
      const previousVideo = filteredVideos[filteredVideos.length - 1];
      if (previousVideo) {
        loadVideo(previousVideo);
      }
      return;
    }

    loadVideo(filteredVideos[currentIndex - 1]);
  };

  const getRandomVideo = () => {
    if (!filteredVideos.length) return;

    if (videoQueue.length === 0) {
      const fallbackQueue = createShuffledList(filteredVideos.filter((videoItem) => videoItem.nome !== currentVideo?.nome));
      if (!fallbackQueue.length) return;
      setVideoQueue(fallbackQueue.slice(1));
      loadVideo(fallbackQueue[0], { pushToHistory: true });
      return;
    }

    const [nextVideo, ...restQueue] = videoQueue;
    setVideoQueue(restQueue);
    loadVideo(nextVideo, { pushToHistory: true });
  };

  const goToNext = () => {
    if (isRandomActive) {
      getRandomVideo();
      return;
    }

    if (!currentVideo) return;
    const currentIndex = filteredVideos.findIndex((videoItem) => videoItem.nome === currentVideo.nome);
    const nextVideo = filteredVideos[(currentIndex + 1) % filteredVideos.length] || filteredVideos[0];
    if (nextVideo) {
      loadVideo(nextVideo, { autoplay: true }, { autoplay: true });
    }
  };

  const toggleLoop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = !video.loop;
    setIsLoopActive(video.loop);
  };

  const toggleRandom = () => {
    const nextValue = !isRandomActive;
    setIsRandomActive(nextValue);
    setRandomHistory([]);
    if (nextValue) {
      const nextQueue = createShuffledList(filteredVideos.filter((videoItem) => videoItem.nome !== currentVideo?.nome));
      setVideoQueue(nextQueue);
    } else {
      setVideoQueue([]);
    }
  };

  const toggleCategory = (category) => {
    setSelectedCategories((prevCategories) => {
      if (prevCategories.includes(category)) {
        return prevCategories.filter((item) => item !== category);
      }
      return [...prevCategories, category];
    });
  };

  const selectAllCategories = () => {
    setSelectedCategories(allCategories);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <>
       <div className="container-main mt-1">
        <div>
          <div className="video-title-container">
            <h3 className="video-title mb-4">{videoTitle}</h3>
          </div>
          <div
            className={`video-container ${isPlaying ? '' : 'paused'}`}
            data-volume-level={volumeLevel}
            onMouseMove={scheduleHideControls}
            onMouseEnter={scheduleHideControls}
            onMouseLeave={() => {
              if (controlsReappearTimeoutRef.current) {
                window.clearTimeout(controlsReappearTimeoutRef.current);
              }
              hideControls();
            }}
            onTouchStart={scheduleHideControls}
          >
            <div className="video-controls-container-up" ref={controlsUpRef}>
             
              <div className="controls">
                <button id="prev-button" type="button" onClick={goToPrevious}>
                  <i className="fa-solid fa-backward" />
                </button>
                <button id="next-button" type="button" onClick={goToNext}>
                  <i className="fa-solid fa-forward" />
                </button>
              </div>
            </div>
            <div className="video-controls-container" ref={controlsRef}>
              <div
                className="timeline-container"
                ref={timelineRef}
                onMouseMove={handleTimelineMouseMove}
                onMouseDown={handleTimelineMouseDown}
                onMouseUp={handleTimelineMouseUp}
                onClick={handleTimelineClick}
                onTouchStart={handleTimelineTouchStart}
                onTouchMove={handleTimelineTouchMove}
                onTouchEnd={handleTimelineTouchEnd}
              >
                <div className="timeline" style={{ '--progress-position': progressPosition }}>
                  <div className="thumb-indicator" style={{ left: `${progressPosition * 100}%` }} />
                </div>
              </div>
              <div className="controls">
                <button id="prev-button" type="button" onClick={() => skip(-5)}>
                  <i className="fa-solid fa-rotate-left" />
                </button>
                <button className="play-pause-btn" type="button" onClick={togglePlay}>
                  <i className={`play-icon fa-solid fa-play ${isPlaying ? 'd-none' : ''}`} />
                  <i className={`pause-icon fa-solid fa-pause ${!isPlaying ? 'd-none' : ''}`} />
                </button>
                <button id="next-button" type="button" onClick={() => skip(5)}>
                  <i className="fa-solid fa-rotate-right" />
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
                <button className="full-screen-btn" type="button" onClick={toggleFullscreen}>
                  <i className="fa-solid fa-expand" />
                </button>
              </div>
            </div>
            <video
              id="video-player"
              ref={videoRef}
              onClick={togglePlay}
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
            />
          </div>

          <div className="video-actions-container">
            <button id="random-button" type="button" className={isRandomActive ? 'active-random' : ''} onClick={toggleRandom}>
              <i className="fa-solid fa-shuffle" /> Aleatório
            </button>
            <button id="loop-button-secondary" type="button" className={isLoopActive ? 'active-loop' : ''} onClick={toggleLoop}>
              <i className="fa-solid fa-repeat" /> Repetir
            </button>
        </div>

        <div className="category-filter-panel mt-4">
          <div className="category-filter-header">
            <span className="category-filter-title">Categorias</span>
            <button type="button" className="category-toggle-all" onClick={selectAllCategories}>
              Todas
            </button>
          </div>
          <div className="category-pill-group">
            {allCategories.map((category) => (
              <button key={category} type="button" className={`category-pill ${selectedCategories.includes(category) ? 'active' : ''}`} onClick={() => toggleCategory(category)}>
                {category}
              </button>
            ))}
          </div>
        </div>

        <div id="video-list" className="video-list mt-5">
          {visibleVideos.map((video) => (
            <div key={video.nome} className="video-card" onClick={() => handleVideoSelect(video)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') handleVideoSelect(video); }}>
              <div className="video-title">{video.nome}</div>
              <img className="video-frame" src={video.url_thumbnail} alt={video.nome} />
            </div>
          ))}
        </div>

        {shouldShowPagination && (
          <div className="pagination-container mt-2">
            <div className="principal">
              <button id="prev-button-pages" className="btn me-2" type="button" aria-label="Página anterior" onClick={() => handlePageChange(Math.max(1, currentPage - 1))}>
                <i className="fa-solid fa-backward" />
              </button>
              <div id="page-info">{currentPage} de {totalPages}</div>
              <button id="next-button-pages" className="btn me-2" type="button" aria-label="Próxima página" onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}>
                <i className="fa-solid fa-forward" />
              </button>
            </div>
            <div>
              <button id="first-page-button" className="btn me-2" type="button" onClick={() => handlePageChange(1)}>Primeira</button>
              <button id="last-page-button" className="btn" type="button" onClick={() => handlePageChange(totalPages)}>Última</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
