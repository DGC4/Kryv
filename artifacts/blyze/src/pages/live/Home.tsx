import { useAuthStore } from '@/lib/auth-store';
import { useGetDiscoverSummary, useListCategories, useListFollowedLiveChannels } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { LiveCategoryCover } from '@/components/LiveCategoryCover';
import { useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight,
  ChevronRight,
  CircleDot,
  Clapperboard,
  Flame,
  Loader2,
  Play,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react';

function formatCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : value.toLocaleString();
}

function RailHeading({ eyebrow, title, detail, icon: Icon, action }: { eyebrow: string; title: string; detail?: string; icon: typeof Sparkles; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div>
        <div className="flex items-center gap-2 text-primary"><Icon className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">{eyebrow}</span></div>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
        {detail && <p className="mt-1 text-sm text-white/45">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export default function LiveHome() {
  const { user } = useAuthStore();
  const { data: discover, isLoading: discoverLoading } = useGetDiscoverSummary({
    query: { refetchInterval: 10000 },
  });
  const { data: categories, isLoading: categoriesLoading } = useListCategories(
    { kind: 'live_game' },
    { query: { refetchInterval: 10000 } },
  );
  const { data: followedLive, isLoading: followedLiveLoading } = useListFollowedLiveChannels({
    query: { enabled: Boolean(user), refetchInterval: 10000 },
  });
  const [liveFeed, setLiveFeed] = useState<'all' | 'following'>('all');

  if (discoverLoading || categoriesLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const liveChannels = discover?.featuredChannels ?? [];
  const spotlight = liveChannels[0];
  const moreLiveChannels = liveChannels.slice(1);
  const followingChannels = followedLive ?? [];
  const visibleLiveChannels = liveFeed === 'following' ? followingChannels : (moreLiveChannels.length ? moreLiveChannels : liveChannels);
  const orderedCategories = [...(categories ?? [])].sort((a, b) =>
    (b.viewerCount - a.viewerCount) || (b.liveChannelCount - a.liveChannelCount) || a.name.localeCompare(b.name),
  );
  const totalViewers = liveChannels.reduce((sum, channel) => sum + (channel.viewerCount ?? 0), 0);
  const liveCategoryCount = orderedCategories.filter(category => category.liveChannelCount > 0).length;

  return (
    <div className="relative z-10 overflow-hidden">
      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-5 sm:space-y-14 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <section className="relative min-h-[480px] overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080a10] shadow-2xl shadow-black/30 sm:min-h-[530px]">
          {spotlight?.bannerUrl && <img src={spotlight.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,13,0.98)_0%,rgba(7,8,13,0.88)_37%,rgba(7,8,13,0.28)_78%,rgba(7,8,13,0.52)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,8,13,0.88)_0%,transparent_52%)]" />
          {!spotlight?.bannerUrl && <><div className="absolute -right-24 -top-20 h-96 w-96 rounded-full bg-primary/25 blur-3xl" /><div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" /></>}

          <div className="relative flex min-h-[480px] flex-col justify-end p-5 sm:min-h-[530px] sm:p-8 lg:p-11">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-100 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> {spotlight ? 'Live now · Spotlight' : 'Live discovery'}
              </div>
              <h1 className="mt-4 max-w-xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                {spotlight?.streamTitle || (spotlight ? `${spotlight.displayName} is live` : 'The next live moment starts here.')}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
                {spotlight ? `${spotlight.displayName}${spotlight.categoryName ? ` is streaming ${spotlight.categoryName}` : ' is broadcasting on Kryv'} right now. Join the community while the moment is live.` : 'Kryv brings live communities, creator uploads, and curated cinema together in one considered viewing experience.'}
              </p>
              {spotlight && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-white/60"><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> {formatCount(spotlight.viewerCount)} watching</span>{spotlight.categoryName && <span>{spotlight.categoryName}</span>}</div>}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {spotlight ? <Link href={`/live/${spotlight.slug || spotlight.id}`}><span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition-transform hover:-translate-y-0.5"><Play className="h-4 w-4 fill-current" /> Watch live</span></Link> : <Link href="/dashboard/live"><span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition-transform hover:-translate-y-0.5"><Radio className="h-4 w-4" /> Start a live channel</span></Link>}
                <Link href="/live/categories"><span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.18] bg-black/25 px-5 text-sm font-black text-white backdrop-blur transition-colors hover:bg-white/[0.12]">Browse categories <ChevronRight className="h-4 w-4" /></span></Link>
              </div>
            </div>
            <div className="mt-8 grid max-w-lg grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-xl border border-white/[0.1] bg-black/30 px-3.5 py-3 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Watching now</p><p className="mt-1 flex items-center gap-1.5 text-lg font-black text-white"><Users className="h-4 w-4 text-primary" /> {formatCount(totalViewers)}</p></div>
              <div className="rounded-xl border border-white/[0.1] bg-black/30 px-3.5 py-3 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Live categories</p><p className="mt-1 flex items-center gap-1.5 text-lg font-black text-white"><CircleDot className="h-4 w-4 text-red-400" /> {liveCategoryCount}</p></div>
            </div>
          </div>
        </section>

        {user && followedLive && followedLive.length > 0 && (
          <section aria-labelledby="followed-live">
            <RailHeading eyebrow="Your community" title="Followed channels live now" detail="Catch the creators you follow before the moment passes." icon={Users} action={<span className="hidden text-sm font-semibold text-white/40 sm:block">{followedLive.length} live</span>} />
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-5 sm:gap-y-7 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {followedLive.map(channel => <div key={channel.id} className="w-[78vw] shrink-0 snap-start sm:w-auto sm:shrink"><ChannelCard channel={channel} /></div>)}
            </div>
          </section>
        )}

        <section aria-labelledby="live-now">
          <RailHeading eyebrow={liveFeed === 'following' ? 'Your community' : 'Happening now'} title={liveFeed === 'following' ? 'Channels you follow' : 'Top live channels'} detail={liveFeed === 'following' ? 'Only followed creators who are broadcasting right now.' : liveChannels.length ? 'Ranked by viewers with active broadcasts first.' : 'Your first broadcast will appear here the moment it is live on Kryv.'} icon={liveFeed === 'following' ? Users : Flame} action={user ? <div className="inline-flex min-h-10 shrink-0 rounded-xl border border-white/[0.1] bg-black/25 p-1" role="tablist" aria-label="Live channel filter"><button type="button" onClick={() => setLiveFeed('all')} role="tab" aria-selected={liveFeed === 'all'} className={`rounded-lg px-3 text-xs font-black transition ${liveFeed === 'all' ? 'bg-primary text-primary-foreground' : 'text-white/50 hover:text-white'}`}>All</button><button type="button" onClick={() => setLiveFeed('following')} role="tab" aria-selected={liveFeed === 'following'} className={`rounded-lg px-3 text-xs font-black transition ${liveFeed === 'following' ? 'bg-primary text-primary-foreground' : 'text-white/50 hover:text-white'}`}>Following</button></div> : <Link href="/live/categories"><span className="hidden items-center gap-1 text-sm font-black text-primary hover:text-white sm:inline-flex">See all <ArrowUpRight className="h-4 w-4" /></span></Link>} />
          {liveFeed === 'following' && followedLiveLoading ? <div className="flex min-h-40 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : visibleLiveChannels.length > 0 ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-5 sm:gap-y-7 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleLiveChannels.map(channel => <div key={channel.id} className="w-[78vw] shrink-0 snap-start sm:w-auto sm:shrink"><ChannelCard channel={channel} /></div>)}
            </div>
          ) : liveFeed === 'following' ? (
            <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-white/[0.02] p-5 sm:flex-row sm:items-center sm:p-7"><div><h3 className="text-lg font-black text-white">No followed channels are live.</h3><p className="mt-1 text-sm text-white/50">Follow creators from their channel or profile, then return here when they begin a broadcast.</p></div><button type="button" onClick={() => setLiveFeed('all')} className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground">Explore live <ChevronRight className="h-4 w-4" /></button></div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-primary/[0.06] p-5 sm:flex-row sm:items-center sm:p-7"><div><h3 className="text-lg font-black text-white">The room is ready for its first stream.</h3><p className="mt-1 text-sm text-white/50">Use your preferred broadcast software and your channel will appear here as soon as your broadcast is active.</p></div><Link href="/dashboard/live" className="shrink-0"><span className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground">Set up your stream <ChevronRight className="h-4 w-4" /></span></Link></div>
          )}
        </section>

        <section aria-labelledby="browse-categories">
          <RailHeading eyebrow="Explore" title="Categories with a pulse" detail="Live communities and their viewer activity, ready to browse." icon={Clapperboard} action={<span className="hidden text-sm font-semibold text-white/40 sm:block">Ranked by live viewers</span>} />
          {orderedCategories.length > 0 ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5 xl:grid-cols-6">
              {orderedCategories.map(category => {
                const isLive = category.liveChannelCount > 0;
                return <Link key={category.id} href={`/live/categories/${category.slug}`} className="group w-[42vw] shrink-0 snap-start sm:w-auto sm:shrink"><article className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090c13] shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-[0_14px_30px_rgba(0,0,0,0.42)]"><LiveCategoryCover slug={category.slug} /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" /><div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">{isLive ? <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/35 bg-red-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-100 backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Live</span> : <span className="rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">Explore</span>}<span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"><ArrowUpRight className="h-3.5 w-3.5" /></span></div><div className="absolute inset-x-0 bottom-0 p-3 sm:p-4"><h3 className="truncate text-sm font-black text-white sm:text-base">{category.name}</h3><p className="mt-1 text-[11px] font-medium text-white/65">{isLive ? `${formatCount(category.viewerCount)} watching` : 'See what is next'}</p></div></article></Link>;
              })}
            </div>
          ) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-white/45">Categories are being prepared.</div>}
        </section>
      </div>
    </div>
  );
}
