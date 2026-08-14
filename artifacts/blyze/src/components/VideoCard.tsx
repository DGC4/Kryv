import { Link } from 'wouter';
import type { VideoSummary } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';
import { Play } from 'lucide-react';

function fmtDuration(s: number | null) {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

export function VideoCard({ video }: { video: VideoSummary }) {
  const href = video.contentType === 'original' ? `/cinema/${video.id}` : `/watch/${video.id}`;
  const duration = fmtDuration(video.durationSeconds);

  return (
    <Link href={href} className="group block">
      {/* Thumbnail */}
      <div className="relative mb-3 aspect-video overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/25">
            <span className="select-none text-5xl font-black text-white/10">{video.title[0]}</span>
          </div>
        )}

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover:bg-black/35 group-hover:opacity-100 group-focus-visible:bg-black/35 group-focus-visible:opacity-100"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/65 text-white shadow-xl backdrop-blur-sm"><Play className="ml-0.5 h-4 w-4 fill-current" /></span></span>

        {duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
            {duration}
          </div>
        )}

        {video.uploadStatus !== 'ready' && (
          <div className="absolute top-0 inset-x-0 bottom-0 bg-black/60 flex items-center justify-center">
            <span className="bg-amber-500/90 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {video.uploadStatus === 'waiting' ? 'Processing…' : video.uploadStatus}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-2.5">
        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/[0.08] mt-0.5">
          {video.channelAvatarUrl ? (
            <img src={video.channelAvatarUrl} alt={video.channelName ?? ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold text-sm">
              {video.channelName?.[0] ?? '?'}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-white text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-white/50 text-xs mt-0.5 truncate hover:text-primary transition-colors cursor-pointer">
            {video.channelName}
          </p>
          <p className="text-white/35 text-xs mt-0.5">
            {video.viewCount.toLocaleString()} views
            {' · '}
            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </Link>
  );
}
