import { useListVideos, useListCategories } from '@workspace/api-client-react';
import { VideoCard } from '@/components/VideoCard';
import { Loader2, Search } from 'lucide-react';
import { useState } from 'react';

export default function WatchHome() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | undefined>(undefined);
  const [inputVal, setInputVal] = useState('');

  const { data: categories } = useListCategories({ kind: 'genre' });
  const { data: videos, isLoading } = useListVideos({
    contentType: 'upload',
    search: search || undefined,
    categorySlug: undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputVal);
  };

  return (
    <div className="relative z-10 max-w-[1600px] mx-auto px-4 lg:px-6 py-6">

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Watch</h1>

        <form onSubmit={handleSearch} className="relative w-full sm:w-72 lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Search videos..."
            className="w-full h-9 bg-white/[0.06] border border-white/[0.08] rounded-full pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-all"
          />
        </form>
      </div>

      {/* Category chips */}
      {categories && categories.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 hide-scrollbar">
          <button
            onClick={() => setActiveCategory(undefined)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              activeCategory === undefined
                ? 'bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.4)]'
                : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white border border-white/[0.08]'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.4)]'
                  : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white border border-white/[0.08]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-5 gap-y-9">
          {videos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 border border-white/[0.06] rounded-2xl bg-white/[0.02]">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <span className="text-primary text-2xl">🎬</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {search ? `No results for "${search}"` : 'No videos yet'}
          </h3>
          <p className="text-white/40 text-sm">
            {search ? 'Try a different search term' : 'Creators will start uploading soon'}
          </p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}
