import { useListCategories, useListVideos } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Film, Loader2, Play, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VideoCard } from '@/components/VideoCard';

export default function WatchHome() {
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | undefined>();

  const { data: categories = [] } = useListCategories({ kind: 'genre' });
  const activeCategory = useMemo(
    () => categories.find(category => category.id === activeCategoryId),
    [activeCategoryId, categories],
  );
  const { data: videos = [], isLoading } = useListVideos({
    contentType: 'upload',
    search: search || undefined,
    categorySlug: activeCategory?.slug,
  });

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(inputValue.trim());
  };

  const clearFilters = () => {
    setSearch('');
    setInputValue('');
    setActiveCategoryId(undefined);
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/[0.12] via-[#11151a] to-cyan-500/[0.08] px-5 py-7 sm:rounded-3xl sm:px-8 sm:py-10 lg:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-end lg:gap-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              <Film className="h-3.5 w-3.5" /> Kryv Watch
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">A library built for the next play.</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">Discover original creator uploads, remarkable broadcasts, and stories worth returning to—curated around the communities that move Kryv.</p>
          </div>

          <form onSubmit={submitSearch} className="w-full rounded-2xl border border-white/[0.1] bg-black/30 p-2 backdrop-blur-sm">
            <label htmlFor="watch-search" className="sr-only">Search Kryv Watch</label>
            <div className="flex items-center gap-2">
              <Search className="ml-2 h-4 w-4 shrink-0 text-white/40" />
              <input
                id="watch-search"
                type="search"
                value={inputValue}
                onChange={event => setInputValue(event.target.value)}
                placeholder="Search the Watch library"
                maxLength={64}
                className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/35"
              />
              <button type="submit" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4">
                <Search className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="mt-8 sm:mt-10">
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Browse the library</span></div>
            <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{search ? `Results for “${search}”` : activeCategory ? activeCategory.name : 'Featured uploads'}</h2>
          </div>
          {!isLoading && videos.length > 0 && <p className="text-xs font-semibold text-white/40">{videos.length} {videos.length === 1 ? 'video' : 'videos'} available</p>}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Watch categories">
          <button onClick={() => setActiveCategoryId(undefined)} className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-all ${activeCategoryId === undefined ? 'bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.3)]' : 'border border-white/[0.09] bg-white/[0.045] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'}`}>All uploads</button>
          {categories.map(category => <button key={category.id} onClick={() => setActiveCategoryId(category.id)} className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-all ${activeCategoryId === category.id ? 'bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.3)]' : 'border border-white/[0.09] bg-white/[0.045] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'}`}>{category.name}</button>)}
        </div>

        {isLoading ? (
          <div className="flex min-h-[42vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : videos.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {videos.map(video => <VideoCard key={video.id} video={video} />)}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-primary/[0.055] p-6 sm:p-10">
            <div className="max-w-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10"><Play className="h-5 w-5 fill-primary text-primary" /></div>
              <h3 className="mt-5 text-xl font-black text-white">{search || activeCategory ? 'Nothing matched that selection.' : 'The Watch library is preparing for its first premiere.'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{search || activeCategory ? 'Try a broader title or return to the complete library.' : 'Creator uploads will appear here as soon as they are processed and published.'}</p>
              {(search || activeCategory) ? <button onClick={clearFilters} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground"><SlidersHorizontal className="h-4 w-4" /> Clear filters</button> : <Link href="/dashboard/watch" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground"><Play className="h-4 w-4" /> Publish your first upload</Link>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
