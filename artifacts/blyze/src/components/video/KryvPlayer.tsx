import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type Hls from 'hls.js';
import { Gauge, Maximize2, Minimize2, Pause, Play, RotateCcw, Settings2, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

export interface KryvPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  poster?: string;
  /**
   * Treat the source as a live broadcast. New visits begin at the current
   * provider synchronization point instead of restoring an older DVR segment.
   */
  live?: boolean;
  ariaLabel?: string;
}

const VOD_SEEK_SECONDS = 10;
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getBufferedEnd(video: HTMLVideoElement) {
  if (video.buffered.length === 0 || !Number.isFinite(video.duration) || video.duration <= 0) return 0;
  return Math.min(100, (video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
}

export default function KryvPlayer({
  src,
  autoPlay = false,
  muted = false,
  className,
  poster,
  live = false,
  ariaLabel = live ? 'Kryv live broadcast player' : 'Kryv video player',
}: KryvPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(muted ? 0 : 1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (!isPlaying || showSettings) return;
    controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 2600);
  }, [isPlaying, showSettings]);

  const moveToLiveEdge = useCallback(() => {
    const video = videoRef.current;
    if (!video || !live) return;

    const hlsLivePosition = hlsRef.current?.liveSyncPosition;
    if (typeof hlsLivePosition === 'number' && Number.isFinite(hlsLivePosition) && video.duration >= hlsLivePosition) {
      video.currentTime = hlsLivePosition;
    } else if (video.seekable.length > 0) {
      // Native HLS exposes the current DVR window through TimeRanges. Keep a
      // small safety cushion so Safari does not seek beyond the available edge.
      const end = video.seekable.end(video.seekable.length - 1);
      video.currentTime = Math.max(video.seekable.start(0), end - 2);
    }

    if (autoPlay) video.play().catch(() => undefined);
  }, [autoPlay, live]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || live || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    showControlsTemporarily();
  }, [live, showControlsTemporarily]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    if (!nextMuted && video.volume === 0) video.volume = 0.7;
    setIsMuted(nextMuted);
    setVolume(video.volume);
  }, []);

  const updateVolume = useCallback((nextVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  }, []);

  const setSpeed = useCallback((nextSpeed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
    setShowSettings(false);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const toggleFullscreen = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (player.requestFullscreen) {
        await player.requestFullscreen();
      }
    } catch {
      // Fullscreen is browser- and embedding-policy-dependent. The control
      // remains available without pretending the operation succeeded.
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let initialLiveSyncDone = false;
    const runInitialLiveSync = () => {
      if (!live || initialLiveSyncDone) return;
      moveToLiveEdge();
      initialLiveSyncDone = true;
    };
    const handleNativeMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      runInitialLiveSync();
      if (autoPlay) video.play().catch(() => undefined);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setBufferedPercent(getBufferedEnd(video));
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };
    const handleError = () => setHasPlaybackError(true);

    setHasPlaybackError(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPercent(0);
    video.muted = muted;
    video.volume = muted ? 0 : volume;

    video.addEventListener('loadedmetadata', handleNativeMetadata);
    video.addEventListener('loadeddata', handleTimeUpdate);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('error', handleError);

    let cancelled = false;
    const hasNativeHls = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));

    if (hasNativeHls) {
      // Native HLS (Safari/iOS) needs an explicit seek to the end of the
      // provider's active window; otherwise a DVR-enabled manifest can reopen
      // at an earlier segment. Do not download hls.js for this native path.
      video.src = src;
    } else {
      void import('hls.js').then(({ default: HlsModule }) => {
        if (cancelled || !HlsModule.isSupported()) return;
        const hls = new HlsModule({
          enableWorker: true,
          lowLatencyMode: live,
          startPosition: live ? -1 : undefined,
          // These values tell hls.js to join a live manifest near the provider
          // edge, then recover naturally if buffering/network drift occurs.
          liveSyncDurationCount: live ? 2 : undefined,
          liveMaxLatencyDurationCount: live ? 6 : undefined,
          maxLiveSyncPlaybackRate: live ? 1.5 : 1,
          backBufferLength: live ? 30 : undefined,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
          if (autoPlay) video.play().catch(() => undefined);
        });
        // The live synchronization position is finalized after level details
        // arrive, not merely when the manifest shell is parsed.
        hls.on(HlsModule.Events.LEVEL_UPDATED, runInitialLiveSync);
      }).catch(() => setHasPlaybackError(true));
    }

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeEventListener('loadedmetadata', handleNativeMetadata);
      video.removeEventListener('loadeddata', handleTimeUpdate);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('error', handleError);
      // Clear the media element as well as destroying hls.js. This prevents a
      // browser from retaining an old buffered live window when the user leaves
      // and returns to the same channel route.
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  // `volume` is intentionally handled by the user-facing volume control. It
  // must not tear down and rebuild hls.js after every slider movement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, live, moveToLiveEdge, muted, src]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => () => {
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.key.toLowerCase() === 'k') {
      event.preventDefault();
      togglePlayback();
      showControlsTemporarily();
    }
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleMute();
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      void toggleFullscreen();
    }
    if (!live && event.key === 'ArrowLeft') {
      event.preventDefault();
      seekBy(-VOD_SEEK_SECONDS);
    }
    if (!live && event.key === 'ArrowRight') {
      event.preventDefault();
      seekBy(VOD_SEEK_SECONDS);
    }
  };

  const playedPercent = duration > 0 && Number.isFinite(duration) ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isAtLiveEdge = !live || videoRef.current?.seekable.length === 0 || (videoRef.current ? Math.abs(videoRef.current.seekable.end(videoRef.current.seekable.length - 1) - videoRef.current.currentTime) < 5 : true);

  return (
    <div
      ref={playerRef}
      className="group/kryv-player relative h-full w-full overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onPointerMove={showControlsTemporarily}
      onPointerLeave={() => isPlaying && !showSettings && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className={className}
        muted={muted}
        poster={poster}
        playsInline
        onClick={togglePlayback}
        aria-label={ariaLabel}
      />

      <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-16 transition-opacity duration-200 sm:px-4 sm:pb-4 ${showControls || !isPlaying || showSettings ? 'opacity-100' : 'opacity-0'}`}>
        <div className="pointer-events-auto mx-auto flex max-w-[1800px] flex-col gap-2.5">
          {!live && (
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0)}
              step={0.1}
              value={Math.min(currentTime, Math.max(duration, 0))}
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = Number(event.target.value);
                setCurrentTime(video.currentTime);
              }}
              onPointerDown={() => {
                if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
              }}
              onPointerUp={showControlsTemporarily}
              aria-label="Seek video"
              className="kryv-player__seek w-full cursor-pointer"
              style={{ '--kryv-player-played': `${playedPercent}%`, '--kryv-player-buffered': `${Math.max(bufferedPercent, playedPercent)}%` } as CSSProperties}
            />
          )}
          <div className="flex min-h-11 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              <button type="button" onClick={togglePlayback} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
              </button>
              {!live && (
                <>
                  <button type="button" onClick={() => seekBy(-VOD_SEEK_SECONDS)} className="hidden h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex" aria-label="Rewind 10 seconds">
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => seekBy(VOD_SEEK_SECONDS)} className="hidden h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex" aria-label="Forward 10 seconds">
                    <SkipForward className="h-4 w-4" />
                  </button>
                </>
              )}
              <button type="button" onClick={toggleMute} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={isMuted ? 'Unmute video' : 'Mute video'}>
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={(event) => updateVolume(Number(event.target.value))} aria-label="Video volume" className="kryv-player__volume hidden w-20 cursor-pointer sm:block" style={{ '--kryv-volume': `${Math.round((isMuted ? 0 : volume) * 100)}%` } as CSSProperties} />
              {live ? (
                <span className="hidden items-center gap-1.5 pl-1 text-[11px] font-semibold text-white/75 sm:inline-flex"><span className="inline-flex h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.9)]" />Live</span>
              ) : (
                <span className="hidden whitespace-nowrap pl-1 font-mono text-[11px] tabular-nums text-white/65 sm:inline"><span>{formatTime(currentTime)}</span><span className="px-1 text-white/35">/</span><span>{formatTime(duration)}</span></span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              {live && (
                <button type="button" onClick={moveToLiveEdge} className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isAtLiveEdge ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/20 bg-black/45 text-white hover:border-primary/60 hover:text-primary'}`} aria-label="Return to live broadcast">
                  {isAtLiveEdge ? <span className="h-2 w-2 rounded-full bg-primary" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  <span className="hidden xs:inline">{isAtLiveEdge ? 'Live' : 'Go live'}</span>
                </button>
              )}
              <div className="relative">
                <button type="button" onClick={() => setShowSettings((current) => !current)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Player settings" aria-expanded={showSettings}>
                  <Settings2 className="h-4 w-4" />
                </button>
                {showSettings && (
                  <div className="absolute bottom-12 right-0 w-56 rounded-xl border border-white/15 bg-[#0b0d13]/95 p-2 text-sm text-white shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-2 border-b border-white/[0.08] px-2.5 py-2 text-xs font-semibold text-white/75"><Gauge className="h-3.5 w-3.5 text-primary" />Playback settings</div>
                    <div className="px-2.5 py-2.5 text-[11px] leading-relaxed text-white/50">Quality follows the source made available by the provider.</div>
                    {!live && <div className="border-t border-white/[0.08] px-2.5 pb-1 pt-2"><div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/70"><span>Speed</span><span className="text-primary">{playbackRate}×</span></div><div className="grid grid-cols-5 gap-1">{SPEED_OPTIONS.map((speed) => <button key={speed} type="button" onClick={() => setSpeed(speed)} className={`min-h-9 rounded-md text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${playbackRate === speed ? 'bg-primary text-primary-foreground' : 'bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white'}`}>{speed}×</button>)}</div></div>}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!isPlaying && !hasPlaybackError && (
        <button type="button" onClick={togglePlayback} className="absolute inset-0 flex items-center justify-center bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label="Play video">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-black/55 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:border-primary hover:bg-primary hover:text-primary-foreground sm:h-16 sm:w-16"><Play className="ml-1 h-6 w-6 fill-current" /></span>
        </button>
      )}

      {hasPlaybackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 px-5 text-center"><div className="max-w-sm"><p className="text-sm font-semibold text-white">Playback is unavailable right now.</p><p className="mt-2 text-xs leading-relaxed text-white/60">The media source did not load. Try refreshing this page in a moment.</p></div></div>
      )}
    </div>
  );
}
