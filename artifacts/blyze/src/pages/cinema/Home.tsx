import { Link } from 'wouter';
import type { CinemaTitle, ViewerProfile } from '@workspace/api-client-react';
import { useCreateViewerProfile, useGetCinemaHome, useListCategories, useListViewerProfiles } from '@workspace/api-client-react';
import { ChevronLeft, ChevronRight, Clapperboard, Eye, Info, Loader2, LockKeyhole, Play, Plus, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';

const GENRE_THEMES = [
  'from-red-500/80 via-orange-500/30 to-black', 'from-violet-500/80 via-fuchsia-500/30 to-black',
  'from-sky-500/80 via-cyan-500/30 to-black', 'from-emerald-500/80 via-teal-500/30 to-black',
  'from-amber-400/80 via-yellow-500/30 to-black', 'from-indigo-500/80 via-blue-500/30 to-black',
];

function formatRuntime(seconds: number | null) {
  if (!seconds) return 'Runtime pending';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function RowScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => ref.current?.scrollBy({ left: direction * 500, behavior: 'smooth' });
  return <div className="group/row relative"><button onClick={() => scroll(-1)} aria-label="Scroll titles left" className="absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-black/85 to-transparent transition-all md:group-hover/row:flex"><ChevronLeft className="h-6 w-6 text-white" /></button><div ref={ref} className="hide-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-5">{children}</div><button onClick={() => scroll(1)} aria-label="Scroll titles right" className="absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-black/85 to-transparent transition-all md:group-hover/row:flex"><ChevronRight className="h-6 w-6 text-white" /></button></div>;
}

function CinemaTitleCard({ video, index }: { video: CinemaTitle; index: number }) {
  const playbackAvailable = video.playbackAvailable;
  return (
    <Link href={`/cinema/${video.id}`} className="group relative w-[142px] shrink-0 snap-start sm:w-[174px] lg:w-[196px]">
      <article className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-lg transition-all duration-300 group-hover:z-10 group-hover:-translate-y-2 group-hover:scale-[1.04] group-hover:border-primary/55 group-hover:shadow-2xl group-focus-visible:z-10 group-focus-visible:-translate-y-2 group-focus-visible:scale-[1.04]">
        {video.posterUrl ? <img src={video.posterUrl} alt={video.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className={`absolute inset-0 flex items-end bg-gradient-to-br ${GENRE_THEMES[index % GENRE_THEMES.length]} p-3`}><span className="text-sm font-black text-white/90">{video.title}</span></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
        <div className="absolute left-2.5 top-2.5"><span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] backdrop-blur ${playbackAvailable ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100' : 'border-white/15 bg-black/35 text-white/75'}`}>{playbackAvailable ? 'Watch now' : 'Catalog preview'}</span></div>
        <div className="absolute inset-x-0 bottom-0 p-3 transition-transform duration-300 group-hover:translate-y-0 sm:translate-y-6"><h3 className="truncate text-sm font-black text-white">{video.title}</h3><p className="mt-1 truncate text-[10px] font-semibold text-white/65">{video.genres[0] || 'Kryv Cinema'} · {formatRuntime(video.runtimeSeconds)}</p><div className="mt-3 flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-black"><Play className="h-3.5 w-3.5 fill-current" /></span><span className="text-[10px] font-black text-white">View title</span></div></div>
      </article>
    </Link>
  );
}

function CinemaProfileGate({ profiles, onSelect, onCreate, isCreating }: { profiles: ViewerProfile[]; onSelect: (profile: ViewerProfile) => void; onCreate: (name: string) => void; isCreating: boolean }) {
  const [name, setName] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
  };

  return <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-[#08090d] px-4 py-10 text-white"><div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl" /><div className="pointer-events-none absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" /><main className="relative w-full max-w-3xl text-center"><div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div><p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-primary">Kryv Cinema</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Who&apos;s watching?</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/55">Choose a profile for a personal Cinema session. Profile choices are private to your account and are used for viewing state and maturity settings.</p><div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">{profiles.map(profile => <button key={profile.id} type="button" onClick={() => onSelect(profile)} className="group rounded-2xl p-2 text-center transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="relative mx-auto aspect-square w-full max-w-32 overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-br from-primary/25 to-indigo-500/25 shadow-lg transition-colors group-hover:border-primary/70">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/80">{profile.name.slice(0, 1).toUpperCase()}</div>}{profile.isKidsProfile && <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">Kids</span>}</div><span className="mt-3 block truncate text-sm font-black text-white group-hover:text-primary">{profile.name}</span></button>)}</div><form onSubmit={submit} className="mx-auto mt-7 flex max-w-sm gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.035] p-2"><input value={name} onChange={event => setName(event.target.value)} maxLength={40} placeholder="Add a profile" className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/35" /><Button type="submit" disabled={isCreating || !name.trim()} className="h-10 rounded-xl px-4 font-black"><Plus className="mr-1.5 h-4 w-4" /> Add</Button></form><p className="mt-4 text-xs text-white/30">You can manage profile details from your account controls as Cinema expands.</p></main></div>;
}

export default function CinemaHome() {
  const { user } = useAuthStore();
  const { data: home, isLoading: homeLoading } = useGetCinemaHome();
  const { data: genres, isLoading: genresLoading } = useListCategories({ kind: 'genre' });
  const profilesQuery = useListViewerProfiles({ query: { enabled: Boolean(user) } });
  const createViewerProfile = useCreateViewerProfile();
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const profileStorageKey = user ? `kryv:cinema-profile:${user.username}` : null;

  useEffect(() => {
    if (!profileStorageKey || !profilesQuery.data?.length) return;
    const saved = Number(window.localStorage.getItem(profileStorageKey));
    const selected = profilesQuery.data.find(profile => profile.id === saved) || profilesQuery.data.find(profile => profile.isDefault) || profilesQuery.data[0];
    if (selected) setActiveProfileId(selected.id);
  }, [profileStorageKey, profilesQuery.data]);

  const selectProfile = (profile: ViewerProfile) => {
    setActiveProfileId(profile.id);
    if (profileStorageKey) window.localStorage.setItem(profileStorageKey, String(profile.id));
  };

  const createProfile = (name: string) => {
    createViewerProfile.mutate({ data: { name } }, { onSuccess: async (profile) => { await profilesQuery.refetch(); selectProfile(profile); } });
  };

  if (homeLoading || genresLoading || (user && profilesQuery.isLoading)) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const activeProfile = profilesQuery.data?.find(profile => profile.id === activeProfileId) ?? null;
  if (user && !activeProfile) return <CinemaProfileGate profiles={profilesQuery.data ?? []} onSelect={selectProfile} onCreate={createProfile} isCreating={createViewerProfile.isPending} />;

  const { hero, rows } = home || { hero: null, rows: [] };
  const visibleRows = activeGenre ? rows.map(row => ({ ...row, items: row.items.filter(title => title.genres.some(genre => genre.toLocaleLowerCase() === activeGenre.toLocaleLowerCase())) })).filter(row => row.items.length > 0) : rows;
  const hasVisibleTitles = activeGenre ? visibleRows.some(row => row.items.length > 0) : Boolean(hero) || visibleRows.some(row => row.items.length > 0);
  const heroReady = Boolean(hero?.playbackAvailable);

  return (
    <div className="relative z-10 overflow-hidden pb-16 sm:pb-24">
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.16] via-black to-primary/[0.10]">
        {hero?.backdropUrl && <img src={hero.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,12,0.96)_0%,rgba(6,7,12,0.8)_39%,rgba(6,7,12,0.18)_100%)]" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,hsl(var(--primary)/0.22),transparent_28%),radial-gradient(circle_at_15%_90%,rgba(99,102,241,0.2),transparent_35%)]" />
        <div className="relative mx-auto flex min-h-[390px] max-w-[1600px] flex-col justify-end px-4 py-10 sm:min-h-[500px] sm:px-6 sm:py-14 lg:px-8"><div className="absolute right-4 top-5 z-10 sm:right-6 sm:top-7 lg:right-8">{activeProfile && <button type="button" onClick={() => setActiveProfileId(null)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur transition-colors hover:bg-white/15"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">{activeProfile.name.slice(0, 1).toUpperCase()}</span>{activeProfile.name}</button>}</div>
          <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur"><Clapperboard className="h-3.5 w-3.5 text-primary" /> Kryv Cinema</div><h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{hero?.title || 'Kryv Cinema'}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">{hero?.synopsis || 'A carefully governed catalog for original and licensed stories, with title access tied to publishing and rights status.'}</p>{hero && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-white/65"><span>{hero.genres[0] || 'Kryv Cinema'}</span><span>{formatRuntime(hero.runtimeSeconds)}</span><span className={`inline-flex items-center gap-1.5 ${heroReady ? 'text-emerald-200' : 'text-white/55'}`}><LockKeyhole className="h-3.5 w-3.5" /> {heroReady ? 'Watch now' : 'Catalog preview'}</span></div>}<div className="mt-6 flex flex-wrap gap-3">{hero && <Link href={`/cinema/${hero.id}`}><Button className="h-11 rounded-xl bg-white px-5 text-sm font-black text-black hover:bg-white/90"><Info className="mr-2 h-4 w-4" /> Title details</Button></Link>}<span className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-black/25 px-4 text-xs font-bold text-white/70 backdrop-blur"><LockKeyhole className="h-3.5 w-3.5 text-primary" /> Rights-aware catalog</span></div></div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:space-y-14 sm:px-6 sm:py-10 lg:px-8">
        {hasVisibleTitles ? visibleRows.map((row, index) => <section key={`${row.title}-${index}`}><div className="mb-4 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">{activeGenre ? `${activeGenre} collection` : 'Cinema collection'}</span></div><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{activeGenre ? `${row.title} · ${activeGenre}` : row.title}</h2><p className="mt-1 text-xs text-white/40">Hover or focus a title for its real catalog metadata. Trailer playback only appears after a rights-cleared trailer asset is published.</p></div></div><RowScroller>{row.items.map((video, itemIndex) => <CinemaTitleCard key={video.id} video={video} index={itemIndex} />)}</RowScroller></section>) : activeGenre ? <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-white/[0.02] p-6 sm:flex-row sm:items-center sm:p-8"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{activeGenre} collection</p><h2 className="mt-2 text-2xl font-black text-white">No approved {activeGenre} titles yet.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">Cinema only shows titles that have been owner-published and are currently eligible for catalog display.</p></div><Button type="button" variant="outline" onClick={() => setActiveGenre(null)} className="shrink-0 border-primary/35 bg-primary/10 font-black text-primary hover:bg-primary hover:text-primary-foreground">Show all titles</Button></section> : <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-indigo-500/[0.07] p-6 sm:p-8"><div className="flex max-w-2xl flex-col gap-3"><div className="flex items-center gap-2 text-primary"><Clapperboard className="h-5 w-5" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Cinema control room</span></div><h2 className="text-2xl font-black text-white">The Cinema catalog is ready for its first approved title.</h2><p className="text-sm leading-relaxed text-white/55">Title artwork, runtime, trailers, original media, and rights windows are published through the owner workflow. Nothing is made playable merely because an image exists.</p></div></section>}

        <section aria-labelledby="cinema-genres"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Collection map</span></div><h2 id="cinema-genres" className="mt-1 text-2xl font-black text-white sm:text-3xl">Explore the catalog by genre</h2><p className="mt-1 text-sm text-white/45">Select a genre to filter the approved Cinema catalog by real title metadata.</p></div>{activeGenre && <Button type="button" variant="ghost" onClick={() => setActiveGenre(null)} className="w-fit font-black text-primary hover:bg-primary/10 hover:text-primary">Clear {activeGenre}</Button>}</div>{genres && genres.length > 0 ? <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">{genres.map((genre, index) => <button key={genre.id} type="button" onClick={() => setActiveGenre(current => current === genre.name ? null : genre.name)} aria-pressed={activeGenre === genre.name} className={`group relative aspect-[4/5] w-[42vw] shrink-0 snap-start overflow-hidden rounded-2xl border bg-white/[0.04] p-3 text-left transition sm:w-auto sm:shrink sm:p-4 ${activeGenre === genre.name ? 'border-primary ring-2 ring-primary/35' : 'border-white/[0.08] hover:-translate-y-1 hover:border-primary/50'}`}>{genre.imageUrl ? <img src={genre.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105" /> : <div className={`absolute inset-0 bg-gradient-to-br ${GENRE_THEMES[index % GENRE_THEMES.length]}`} />}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" /><div className="relative flex h-full flex-col justify-between"><span className={`w-fit rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur ${activeGenre === genre.name ? 'border-primary/50 bg-primary/25 text-primary' : 'border-white/20 bg-black/25 text-white/80'}`}>{activeGenre === genre.name ? 'Selected' : 'Catalog'}</span><div><Clapperboard className="mb-2 h-5 w-5 text-white/75" /><h3 className="text-sm font-black text-white sm:text-base">{genre.name}</h3><p className="mt-1 text-[11px] text-white/65">Filter titles</p></div></div></button>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">Genre collections are being organized.</div>}</section>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}
