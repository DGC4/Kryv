import { useGetDiscoverSummary, useListCategories } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { Link } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function LiveHome() {
  const { data: discover, isLoading: discoverLoading } = useGetDiscoverSummary();
  const { data: categories, isLoading: categoriesLoading } = useListCategories({ kind: 'live_game' });

  if (discoverLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-12 relative z-10">
      <section>
        <h1 className="text-4xl font-display font-bold text-white mb-6">Live Right Now</h1>
        {discover?.featuredChannels && discover.featuredChannels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {discover.featuredChannels.map(channel => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center border border-white/10 rounded-2xl bg-black/20 backdrop-blur">
            <h3 className="text-xl font-bold text-white mb-2">No one is live right now</h3>
            <p className="text-muted-foreground">Be the first to start streaming!</p>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white">Categories</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {categories?.map(category => (
            <Link key={category.id} href={`/live/categories/${category.slug}`} className="group block">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white/5 border border-white/5 mb-2 group-hover:border-primary/50 transition-colors group-hover:-translate-y-1 duration-300">
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/40">
                    <span className="font-display text-2xl text-white/20 font-bold text-center px-2">{category.name}</span>
                  </div>
                )}
              </div>
              <h3 className="text-white font-bold truncate group-hover:text-primary transition-colors">{category.name}</h3>
              <p className="text-muted-foreground text-sm">{category.viewerCount.toLocaleString()} viewers</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
