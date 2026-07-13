import { useParams, Link } from 'wouter';
import { useGetVideo } from '@workspace/api-client-react';
import MuxPlayer from '@mux/mux-player-react';
import { Loader2, Eye, Share2, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export default function WatchDetail() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id || '0', 10);
  
  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-xl text-muted-foreground">Video not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl relative z-10">
      <div className="bg-black aspect-video rounded-xl overflow-hidden border border-white/10 mb-6 shadow-2xl relative">
        {video.playbackId ? (
          <MuxPlayer
            playbackId={video.playbackId}
            poster={video.thumbnailUrl || undefined}
            className="w-full h-full"
            accentColor="hsl(var(--primary))"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/80">
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <h3 className="text-xl font-bold text-white">Video is processing</h3>
              <p className="text-muted-foreground">It will be available to watch shortly.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
            {video.title}
          </h1>
          
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <Link href={`/live/${video.channelId}`} className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/10">
                {video.channelAvatarUrl ? (
                  <img src={video.channelAvatarUrl} alt={video.channelName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-xl font-bold">
                    {video.channelName?.[0]}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg group-hover:text-primary transition-colors">
                  {video.channelName}
                </h3>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Button variant="secondary" className="gap-2 rounded-full">
                <ThumbsUp className="w-4 h-4" />
                <span>Like</span>
              </Button>
              <Button variant="secondary" className="gap-2 rounded-full">
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-4 text-sm font-medium text-white mb-2">
              <span>{video.viewCount.toLocaleString()} views</span>
              <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
              {video.categoryName && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{video.categoryName}</span>
              )}
            </div>
            {video.description && (
              <p className="text-white/90 whitespace-pre-wrap mt-4 text-sm leading-relaxed">
                {video.description}
              </p>
            )}
          </div>
        </div>

        {/* Up next / recommendations could go here */}
        <div className="w-full lg:w-[350px] shrink-0 space-y-4 hidden lg:block">
          <h3 className="font-bold text-white font-display">More to watch</h3>
          {/* We'd fetch more videos here, skipping for now to focus on main paths */}
          <div className="p-8 text-center text-sm text-muted-foreground border border-white/5 rounded-xl bg-white/5">
            Recommendations coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
