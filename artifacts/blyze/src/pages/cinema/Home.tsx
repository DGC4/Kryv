import { Link } from 'wouter';
import { useGetCinemaHome } from '@workspace/api-client-react';
import { Loader2, Play, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CinemaHome() {
  const { data: home, isLoading } = useGetCinemaHome();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { hero, rows } = home || { hero: null, rows: [] };

  return (
    <div className="relative z-10 -mt-16 pb-20">
      {/* Hero Banner */}
      {hero ? (
        <div className="relative h-[80vh] md:h-[90vh] w-full bg-black">
          <div className="absolute inset-0">
            {hero.backdropUrl ? (
              <img src={hero.backdropUrl} alt={hero.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-black/80 to-primary/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          </div>
          
          <div className="absolute inset-0 flex items-center">
            <div className="container mx-auto px-4 lg:px-8">
              <div className="max-w-2xl space-y-6">
                {hero.categoryName && (
                  <span className="text-primary font-bold tracking-widest uppercase text-sm drop-shadow-md">
                    {hero.categoryName}
                  </span>
                )}
                <h1 className="text-5xl md:text-7xl font-display font-bold text-white leading-tight drop-shadow-xl">
                  {hero.title}
                </h1>
                
                <div className="flex items-center gap-4 pt-4">
                  <Link href={`/cinema/${hero.id}`}>
                    <Button size="lg" className="bg-white text-black hover:bg-white/90 font-bold px-8 rounded-full h-12 text-lg">
                      <Play className="w-5 h-5 mr-2 fill-current" />
                      Play
                    </Button>
                  </Link>
                  <Link href={`/cinema/${hero.id}`}>
                    <Button size="lg" variant="outline" className="bg-black/40 border-white/20 hover:bg-white/20 text-white font-bold px-8 rounded-full h-12 text-lg backdrop-blur">
                      <Info className="w-5 h-5 mr-2" />
                      More Info
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-24"></div>
      )}

      {!hero && rows.length === 0 && (
        <div className="container mx-auto px-4 lg:px-8 pt-12">
          <div className="rounded-lg border border-white/10 bg-black/20 p-16 text-center">
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Kryv Cinema is warming up
            </h2>
            <p className="text-muted-foreground">
              Curated originals will appear here once they're published.
            </p>
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="container mx-auto px-4 lg:px-8 space-y-12 relative z-20 -mt-20 md:-mt-32">
        {rows.map((row, idx) => (
          <section key={idx} className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md">{row.title}</h2>
            
            <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x px-2 -mx-2 hide-scrollbar">
              {row.items.map(video => (
                <Link key={video.id} href={`/cinema/${video.id}`} className="shrink-0 snap-start group relative transition-transform duration-300 hover:scale-105 hover:z-10">
                  <div className="w-[140px] md:w-[200px] lg:w-[240px] aspect-[2/3] rounded-md overflow-hidden bg-white/5 border border-white/10 shadow-lg">
                    {video.posterUrl ? (
                      <img src={video.posterUrl} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/40 p-4 text-center">
                        <span className="font-display text-xl text-white font-bold">{video.title}</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                      <h3 className="text-white font-bold line-clamp-2">{video.title}</h3>
                      <div className="flex items-center text-primary text-xs font-bold gap-2 mt-2 uppercase tracking-wider">
                        <span>Play</span>
                        <Play className="w-3 h-3 fill-current" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              
              {row.items.length === 0 && (
                <div className="w-full p-8 text-center text-muted-foreground border border-white/10 rounded-md bg-black/20">
                  No titles available
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
