import { useParams, Link } from 'wouter';
import { useGetVideo } from '@workspace/api-client-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Loader2, ArrowLeft, Play, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CinemaDetail() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id || '0', 10);
  
  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-black">
        <p className="text-xl text-muted-foreground">Title not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative z-10 -mt-16">
      <Link href="/cinema" className="absolute top-20 left-4 md:left-8 z-50 text-white/50 hover:text-white transition-colors">
        <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </div>
      </Link>

      <div className="w-full h-screen relative">
        {video.playbackId ? (
          <HlsPlayer
            src={video.fastpixPlaybackId 
              ? `https://stream.fastpix.com/${video.playbackId}/playlist.m3u8`
              : `https://stream.mux.com/${video.playbackId}.m3u8`
            }
            poster={video.backdropUrl || undefined}
            className="w-full h-full object-contain bg-black"
            autoPlay
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            {video.backdropUrl && (
              <img src={video.backdropUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />
            )}
            <div className="relative z-10 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <h3 className="text-2xl font-bold font-display">Processing</h3>
              <p className="text-white/60">This title will be available to watch shortly.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-background pt-12 pb-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold font-display">{video.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-white/70">
              {video.categoryName && (
                <span className="text-primary font-bold uppercase tracking-wider">{video.categoryName}</span>
              )}
              {video.durationSeconds && (
                <span>{Math.floor(video.durationSeconds / 60)}m {video.durationSeconds % 60}s</span>
              )}
              <span>{video.viewCount.toLocaleString()} views</span>
              <span className="px-2 py-0.5 rounded border border-white/20 text-white/50">HD</span>
            </div>

            {video.description && (
              <p className="text-lg text-white/80 leading-relaxed max-w-3xl">
                {video.description}
              </p>
            )}

            <div className="pt-6 border-t border-white/10 mt-8">
              <h3 className="text-white/50 text-sm font-medium mb-2">Director / Creator</h3>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden shrink-0">
                  {video.channelAvatarUrl ? (
                    <img src={video.channelAvatarUrl} alt={video.channelName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-sm font-bold">
                      {video.channelName?.[0]}
                    </div>
                  )}
                </div>
                <span className="font-bold text-white">{video.channelName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
