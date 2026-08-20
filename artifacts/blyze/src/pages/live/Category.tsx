import { useListChannels, useListCategories } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { LiveCategoryCover, getLiveCategoryVisual } from '@/components/LiveCategoryCover';
import { Link, useParams } from 'wouter';
import { ArrowLeft, CircleDot, Loader2, Users } from 'lucide-react';

export default function LiveCategory() {
  const { slug } = useParams<{ slug: string }>();
  const { data: channelsPage, isLoading: channelsLoading, isError: channelsError, refetch: refetchChannels } = useListChannels(
    { categorySlug: slug, live: true, limit: 48, offset: 0 },
    { query: { refetchInterval: 10000 } },
  );
  const channels = channelsPage?.items ?? [];
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useListCategories(
    { kind: 'live_game' },
    { query: { refetchInterval: 10000 } },
  );
  const category = categories?.find(item => item.slug === slug);
  const viewerCount = category?.viewerCount ?? 0;
  const liveCount = category?.liveChannelCount ?? channelsPage?.total ?? 0;
  const visual = getLiveCategoryVisual(category?.slug || slug);

  if (channelsLoading || categoriesLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (channelsError || categoriesError) {
    return <div className="flex min-h-[50vh] items-center justify-center px-4 text-center"><div><CircleDot className="mx-auto h-8 w-8 text-red-200/70" /><h1 className="mt-4 text-2xl font-black text-red-100">This Live category is temporarily unavailable</h1><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-red-100/70">Kryv cannot confirm this category&apos;s current channel activity or viewer data right now.</p><button type="button" onClick={() => { void Promise.all([refetchChannels(), refetchCategories()]); }} className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-red-200/25 bg-red-200/[0.08] px-4 text-sm font-black text-red-50 transition hover:bg-red-200/[0.14]">Retry category</button></div></div>;
  }

  return (
    <div className="relative z-10 overflow-hidden">
      <section className="relative overflow-hidden border-b border-white/[0.07] bg-[#080b12]">
        <LiveCategoryCover slug={category?.slug || slug} variant="hero" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/75" />
        <div className="relative mx-auto max-w-[1600px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
          <Link href="/live" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/55 transition-colors hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> All categories</Link>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4 sm:gap-6">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#090c13] shadow-2xl sm:h-32 sm:w-24"><LiveCategoryCover slug={category?.slug || slug} variant="tile" /></div>
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{visual.eyebrow}</p><h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-5xl">{category?.name || slug}</h1><p className="mt-2 text-sm text-white/55">{visual.description}</p></div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <div className="rounded-xl border border-white/[0.10] bg-black/35 px-3 py-2.5 backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">Watching</p><p className="mt-1 flex items-center gap-1 text-sm font-black text-white"><Users className="h-3.5 w-3.5 text-primary" /> {viewerCount.toLocaleString()}</p></div>
              <div className="rounded-xl border border-white/[0.10] bg-black/35 px-3 py-2.5 backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">Live now</p><p className="mt-1 flex items-center gap-1 text-sm font-black text-white"><CircleDot className="h-3.5 w-3.5 text-red-400" /> {liveCount}</p></div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" /><h2 className="text-xl font-black text-white">Channels live in {category?.name || slug}</h2></div>
        {channels.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {channels.map(channel => <ChannelCard key={channel.id} channel={channel} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-primary/[0.06] p-6 sm:p-8"><h3 className="text-xl font-black text-white">No channels are live in {category?.name || slug} yet.</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">When a creator selects this category and starts an active broadcast, their stream will appear here automatically.</p></div>
        )}
      </main>
    </div>
  );
}
