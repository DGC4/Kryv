import { useCallback, useEffect, useRef } from 'react';
import type Hls from 'hls.js';

interface HlsPlayerProps {
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
}

export default function HlsPlayer({ src, autoPlay, muted, className, poster, live = false }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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
      runInitialLiveSync();
      if (autoPlay) video.play().catch(() => undefined);
    };

    let cancelled = false;
    const hasNativeHls = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));

    if (hasNativeHls) {
      // Native HLS (Safari/iOS) needs an explicit seek to the end of the
      // provider's active window; otherwise a DVR-enabled manifest can reopen
      // at an earlier segment. Do not download hls.js for this native path.
      video.src = src;
      video.addEventListener('loadedmetadata', handleNativeMetadata);
      video.addEventListener('canplay', runInitialLiveSync, { once: true });
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
        video.addEventListener('loadedmetadata', handleNativeMetadata);
      }).catch(() => undefined);
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleNativeMetadata);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      // Clear the media element as well as destroying hls.js. This prevents a
      // browser from retaining an old buffered live window when the user leaves
      // and returns to the same channel route.
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [autoPlay, live, moveToLiveEdge, src]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        className={className}
        muted={muted}
        poster={poster}
        playsInline
        controls
      />
      {live && (
        <button
          type="button"
          onClick={moveToLiveEdge}
          className="absolute bottom-3 right-3 rounded-full border border-red-300/40 bg-black/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur transition-colors hover:border-red-300 hover:bg-red-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          aria-label="Return to live broadcast"
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
          Live
        </button>
      )}
    </div>
  );
}
