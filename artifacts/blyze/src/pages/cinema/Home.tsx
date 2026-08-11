import { Link } from 'wouter';
import { useGetCinemaHome, useListCategories } from '@workspace/api-client-react';
import { ChevronLeft, ChevronRight, Clapperboard, Eye, Info, Loader2, LockKeyhole, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

const GENRE_THEMES = [
  'from-red-500/80 via-orange-500/30 to-black',
  'from-violet-500/80 via-fuchsia-500/30 to-black',
  'from-sky-500/80 via-cyan-500/30 to-black',
  'from-emerald-500/80 via-teal-500/30 to-black',
  'from-amber-400/80 via-yellow-500/30 to-black',
  'from-indigo-500/80 via-blue-500/30 to-black',
];

function RowScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => ref.current?.scrollBy({ left: direction * 500, behavior: 'smooth' });

  return (
    <div className="relative group/row">
      <button onClick={() => scroll(-1)} aria-label="Scroll titles left" className="absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-black/85 to-transparent transition-all md:group-hover/row:flex">
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>
      <div ref={ref} className="hide-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
        {children}
      </div>
      <button onClick={() => scroll(1)} aria-label="Scroll titles right" className="absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-black/85 to-transparent transition-all md:group-hover/row:flex">
        <ChevronRight className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}

export default function CinemaHome() {
  const { data: home, isLoading: homeLoading } = useGetCinemaHome();
  const { data: genres, isLoading: genresLoading } = useListCategories({ kind: 'genre' });

  if (homeLoading || genresLoading) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const { hero, rows } = home || { hero: null, rows: [] };
  const hasTitles = Boolean(hero) || rows.some(row => row.items.length > 0);

  return (
    <div className="relative z-10 overflow-hidden pb-16 sm:pb-24">
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.16] via-black to-primary/[0.10]">
        {hero?.backdropUrl && <img src={hero.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,hsl(var(--primary)/0.22),transparent_28%),radial-gradient(circle_at_15%_90%,rgba(99,102,241,0.2),transparent_35%)]" />
        <div className="relative mx-auto flex min-h-[320px] max-w-[1600px] flex-col justify-end px-4 py-10 sm:min-h-[400px] sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <LockKeyhole className="h-3.5 w-3.5 text-primary" /> Cinema preview
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{hero?.title || 'Kryv Cinema'}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
              {hero?.description || 'Browse the upcoming collection, explore its genres, and save your place. Playback is intentionally unavailable while the catalog is being prepared.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-black"><Eye className="h-4 w-4" /> Browse preview</span>
              {hero && (
                <Link href={`/cinema/${hero.id}`}>
                  <Button className="h-10 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"><Info className="mr-2 h-4 w-4" /> Title details</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:space-y-14 sm:px-6 sm:py-10 lg:px-8">
        <section aria-labelledby="cinema-genres">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Collection map</span></div>
              <h2 id="cinema-genres" className="mt-1 text-2xl font-black text-white sm:text-3xl">Explore the catalog by genre</h2>
              <p className="mt-1 text-sm text-white/45">The Cinema library is visible now. Titles remain preview-only until playback opens.</p>
            </div>
          </div>
          {genres && genres.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {genres.map((genre, index) => (
                <article key={genre.id} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4">
                  {genre.imageUrl ? <img src={genre.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : <div className={`absolute inset-0 bg-gradient-to-br ${GENRE_THEMES[index % GENRE_THEMES.length]}`} />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="relative flex h-full flex-col justify-between">
                    <span className="w-fit rounded-full border border-white/20 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/80 backdrop-blur">Preview</span>
                    <div>
                      <Clapperboard className="mb-2 h-5 w-5 text-white/75" />
                      <h3 className="text-sm font-black text-white sm:text-base">{genre.name}</h3>
                      <p className="mt-1 text-[11px] text-white/65">Coming to Cinema</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">Genre collections are being organized.</div>
          )}
        </section>

        {hasTitles ? rows.map((row, index) => (
          <section key={`${row.title}-${index}`}>
            <div className="mb-4 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /><h2 className="text-xl font-black text-white">{row.title}</h2><span className="text-xs font-medium text-white/35">Preview only</span></div>
            {row.items.length > 0 ? (
              <RowScroller>
                {row.items.map(video => (
                  <Link key={video.id} href={`/cinema/${video.id}`} className="group relative shrink-0 snap-start">
                    <article className="relative w-[128px] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 sm:w-[160px] lg:w-[190px]">
                      <div className="aspect-[2/3] overflow-hidden">
                        {video.posterUrl ? <img src={video.posterUrl} alt={video.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className={`flex h-full w-full items-end bg-gradient-to-br ${GENRE_THEMES[video.id % GENRE_THEMES.length]} p-3`}><span className="text-sm font-black text-white/90">{video.title}</span></div>}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/95 to-transparent px-3 pb-3 pt-8"><span className="truncate text-xs font-bold text-white">{video.title}</span><LockKeyhole className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" /></div>
                    </article>
                  </Link>
                ))}
              </RowScroller>
            ) : <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-white/40">This collection will appear here when titles are announced.</div>}
          </section>
        )) : (
          <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-indigo-500/[0.07] p-6 sm:p-8">
            <div className="flex max-w-2xl flex-col gap-3"><div className="flex items-center gap-2 text-primary"><Clapperboard className="h-5 w-5" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Preview room</span></div><h2 className="text-2xl font-black text-white">No titles are playable yet.</h2><p className="text-sm leading-relaxed text-white/55">The Cinema shell, genres, and title slots are ready for your upcoming originals. When a title is published, it will appear here with its artwork and details—but playback remains locked until you decide to open the experience.</p></div>
          </section>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}
