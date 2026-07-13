import { useListVideos } from '@workspace/api-client-react';
import { VideoCard } from '@/components/VideoCard';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function WatchHome() {
  const [search, setSearch] = useState('');
  // Use debounced search in a real app, but this is fine for now
  
  const { data: videos, isLoading } = useListVideos({ 
    contentType: 'upload',
    search: search || undefined
  });

  return (
    <div className="container mx-auto px-4 py-8 relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-display font-bold text-white">Watch</h1>
        
        {/* We can put a local search bar here or rely on the global one */}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
          {videos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border border-white/10 rounded-2xl bg-black/20 backdrop-blur">
          <h3 className="text-xl font-bold text-white mb-2">No videos found</h3>
          <p className="text-muted-foreground">Creators haven't uploaded anything yet.</p>
        </div>
      )}
    </div>
  );
}
