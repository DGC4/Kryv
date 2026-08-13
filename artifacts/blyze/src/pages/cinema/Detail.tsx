import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useGetCinemaTitle } from '@workspace/api-client-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { ArrowLeft, Clapperboard, Film, Info, Loader2, LockKeyhole, Play, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatRuntime(seconds: number | null) {
  if (!seconds) return 'Runtime unavailable';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function entitlementLabel(entitlement: 'free' | 'subscription' | 'rental' | 'purchase') {
  if (entitlement === 'free') return 'Included on Kryv';
  if (entitlement === 'subscription') return 'Subscription access';
  if (entitlement === 'rental') return 'Rental access';
  return 'Purchase access';
}

export default function CinemaDetail() {
  const { id } = useParams<{ id: string }>();
  const cinemaTitleId = Number.parseInt(id || '0', 10);
  const { data: title, isLoading, refetch: refetchTitle } = useGetCinemaTitle(cinemaTitleId, { query: { enabled: Number.isSafeInteger(cinemaTitleId) && cinemaTitleId > 0 } as any });
  const [showTrailer, setShowTrailer] = useState(false);

  if (isLoading) return <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!title) return <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 bg-black px-6 text-center"><Clapperboard className="h-8 w-8 text-primary/70" /><p className="text-xl font-black text-white">This Cinema title is unavailable</p><p className="max-w-sm text-sm text-white/45">It may be outside its publication or viewing window.</p><div className="mt-2 flex flex-wrap justify-center gap-3"><Button type="button" variant="secondary" onClick={() => refetchTitle()}>Retry</Button><Link href="/cinema"><Button variant="secondary">Return to Cinema</Button></Link></div></div>;

  return (
    <div className="relative z-10 min-h-screen overflow-hidden bg-black text-white">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {title.backdropUrl ? <img src={title.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" /> : <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/35 via-black to-primary/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/35" />
        <Link href="/cinema" className="absolute left-4 top-5 z-20 sm:left-6 sm:top-7" aria-label="Return to Cinema"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"><ArrowLeft className="h-5 w-5" /></span></Link>
        <div className="relative mx-auto flex min-h-[310px] max-w-[1200px] items-end px-4 pb-8 pt-24 sm:min-h-[400px] sm:px-6 sm:pb-12 lg:px-8"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> {entitlementLabel(title.entitlementType)}</div><h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{title.title}</h1><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-white/70"><span>{formatRuntime(title.runtimeSeconds)}</span><span>{title.maturityLevel} audience</span>{title.genres.map(genre => <span key={genre} className="rounded border border-white/20 px-2 py-0.5 text-xs text-white/60">{genre}</span>)}</div></div></div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {title.playbackAvailable && title.featurePlaybackId ? <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl sm:rounded-3xl"><HlsPlayer src={`https://stream.fastpix.com/${title.featurePlaybackId}.m3u8`} poster={title.backdropUrl || title.posterUrl || undefined} className="h-full w-full" /></div> : <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.12),transparent_34%),#050505] px-5 text-center shadow-2xl sm:rounded-3xl"><LockKeyhole className="h-8 w-8 text-amber-100/80" /><p className="mt-4 text-lg font-black text-white">Viewing access is not available yet</p><p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">{title.playbackBlockedReason || 'This title is visible in the owner-published catalog, but playback is not currently available.'}</p><span className="mt-5 inline-flex rounded-full border border-white/[0.12] bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/60">{entitlementLabel(title.entitlementType)}</span></div>}
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article>
            <div className="flex items-center gap-2 text-primary"><Info className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">About this title</span></div>
            <p className="mt-3 text-base leading-relaxed text-white/75">{title.synopsis || 'Title details will be added by the Cinema publishing team.'}</p>
            {title.trailerPlaybackId && <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play className="h-4 w-4 fill-current" /></span><div><p className="text-sm font-black text-white">Trailer available</p><p className="text-xs text-white/45">This preview is an owner-approved Cinema asset.</p></div></div><Button type="button" variant="secondary" size="sm" onClick={() => setShowTrailer(value => !value)}>{showTrailer ? 'Hide trailer' : 'Watch trailer'}</Button></div>{showTrailer && <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black"><HlsPlayer src={`https://stream.fastpix.com/${title.trailerPlaybackId}.m3u8`} poster={title.backdropUrl || title.posterUrl || undefined} className="h-full w-full" /></div>}</div>}
            {title.credits.length > 0 && <section className="mt-8 border-t border-white/[0.08] pt-7"><div className="flex items-center gap-2 text-primary"><Users className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Creator credits</span></div><p className="mt-2 text-sm leading-relaxed text-white/45">These profiles are credited by the owner publishing desk for this production.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{title.credits.map(credit => <Link key={`${credit.channelId}-${credit.role}`} href={`/profile/${credit.channelSlug}`} className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.06]"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-primary/15">{credit.channelAvatarUrl ? <img src={credit.channelAvatarUrl} alt={credit.channelDisplayName} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-black text-primary">{credit.channelDisplayName[0]}</span>}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white transition group-hover:text-primary">{credit.channelDisplayName}</p><p className="mt-0.5 text-xs text-white/45">{credit.role}</p></div></Link>)}</div></section>}
          </article>
          <aside className="h-fit rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Viewing access</p><p className="mt-3 text-sm font-black text-white">{entitlementLabel(title.entitlementType)}</p><p className="mt-2 text-xs leading-relaxed text-white/45">{title.playbackAvailable ? 'Availability is controlled by the title’s active publishing and rights settings.' : title.playbackBlockedReason || 'This title’s current entitlement cannot be fulfilled in Kryv yet.'}</p><div className="mt-5 border-t border-white/[0.08] pt-4"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-200"><LockKeyhole className="h-3.5 w-3.5" /> Rights-cleared release</div><p className="mt-2 text-[11px] leading-relaxed text-white/35">Cinema playback is intentionally separate from live chat and broadcast controls.</p></div><div className="mt-5 border-t border-white/[0.08] pt-4"><Link href="/cinema" className="inline-flex items-center gap-2 text-xs font-black text-primary hover:text-white"><Film className="h-3.5 w-3.5" /> Continue browsing Cinema</Link></div></aside>
        </div>
      </main>
    </div>
  );
}
