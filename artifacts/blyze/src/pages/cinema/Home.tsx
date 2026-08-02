import { Link } from 'wouter';
import { useGetCinemaHome } from '@workspace/api-client-react';
import { Loader2, Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

function RowScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 500, behavior: 'smooth' });
  };
  return (
    <div className="relative group/row">
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-black/80 to-transparent items-center justify-center hidden group-hover/row:flex transition-all"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory px-1 -mx-1 hide-scrollbar">
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-black/80 to-transparent items-center justify-center hidden group-hover/row:flex transition-all"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}

export default function CinemaHome() {
  const { data: home, isLoading } = useGetCinemaHome();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { hero, rows } = home || { hero: null, rows: [] };

  return (
    <div className="relative z-10 -mt-14 pb-24">

      {/* Hero */}
      {hero ? (
        <div className="relative h-[88vh] w-full overflow-hidden">
          {/* Background image */}
          {hero.backdropUrl ? (
            <img
              src={hero.backdropUrl}
              alt={hero.title}
              className="absolute inset-0 w-full h-full object-cover scale-105"
              style={{ transformOrigin: 'center top' }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-black/60 to-black" />
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex items-end pb-32 md:pb-28 md:items-center">
            <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10">
              <div className="max-w-xl space-y-4">
                {hero.categoryName && (
                  <p className="text-primary text-xs font-black tracking-[0.2em] uppercase drop-shadow-lg">
                    {hero.categoryName}
                  </p>
                )}
                <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] tracking-tight drop-shadow-2xl">
                  {hero.title}
                </h1>

                <div className="flex items-center gap-3 pt-3">
                  <Link href={`/cinema/${hero.id}`}>
                    <Button
                      size="lg"
                      className="bg-white text-black hover:bg-white/90 font-black px-8 rounded-lg h-12 text-base gap-2 shadow-2xl"
                    >
                      <Play className="w-5 h-5 fill-black" />
                      Play
                    </Button>
                  </Link>
                  <Link href={`/cinema/${hero.id}`}>
                    <Button
                      size="lg"
                      className="bg-white/20 hover:bg-white/30 text-white font-bold px-6 rounded-lg h-12 text-base gap-2 backdrop-blur border border-white/20"
                    >
                      <Info className="w-5 h-5" />
                      More Info
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-20" />
      )}

      {/* Rows */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 space-y-10 relative z-20 -mt-28 md:-mt-40">
        {!hero && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 border border-white/[0.06] rounded-2xl bg-white/[0.02] mt-20">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <span className="text-primary text-2xl">🎭</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Kryv Cinema is warming up</h2>
            <p className="text-white/40 text-sm">Curated originals will appear here once they're published.</p>
          </div>
        )}

        {rows.map((row, idx) => (
          <section key={idx}>
            <h2 className="text-lg md:text-xl font-bold text-white mb-4 drop-shadow-md">{row.title}</h2>

            {row.items.length === 0 ? (
              <div className="py-8 text-center text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.02]">
                No titles available yet
              </div>
            ) : (
              <RowScroller>
                {row.items.map(video => (
                  <Link
                    key={video.id}
                    href={`/cinema/${video.id}`}
                    className="shrink-0 snap-start group relative"
                  >
                    <div className="w-[130px] md:w-[180px] lg:w-[210px] aspect-[2/3] rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] group-hover:border-primary/40 group-hover:-translate-y-1.5 group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.6),0_0_20px_hsl(var(--primary)/0.1)] transition-all duration-300">
                      {video.posterUrl ? (
                        <img
                          src={video.posterUrl}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-black/80 p-3 text-center">
                          <span className="font-black text-lg text-white/20">{video.title}</span>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <h3 className="text-white text-xs font-bold line-clamp-2 mb-2">{video.title}</h3>
                        <div className="flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          Play
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </RowScroller>
            )}
          </section>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}
