import { Link } from 'wouter';
import { useListCategories } from '@workspace/api-client-react';
import { ArrowLeft, ArrowUpRight, CircleDot, Loader2, Search, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LiveCategoryCover, getLiveCategoryVisual } from '@/components/LiveCategoryCover';

function formatCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : value.toLocaleString();
}

export default function LiveCategories() {
  const [query, setQuery] = useState('');
  const { data: categories, isLoading, isError, refetch: refetchCategories } = useListCategories(
    { kind: 'live_game' },
    { query: { refetchInterval: 10000 } },
  );

  const filtered = useMemo(() => (categories ?? [])
    .filter(category => category.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.viewerCount - a.viewerCount) || (b.liveChannelCount - a.liveChannelCount) || a.name.localeCompare(b.name)), [categories, query]);

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isError) {
    return <div className="flex min-h-[60vh] items-center justify-center px-4 text-center"><div><Sparkles className="mx-auto h-8 w-8 text-red-200/70" /><h1 className="mt-4 text-2xl font-black text-red-100">Live categories are temporarily unavailable</h1><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-red-100/70">Kryv cannot confirm the available communities or current live activity right now.</p><button type="button" onClick={() => refetchCategories()} className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-red-200/25 bg-red-200/[0.08] px-4 text-sm font-black text-red-50 transition hover:bg-red-200/[0.14]">Retry categories</button></div></div>;
  }

  return (
    <div className="relative z-10 min-h-full overflow-hidden">
      <section className="relative overflow-hidden border-b border-white/[0.07] bg-[#080b12]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(57,255,187,0.16),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.12),transparent_28%)]" />
        <div className="relative mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-11 lg:px-8">
          <Link href="/live" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/55 transition-colors hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Back to live</Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Find your room</span></div><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">Browse live categories</h1><p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">Explore communities, discover new streams, and find the moment that feels like yours.</p></div>
            <label className="relative block w-full max-w-md lg:shrink-0"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search categories" className="h-12 w-full rounded-xl border border-white/[0.12] bg-black/35 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-primary/60" /></label>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Live discovery</p><h2 className="mt-1 text-2xl font-black text-white">All categories</h2></div><p className="text-sm font-semibold text-white/40">{filtered.length} {filtered.length === 1 ? 'category' : 'categories'}</p></div>
        {filtered.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">{filtered.map(category => {
          const visual = getLiveCategoryVisual(category.slug);
          const Icon = visual.icon;
          const isLive = category.liveChannelCount > 0;
          return <Link key={category.id} href={`/live/categories/${category.slug}`} className="group"><article className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090c13] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_18px_38px_rgba(0,0,0,0.42)]"><LiveCategoryCover slug={category.slug} /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" /><div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">{isLive ? <span className="inline-flex items-center gap-1 rounded-full border border-red-400/35 bg-red-500/20 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-red-100 backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Live</span> : <span className="rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/65 backdrop-blur">Explore</span>}<span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/75 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"><ArrowUpRight className="h-3.5 w-3.5" /></span></div><div className="absolute bottom-3 left-3 right-3"><div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-white/85 backdrop-blur"><Icon className="h-4 w-4" strokeWidth={1.5} /></div><h3 className="truncate text-sm font-black text-white">{category.name}</h3><p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-white/60">{isLive ? <><Users className="h-3 w-3 text-primary" /> {formatCount(category.viewerCount)} watching</> : <><CircleDot className="h-3 w-3 text-white/40" /> Ready to explore</>}</p></div></article></Link>;
        })}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-white/20" /><h3 className="mt-4 text-lg font-black text-white">No matching category</h3><p className="mt-1 text-sm text-white/45">Try a different search or return to the live home.</p></div>}
      </main>
    </div>
  );
}
