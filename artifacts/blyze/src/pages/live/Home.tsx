import { useGetDiscoverSummary, useListCategories } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { Link } from 'wouter';
import { ArrowUpRight, ChevronRight, CircleDot, Loader2, Radio, Sparkles, Users } from 'lucide-react';

const CATEGORY_THEMES = [
  'from-fuchsia-500/80 via-violet-500/35 to-black',
  'from-cyan-500/80 via-blue-500/35 to-black',
  'from-amber-400/80 via-orange-500/35 to-black',
  'from-rose-500/80 via-red-500/35 to-black',
  'from-emerald-500/80 via-teal-500/35 to-black',
];

function formatCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : value.toLocaleString();
}

export default function LiveHome() {
  const { data: discover, isLoading: discoverLoading } = useGetDiscoverSummary({
    query: { refetchInterval: 10000 },
  });
  const { data: categories, isLoading: categoriesLoading } = useListCategories(
    { kind: 'live_game' },
    { query: { refetchInterval: 10000 } },
  );

  if (discoverLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const liveChannels = discover?.featuredChannels ?? [];
  const orderedCategories = [...(categories ?? [])].sort((a, b) =>
    (b.viewerCount - a.viewerCount) || (b.liveChannelCount - a.liveChannelCount) || a.name.localeCompare(b.name),
  );
  const totalViewers = liveChannels.reduce((sum, channel) => sum + (channel.viewerCount ?? 0), 0);
  const liveCategoryCount = orderedCategories.filter(category => category.liveChannelCount > 0).length;

  return (
    <div className="relative z-10 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10 space-y-10 sm:space-y-14">
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-gradient-to-br from-primary/[0.14] via-black/20 to-cyan-500/[0.08] p-5 sm:p-8 lg:p-10">
          <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-24 -bottom-32 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                <Radio className="h-3.5 w-3.5" />
                Live discovery
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Find your next live moment.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
                Browse what is happening now, explore a category, or start the first stream your community sees today.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Watching now</p>
                <p className="mt-1 flex items-center gap-1.5 text-lg font-black text-white"><Users className="h-4 w-4 text-primary" /> {formatCount(totalViewers)}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Live categories</p>
                <p className="mt-1 flex items-center gap-1.5 text-lg font-black text-white"><CircleDot className="h-4 w-4 text-red-400" /> {liveCategoryCount}</p>
              </div>
              <Link href="/dashboard/live" className="col-span-2 sm:col-auto">
                <span className="flex h-full min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/0.25)] transition-transform hover:-translate-y-0.5 hover:bg-primary/90">
                  <Radio className="h-4 w-4" /> Go Live
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="browse-categories">
          <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
            <div>
              <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Browse</span></div>
              <h2 id="browse-categories" className="mt-1 text-2xl font-black text-white sm:text-3xl">Explore categories</h2>
              <p className="mt-1 text-sm text-white/45">Jump into the communities with the most activity right now.</p>
            </div>
            <span className="hidden text-sm font-semibold text-white/40 sm:block">Ranked by live viewers</span>
          </div>

          {orderedCategories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
              {orderedCategories.map((category, index) => {
                const isLive = category.liveChannelCount > 0;
                return (
                  <Link key={category.id} href={`/live/categories/${category.slug}`} className="group min-w-0">
                    <article className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-[0_14px_30px_rgba(0,0,0,0.42)]">
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_THEMES[index % CATEGORY_THEMES.length]}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
                      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/35 bg-red-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-100 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Live
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">Explore</span>
                        )}
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                        <h3 className="truncate text-sm font-black text-white sm:text-base">{category.name}</h3>
                        <p className="mt-1 text-[11px] font-medium text-white/65">
                          {isLive ? `${formatCount(category.viewerCount)} watching` : 'See what is next'}
                        </p>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-white/45">Categories are being prepared.</div>
          )}
        </section>

        <section aria-labelledby="live-now">
          <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
            <div>
              <div className="flex items-center gap-2 text-red-400"><span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Happening now</span></div>
              <h2 id="live-now" className="mt-1 text-2xl font-black text-white sm:text-3xl">Live channels</h2>
            </div>
            {liveChannels.length > 0 && <span className="hidden text-sm font-semibold text-white/40 sm:block">Highest viewer count first</span>}
          </div>

          {liveChannels.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {liveChannels.map(channel => <ChannelCard key={channel.id} channel={channel} />)}
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-primary/[0.06] p-5 sm:flex-row sm:items-center sm:p-7">
              <div>
                <h3 className="text-lg font-black text-white">The room is ready for its first stream.</h3>
                <p className="mt-1 text-sm text-white/50">Connect OBS with your FastPix credentials and your channel will appear here as soon as the broadcast is active.</p>
              </div>
              <Link href="/dashboard/live" className="shrink-0">
                <span className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-primary-foreground">Set up your stream <ChevronRight className="h-4 w-4" /></span>
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
