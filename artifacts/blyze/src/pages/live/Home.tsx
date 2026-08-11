import { useGetDiscoverSummary, useListCategories } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { Link } from 'wouter';
import { Loader2, Users, ChevronRight } from 'lucide-react';

export default function LiveHome() {
  // Polling keeps the public live-directory ranking current as FastPix viewer counts change.
  const { data: discover, isLoading: discoverLoading } = useGetDiscoverSummary({
    query: { refetchInterval: 10000 },
  });
  const { data: categories, isLoading: categoriesLoading } = useListCategories(
    { kind: 'live_game' },
    { query: { refetchInterval: 10000 } },
  );

  const totalViewers = discover?.featuredChannels?.reduce((sum, c) => sum + (c.viewerCount ?? 0), 0) ?? 0;

  if (discoverLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const liveChannels = discover?.featuredChannels ?? [];

  return (
    <div className="relative z-10">
      {/* Live Channels */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-10">

        {/* Section header */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Live Channels</h2>
              {totalViewers > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-white/40 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  {totalViewers.toLocaleString()} viewers
                </span>
              )}
            </div>
          </div>

          {liveChannels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-5 gap-y-8">
              {liveChannels.map(channel => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 border border-white/[0.06] rounded-2xl bg-white/[0.02]">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <span className="text-primary text-2xl">📡</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No one is live right now</h3>
              <p className="text-white/40 text-sm mb-6">Be the first to start streaming on Kryv</p>
              <Link href="/dashboard/live">
                <button className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:bg-primary/90 transition-colors shadow-[0_0_16px_hsl(var(--primary)/0.35)]">
                  Go Live Now
                </button>
              </Link>
            </div>
          )}
        </section>

        {/* Categories */}
        {categories && categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Browse Categories</h2>
              <button className="flex items-center gap-1 text-sm text-white/40 hover:text-primary transition-colors font-medium">
                See all <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {categories.slice(0, 16).map(category => (
                <Link key={category.id} href={`/live/categories/${category.slug}`} className="group block">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06] mb-2 group-hover:border-primary/40 group-hover:-translate-y-1 group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-all duration-300">
                    {category.imageUrl ? (
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-black/80">
                        <span className="font-black text-2xl text-white/20 text-center px-2 select-none">{category.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-white text-xs font-semibold truncate group-hover:text-primary transition-colors">{category.name}</p>
                  {(category.viewerCount ?? 0) > 0 && (
                    <p className="text-white/35 text-[11px] mt-0.5">{(category.viewerCount ?? 0).toLocaleString()} viewers</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
