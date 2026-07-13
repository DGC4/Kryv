import { Link } from 'wouter';
import { VideoSummary } from '@workspace/api-client-react/src/generated/api.schemas';
import { formatDistanceToNow } from 'date-fns';

export function VideoCard({ video }: { video: VideoSummary }) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Link href={video.contentType === 'original' ? `/cinema/${video.id}` : `/watch/${video.id}`} className="group block">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/5 mb-3 group-hover:border-primary/50 transition-colors">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/40">
            <span className="font-display text-4xl text-white/20 font-bold">{video.title[0]}</span>
          </div>
        )}
        
        {video.durationSeconds && (
          <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
            {formatDuration(video.durationSeconds)}
          </div>
        )}

        {video.uploadStatus !== 'ready' && (
          <div className="absolute top-2 left-2 bg-orange-500/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            {video.uploadStatus}
          </div>
        )}
      </div>
      
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
          {video.channelAvatarUrl ? (
            <img src={video.channelAvatarUrl} alt={video.channelName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold">
              {video.channelName?.[0] || '?'}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-white font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-muted-foreground text-sm truncate mt-1">{video.channelName}</p>
          <div className="flex items-center text-muted-foreground text-xs gap-1 mt-0.5">
            <span>{video.viewCount.toLocaleString()} views</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
