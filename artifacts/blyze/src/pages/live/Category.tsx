import { useListChannels, useListCategories } from '@workspace/api-client-react';
import { ChannelCard } from '@/components/ChannelCard';
import { useParams } from 'wouter';
import { Loader2 } from 'lucide-react';

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
  
  const category = categories?.find(c => c.slug === slug);

  if (channelsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 relative z-10">
      <header className="flex items-end gap-6 pb-8 border-b border-white/10">
        {category?.imageUrl && (
          <img src={category.imageUrl} alt={category.name} className="w-32 h-44 object-cover rounded-xl shadow-2xl" />
        )}
        <div>
          <h1 className="text-5xl font-display font-bold text-white mb-2">{category?.name || slug}</h1>
          <p className="text-xl text-primary font-medium">{category?.viewerCount?.toLocaleString() || 0} viewers</p>
        </div>
      </header>

      <section>
        {channels && channels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {channels.map(channel => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center border border-white/10 rounded-2xl bg-black/20 backdrop-blur">
            <h3 className="text-xl font-bold text-white mb-2">No channels live in {category?.name || slug}</h3>
            <p className="text-muted-foreground">Check back later for more streams.</p>
          </div>
        )}
      </section>
    </div>
  );
}
