import { useGetCreatorProfile } from '@workspace/api-client-react';
import {
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Clapperboard,
  ExternalLink,
  Film,
  Globe2,
  Instagram,
  Loader2,
  Play,
  Radio,
  Tv2,
  Users,
  Youtube,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { GoldenDBadge } from '@/components/brand/BrandIdentity';
import { VideoCard } from '@/components/VideoCard';

type ProfileTab = 'about' | 'live' | 'watch' | 'cinema';

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatDuration(value: number | null) {
  if (!value) return 'Stream duration unavailable';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function CreatorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading, isError } = useGetCreatorProfile(slug || '', {
    query: { enabled: Boolean(slug), refetchInterval: 15000 },
  });
  const [activeTab, setActiveTab] = useState<ProfileTab>('about');

  if (isLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isError || !profile) {
    return <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"><CircleDot className="h-8 w-8 text-white/20" /><h1 className="mt-4 text-xl font-black text-white">Creator profile unavailable</h1><p className="mt-2 max-w-md text-sm leading-relaxed text-white/45">This creator may have changed their channel URL or is no longer available on Kryv.</p><Link href="/live" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary hover:text-primary-foreground"><Radio className="h-4 w-4" /> Explore Live</Link></div>;
  }

  const { channel, live, watch, cinemaCredits } = profile;
  const tabs: Array<{ id: ProfileTab; label: string; count?: number }> = [
    { id: 'about', label: 'About' },
    { id: 'live', label: 'Live', count: live.recentStreams.length || undefined },
    { id: 'watch', label: 'Watch', count: watch.length || undefined },
    ...(cinemaCredits.length ? [{ id: 'cinema' as const, label: 'Cinema', count: cinemaCredits.length }] : []),
  ];
  const socialLinks = [
    { label: 'Website', href: channel.websiteUrl, Icon: Globe2 },
    { label: 'YouTube', href: channel.youtubeUrl, Icon: Youtube },
    { label: 'Instagram', href: channel.instagramUrl, Icon: Instagram },
    { label: 'X', href: channel.xUrl, Icon: ExternalLink },
  ].filter((link): link is { label: string; href: string; Icon: typeof Globe2 } => Boolean(link.href));

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] sm:rounded-3xl">
        {channel.bannerUrl ? <img src={channel.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(51,238,196,0.18),transparent_34%),linear-gradient(130deg,rgba(91,70,255,0.22),rgba(10,13,19,0.98)_55%)]" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090b11] via-[#090b11]/90 to-[#090b11]/50" />
        <div className="relative flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-11">
          <div className="flex min-w-0 items-end gap-4 sm:gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/[0.14] bg-primary/15 shadow-2xl sm:h-24 sm:w-24">
              {channel.avatarUrl ? <img src={channel.avatarUrl} alt={channel.displayName} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-black text-primary">{channel.displayName[0]}</span>}
              <span className={`absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-[#090b11] ${live.isLive ? 'bg-red-400' : 'bg-white/35'}`} />
            </div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{channel.displayName}</p>{Number(channel.ownerUserId) === 1 && <GoldenDBadge />}</div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold text-white/55"><span className={`inline-flex items-center gap-1.5 ${live.isLive ? 'text-red-200' : 'text-white/45'}`}><CircleDot className={`h-3.5 w-3.5 ${live.isLive ? 'text-red-400' : 'text-white/35'}`} />{live.isLive ? 'Live now' : 'Offline'}</span><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" />{channel.followerCount.toLocaleString()} followers</span>{channel.categoryName && <span>{channel.categoryName}</span>}</div></div>
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/live/${channel.slug}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90"><Radio className="h-4 w-4" /> {live.isLive ? 'Watch live' : 'Open channel'}</Link><Link href="/watch" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-4 text-sm font-black text-white/75 transition hover:border-primary/45 hover:text-white"><Tv2 className="h-4 w-4" /> Watch Kryv</Link></div>
        </div>
      </section>

      <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/20 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={`${channel.displayName} profile sections`}>
        {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black transition ${activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.23)]' : 'text-white/50 hover:bg-white/[0.07] hover:text-white'}`}>{tab.label}{tab.count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-black/15' : 'bg-white/[0.08] text-white/45'}`}>{tab.count}</span>}</button>)}
      </nav>

      {activeTab === 'about' && <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"><article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><div className="flex items-center gap-2 text-primary"><CircleDot className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Creator identity</span></div><h1 className="mt-2 text-2xl font-black tracking-tight text-white">About {channel.displayName}</h1><p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/60">{channel.description || `${channel.displayName} has not published an About section yet. Their official destinations and ready-to-watch releases will appear here as they are added.`}</p>{socialLinks.length ? <div className="mt-7 grid gap-3 sm:grid-cols-2">{socialLinks.map(({ label, href, Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" className="group flex min-h-20 items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-4 transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/[0.07]"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="text-sm font-black text-white">{label}</span></div><ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-primary" /></a>)}</div> : <div className="mt-7 rounded-xl border border-dashed border-white/[0.12] bg-black/15 p-4 text-sm leading-relaxed text-white/40">Official links have not been added to this profile.</div>}</article><aside className="rounded-2xl border border-primary/18 bg-primary/[0.045] p-5"><div className="flex items-center gap-2 text-primary"><CalendarDays className="h-4 w-4" /><p className="text-[11px] font-black uppercase tracking-[0.18em]">On Kryv since</p></div><p className="mt-3 text-lg font-black text-white">{formatDate(channel.createdAt)}</p><p className="mt-2 text-xs leading-relaxed text-white/45">This profile brings live broadcasts, ready Watch uploads, and only owner-curated Cinema credits into one creator identity.</p></aside></section>}

      {activeTab === 'live' && <section className="mt-6"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Radio className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Live room</span></div><h1 className="mt-2 text-2xl font-black text-white">{live.isLive ? live.streamTitle || `${channel.displayName} is live` : `${channel.displayName} is offline`}</h1><p className="mt-2 text-sm leading-relaxed text-white/50">{live.isLive ? `${live.viewerCount.toLocaleString()} viewers are watching now.` : 'Return here when the creator starts their next broadcast.'}</p></div><Link href={`/live/${channel.slug}`} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary hover:text-primary-foreground"><Play className="h-4 w-4 fill-current" /> {live.isLive ? 'Join live' : 'View channel'}</Link></div></div><div className="mt-6"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h2 className="text-lg font-black text-white">Recent broadcasts</h2></div>{live.recentStreams.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{live.recentStreams.map((stream) => <article key={stream.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="truncate text-sm font-black text-white">{stream.title || `${channel.displayName} live broadcast`}</p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-white/40"><span>{formatDate(stream.startedAt)}</span><span>{formatDuration(stream.durationSeconds)}</span></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-8 text-center"><Radio className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-bold text-white/60">No broadcast history yet</p><p className="mt-1 text-xs leading-relaxed text-white/35">Completed broadcasts will appear here after this creator goes live.</p></div>}</div></section>}

      {activeTab === 'watch' && <section className="mt-6"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Tv2 className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Creator library</span></div><h1 className="mt-2 text-2xl font-black text-white">Watch {channel.displayName}</h1></div><Link href="/watch" className="inline-flex items-center gap-1.5 text-sm font-black text-primary hover:text-white">Explore all Watch <ArrowUpRight className="h-4 w-4" /></Link></div>{watch.length ? <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">{watch.map((video) => <VideoCard key={video.id} video={video} />)}</div> : <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-8 text-center sm:p-12"><Play className="mx-auto h-8 w-8 text-white/20" /><h2 className="mt-4 text-lg font-black text-white">No ready Watch uploads</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/40">This creator has not published a processed video to Watch yet. Only ready-to-play uploads appear here.</p></div>}</section>}

      {activeTab === 'cinema' && cinemaCredits.length > 0 && <section className="mt-6"><div className="mb-5"><div className="flex items-center gap-2 text-primary"><Clapperboard className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Curated filmography</span></div><h1 className="mt-2 text-2xl font-black text-white">Cinema credits</h1><p className="mt-2 text-sm text-white/45">Production titles where this creator has an owner-curated credit.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cinemaCredits.map((credit) => <Link key={`${credit.id}-${credit.role}`} href={`/cinema/${credit.id}`} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] transition hover:-translate-y-1 hover:border-primary/45"><div className="relative aspect-[2/3] overflow-hidden bg-black/45">{credit.posterUrl ? <img src={credit.posterUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><Film className="h-9 w-9 text-white/20" /></div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4"><span className="inline-flex rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">{credit.role}</span></div></div><div className="p-4"><p className="truncate text-base font-black text-white">{credit.title}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">{credit.synopsis || 'Owner-curated Cinema production.'}</p></div></Link>)}</div></section>}
    </div>
  );
}
