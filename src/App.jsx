import { useEffect, useMemo, useRef, useState } from 'react';
import './app.css';

const VIDEOS_DATA_URL = 'https://huggingface.co/api/resolve-cache/datasets/Testefirst44/videos-bunker/5dee3ba036b08a40379f3e278cae30014422ad9e/data.json?%2Fdatasets%2FTestefirst44%2Fvideos-bunker%2Fresolve%2Fvideos%2Fdata.json=&etag=%22841168098a369444226177842498f8e7c40fb9a6%22';
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
  const hideControlsTimeoutRef = useRef(null);
  const currentVideoRef = useRef(null);

  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
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
        if (normalizedVideos[0]) {
          setCurrentVideo(normalizedVideos[0]);
          setVideoTitle(normalizedVideos[0].nome || 'Vídeo');
        }
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

  const galleryVideos = useMemo(() => filteredVideos, [filteredVideos]);

  const totalPages = Math.max(1, Math.ceil(galleryVideos.length / VIDEOS_PER_PAGE));

  useEffect(() => {
    setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
  }, [totalPages]);

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
      loadVideo(filteredVideos[0], { pushToHistory: false });
    }
  }, [allCategories, categoriesInitialized, currentVideo?.nome, filteredVideos, videos.length]);

  const visibleVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
    return galleryVideos.slice(startIndex, startIndex + VIDEOS_PER_PAGE);
  }, [galleryVideos, currentPage]);

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
          loadVideo(nextVideo);
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
      loadVideo(nextVideo);
    }
  };

  const handleSearch = () => {
    const match = videos.find((video) => video.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    if (match) {
      loadVideo(match);
      setSearchTerm('');
      setCurrentPage(1);
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

  const handleCategoryChange = (event) => {
    const nextValues = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedCategories(nextValues);
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
            <video id="video-player" ref={videoRef} onClick={togglePlay} playsInline />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 d-block" htmlFor="category-filter">Categorias</label>
          <select id="category-filter" className="form-select" multiple value={selectedCategories} onChange={handleCategoryChange} size={Math.min(Math.max(allCategories.length, 1), 5)}>
            {allCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div id="video-list" className="video-list mt-5">
          {visibleVideos.map((video) => (
            <div key={video.nome} className="video-card" onClick={() => handleVideoSelect(video)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') handleVideoSelect(video); }}>
              <div className="video-title">{video.nome}</div>
              <img className="video-frame" src={video.url_thumbnail} alt={video.nome} />
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
