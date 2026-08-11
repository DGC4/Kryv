import { useListChannels, useListCategories } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { Link, useParams } from 'wouter';
import { ArrowLeft, CircleDot, Loader2, Radio, Users } from 'lucide-react';

export default function LiveCategory() {
  const { slug } = useParams<{ slug: string }>();
  const { data: channels, isLoading: channelsLoading } = useListChannels(
    { categorySlug: slug, live: true },
    { query: { refetchInterval: 10000 } },
  );
  const { data: categories } = useListCategories(
    { kind: 'live_game' },
    { query: { refetchInterval: 10000 } },
  );
  const category = categories?.find(item => item.slug === slug);
  const viewerCount = category?.viewerCount ?? 0;
  const liveCount = category?.liveChannelCount ?? channels?.length ?? 0;

  if (channelsLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="relative z-10 overflow-hidden">
      <section className="relative overflow-hidden border-b border-white/[0.07] bg-gradient-to-br from-primary/[0.15] via-black to-cyan-500/[0.09]">
        {category?.imageUrl && <img src={category.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/65" />
        <div className="relative mx-auto max-w-[1600px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
          <Link href="/live" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/55 transition-colors hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> All categories</Link>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4 sm:gap-6">
              {category?.imageUrl ? <img src={category.imageUrl} alt={category.name} className="h-24 w-20 shrink-0 rounded-xl border border-white/15 object-cover shadow-2xl sm:h-32 sm:w-24" /> : <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary sm:h-32 sm:w-24"><Radio className="h-8 w-8" /></div>}
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Live category</p><h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-5xl">{category?.name || slug}</h1><p className="mt-2 text-sm text-white/55">Browse active broadcasters and join the conversation.</p></div>
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
        {channels && channels.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {channels.map(channel => <ChannelCard key={channel.id} channel={channel} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-primary/[0.06] p-6 sm:p-8"><h3 className="text-xl font-black text-white">No channels are live in {category?.name || slug} yet.</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">When a creator selects this category and FastPix reports an active broadcast, their stream will appear here automatically.</p></div>
        )}
      </main>
    </div>
  );
}
