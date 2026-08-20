import { useCreateChannelSafetyReport, useFollowChannel, useGetCreatorProfile, useGetMe, useUnfollowChannel } from '@workspace/api-client-react';
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
  MoreHorizontal,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Share2,
  Tv2,
  Users,
  UserPlus,
  Youtube,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { GoldenDBadge } from '@/components/brand/BrandIdentity';
import { VideoCard } from '@/components/VideoCard';
import { useToast } from '@/hooks/use-toast';
import { usePageMetadata } from '@/hooks/use-page-metadata';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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
  const { data: profile, isLoading, isError, refetch } = useGetCreatorProfile(slug || '', {
    query: { enabled: Boolean(slug), refetchInterval: 15000 },
  });
  const { data: me } = useGetMe();
  const followChannel = useFollowChannel();
  const unfollowChannel = useUnfollowChannel();
  const createChannelSafetyReport = useCreateChannelSafetyReport();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>('about');
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  usePageMetadata({
    title: profile?.channel.displayName ?? 'Creator profile',
    description: profile ? `Watch ${profile.channel.displayName} on Kryv: creator profile, Live broadcasts, Watch releases, and Cinema credits.` : 'Explore creators, Live broadcasts, and Watch releases on Kryv.',
    imageUrl: profile?.channel.avatarUrl,
    type: 'profile',
  });

  if (isLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isError || !profile) {
    return <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"><CircleDot className="h-8 w-8 text-white/20" /><h1 className="mt-4 text-xl font-black text-white">Creator profile unavailable</h1><p className="mt-2 max-w-md text-sm leading-relaxed text-white/45">This creator may have changed their channel URL or is no longer available on Kryv.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 text-sm font-black text-white transition hover:border-primary/45 hover:text-primary"><RefreshCw className="h-4 w-4" /> Retry</button><Link href="/live" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary hover:text-primary-foreground"><Radio className="h-4 w-4" /> Explore Live</Link></div></div>;
  }

  const { channel, live, watch, watchTotal, cinemaCredits } = profile;
  const isFollowPending = followChannel.isPending || unfollowChannel.isPending;
  const shareProfile = async () => {
    const shareData = { title: `${channel.displayName} on Kryv`, text: `Follow ${channel.displayName} on Kryv.`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      toast({ title: 'Profile link copied', description: 'Share this creator anywhere.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ title: 'Share unavailable', description: 'Your browser could not open or copy the profile link.', variant: 'destructive' });
    }
  };
  const handleFollow = () => {
    const mutation = channel.isFollowing ? unfollowChannel : followChannel;
    mutation.mutate({ id: channel.id }, {
      onSuccess: () => {
        void refetch();
        toast({ title: channel.isFollowing ? `Unfollowed ${channel.displayName}` : `Following ${channel.displayName}`, description: channel.isFollowing ? 'This channel has been removed from your followed creators.' : 'Live broadcasts from this creator will appear in your followed channels.' });
      },
      onError: (error: any) => toast({ title: 'Follow action unavailable', description: error?.body?.error || error?.message || 'The channel relationship could not be updated.', variant: 'destructive' }),
    });
  };
  const submitSafetyReport = (event: React.FormEvent) => {
    event.preventDefault();
    createChannelSafetyReport.mutate({ id: channel.id, data: { reason: reportReason as 'harassment' | 'hate_or_harm' | 'spam_or_scam' | 'sexual_content' | 'violence_or_threat' | 'impersonation' | 'other', ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}) } }, {
      onSuccess: () => {
        setReportOpen(false);
        setReportDetails('');
        toast({ title: 'Report received', description: 'Kryv recorded your report for owner safety review.' });
      },
      onError: (error: any) => toast({ title: 'Report could not be sent', description: error?.body?.error || error?.message || 'Please try again.', variant: 'destructive' }),
    });
  };
  const tabs: Array<{ id: ProfileTab; label: string; count?: number }> = [
    { id: 'about', label: 'About' },
    { id: 'live', label: 'Live', count: live.recentStreams.length || undefined },
    { id: 'watch', label: 'Watch', count: watchTotal || undefined },
    ...(cinemaCredits.length ? [{ id: 'cinema' as const, label: 'Cinema', count: cinemaCredits.length }] : []),
  ];
  const socialLinks = [
    { label: 'Website', href: channel.websiteUrl, Icon: Globe2 },
    { label: 'YouTube', href: channel.youtubeUrl, Icon: Youtube },
    { label: 'Instagram', href: channel.instagramUrl, Icon: Instagram },
    { label: 'X', href: channel.xUrl, Icon: ExternalLink },
  ].filter((link): link is { label: string; href: string; Icon: typeof Globe2 } => Boolean(link.href));

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] sm:rounded-3xl">
        {channel.bannerUrl ? <img src={channel.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(51,238,196,0.18),transparent_34%),linear-gradient(130deg,rgba(91,70,255,0.22),rgba(10,13,19,0.98)_55%)]" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090b11] via-[#090b11]/90 to-[#090b11]/50" />
        <div className="relative flex flex-col gap-5 px-4 py-6 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-11">
          <div className="flex min-w-0 items-center gap-3.5 sm:items-end sm:gap-5">
            <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border-2 border-white/[0.14] bg-primary/15 shadow-2xl sm:h-24 sm:w-24">
              {channel.avatarUrl ? <img src={channel.avatarUrl} alt={channel.displayName} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-black text-primary">{channel.displayName[0]}</span>}
              <span className={`absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-[#090b11] ${live.isLive ? 'bg-red-400' : 'bg-white/35'}`} />
            </div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5 sm:gap-2"><p className="truncate text-xl font-semibold tracking-tight text-white sm:text-3xl sm:font-black">{channel.displayName}</p>{Number(channel.ownerUserId) === 1 && <GoldenDBadge />}</div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold text-white/55"><span className={`inline-flex items-center gap-1.5 ${live.isLive ? 'text-red-200' : 'text-white/45'}`}><CircleDot className={`h-3.5 w-3.5 ${live.isLive ? 'text-red-400' : 'text-white/35'}`} />{live.isLive ? 'Live now' : 'Offline'}</span><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" />{channel.followerCount.toLocaleString()} followers</span>{channel.categoryName && <span>{channel.categoryName}</span>}</div></div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Link href={`/live/${channel.slug}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 sm:px-4 sm:font-black"><Radio className="h-4 w-4" /> <span className="truncate">{live.isLive ? 'Watch live' : 'Channel'}</span></Link>
            {!channel.isOwner && (me ? <button type="button" onClick={handleFollow} disabled={isFollowPending} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-center text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:font-black ${channel.isFollowing ? 'border-primary/45 bg-primary/10 text-primary hover:bg-primary/20' : 'border-white/[0.12] bg-black/25 text-white/75 hover:border-primary/45 hover:text-white'}`}>{isFollowPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} <span className="truncate">{channel.isFollowing ? 'Following' : 'Follow'}</span></button> : <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 text-center text-sm font-semibold text-white/75 transition hover:border-primary/45 hover:text-white sm:px-4 sm:font-black"><UserPlus className="h-4 w-4" /> <span className="truncate">Follow</span></Link>)}
            <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
              <SheetTrigger asChild><button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 text-sm font-semibold text-white/75 transition hover:border-primary/45 hover:text-primary sm:hidden"><MoreHorizontal className="h-4 w-4" /> More</button></SheetTrigger>
              <SheetContent side="bottom" className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] rounded-t-3xl border-white/[0.12] bg-[#0b0e14] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 text-white sm:hidden">
                <SheetHeader className="pr-10 text-left"><SheetTitle className="text-white">More from {channel.displayName}</SheetTitle><SheetDescription className="text-white/55">Browse this creator, share their profile, or use the safety tools.</SheetDescription></SheetHeader>
                <div className="mt-6 grid gap-2">
                  <SheetClose asChild><Link href="/watch" className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-semibold text-white transition hover:border-primary/45 hover:text-primary"><Tv2 className="h-4 w-4 text-primary" /> Explore Watch</Link></SheetClose>
                  <SheetClose asChild><button type="button" onClick={() => { void shareProfile(); setActionsOpen(false); }} className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-left text-sm font-semibold text-white transition hover:border-primary/45 hover:text-primary"><Share2 className="h-4 w-4 text-primary" /> Share profile</button></SheetClose>
                  {!channel.isOwner && (me ? <SheetClose asChild><button type="button" onClick={() => { setActionsOpen(false); setReportOpen(true); }} className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-red-300/15 bg-red-500/[0.04] px-4 text-left text-sm font-semibold text-red-100 transition hover:border-red-300/35 hover:bg-red-500/[0.1]"><ShieldAlert className="h-4 w-4" /> Report creator</button></SheetClose> : <SheetClose asChild><Link href="/sign-in" className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-red-300/15 bg-red-500/[0.04] px-4 text-sm font-semibold text-red-100 transition hover:border-red-300/35 hover:bg-red-500/[0.1]"><ShieldAlert className="h-4 w-4" /> Sign in to report</Link></SheetClose>)}
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/watch" className="hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 text-center text-sm font-black text-white/75 transition hover:border-primary/45 hover:text-white sm:inline-flex sm:px-4"><Tv2 className="h-4 w-4" /> <span className="truncate">Watch</span></Link>
            <button type="button" onClick={() => void shareProfile()} className="hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 text-center text-sm font-black text-white/75 transition hover:border-primary/45 hover:text-primary sm:inline-flex sm:px-4"><Share2 className="h-4 w-4" /> <span className="truncate">Share</span></button>
          </div>
        </div>
      </section>

      <nav className="sticky top-[var(--kryv-header-height)] z-30 -mx-4 mt-4 flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain border-y border-white/[0.08] bg-[#090b11]/95 px-4 py-2 [scroll-padding-inline:1rem] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:static sm:mx-0 sm:mt-5 sm:rounded-2xl sm:border sm:bg-black/20 sm:p-1.5" aria-label={`${channel.displayName} profile sections`}>
        {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-selected={activeTab === tab.id} className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-4 text-sm font-semibold transition sm:font-black ${activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.23)]' : 'text-white/50 hover:bg-white/[0.07] hover:text-white'}`}>{tab.label}{tab.count !== undefined && <span className={`hidden rounded-full px-1.5 py-0.5 text-[10px] sm:inline-flex ${activeTab === tab.id ? 'bg-black/15' : 'bg-white/[0.08] text-white/45'}`}>{tab.count}</span>}</button>)}
      </nav>

      {activeTab === 'about' && <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"><article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><div className="flex items-center gap-2 text-primary"><CircleDot className="h-4 w-4" /><span className="text-xs font-semibold tracking-wide sm:text-[11px] sm:font-black sm:uppercase sm:tracking-[0.18em]">Creator identity</span></div><h1 className="mt-2 text-2xl font-black tracking-tight text-white">About {channel.displayName}</h1><p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/60">{channel.description || `${channel.displayName} has not published an About section yet. Their official destinations and ready-to-watch releases will appear here as they are added.`}</p>{socialLinks.length ? <div className="mt-7 grid gap-3 sm:grid-cols-2">{socialLinks.map(({ label, href, Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" className="group flex min-h-20 items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-4 transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/[0.07]"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="text-sm font-black text-white">{label}</span></div><ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-primary" /></a>)}</div> : <div className="mt-7 rounded-xl border border-dashed border-white/[0.12] bg-black/15 p-4 text-sm leading-relaxed text-white/40">Official links have not been added to this profile.</div>}</article><aside className="rounded-2xl border border-primary/18 bg-primary/[0.045] p-5"><div className="flex items-center gap-2 text-primary"><CalendarDays className="h-4 w-4" /><p className="text-xs font-semibold tracking-wide sm:text-[11px] sm:font-black sm:uppercase sm:tracking-[0.18em]">On Kryv since</p></div><p className="mt-3 text-lg font-black text-white">{formatDate(channel.createdAt)}</p><p className="mt-2 text-xs leading-relaxed text-white/45">This profile brings live broadcasts, ready Watch uploads, and only owner-curated Cinema credits into one creator identity.</p><div className="mt-6 border-t border-white/[0.08] pt-5">{!channel.isOwner && (me ? <button type="button" onClick={() => setReportOpen(true)} className="inline-flex min-h-10 items-center gap-2 text-xs font-black text-white/45 transition hover:text-red-200"><ShieldAlert className="h-3.5 w-3.5" /> Report this creator</button> : <Link href="/sign-in" className="inline-flex min-h-10 items-center gap-2 text-xs font-black text-white/45 transition hover:text-red-200"><ShieldAlert className="h-3.5 w-3.5" /> Sign in to report</Link>)}</div></aside></section>}

      {!channel.isOwner && me && <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent className="border-white/[0.12] bg-[#0b0e14] text-white sm:max-w-md"><DialogHeader><DialogTitle className="text-white">Report {channel.displayName}</DialogTitle><DialogDescription className="leading-relaxed text-white/50">Reports are recorded for owner safety review. Provide only information relevant to the creator channel.</DialogDescription></DialogHeader><form onSubmit={submitSafetyReport} className="space-y-4"><label className="block text-xs font-black uppercase tracking-wider text-white/55">Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.1] bg-black/35 px-3 text-sm font-semibold text-white outline-none focus:border-primary/60"><option value="harassment">Harassment</option><option value="hate_or_harm">Hate or harm</option><option value="spam_or_scam">Spam or scam</option><option value="sexual_content">Sexual content</option><option value="violence_or_threat">Violence or threat</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label><label className="block text-xs font-black uppercase tracking-wider text-white/55">Optional details<Textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} placeholder="What should the safety reviewer know?" className="mt-2 min-h-28 border-white/[0.1] bg-black/35 text-white placeholder:text-white/30 focus-visible:ring-primary" /></label><p className="text-right text-[10px] text-white/30">{reportDetails.length}/500</p><DialogFooter><Button type="button" variant="ghost" onClick={() => setReportOpen(false)} disabled={createChannelSafetyReport.isPending} className="text-white/60">Cancel</Button><Button type="submit" disabled={createChannelSafetyReport.isPending} className="font-black">{createChannelSafetyReport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}Send report</Button></DialogFooter></form></DialogContent></Dialog>}

      {activeTab === 'live' && <section className="mt-6"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Radio className="h-4 w-4" /><span className="text-xs font-semibold tracking-wide sm:text-[11px] sm:font-black sm:uppercase sm:tracking-[0.18em]">Live room</span></div><h1 className="mt-2 text-2xl font-black text-white">{live.isLive ? live.streamTitle || `${channel.displayName} is live` : `${channel.displayName} is offline`}</h1><p className="mt-2 text-sm leading-relaxed text-white/50">{live.isLive ? `${live.viewerCount.toLocaleString()} viewers are watching now.` : 'Return here when the creator starts their next broadcast.'}</p></div><Link href={`/live/${channel.slug}`} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary hover:text-primary-foreground"><Play className="h-4 w-4 fill-current" /> {live.isLive ? 'Join live' : 'View channel'}</Link></div></div><div className="mt-6"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h2 className="text-lg font-black text-white">Recent broadcasts</h2></div>{live.recentStreams.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{live.recentStreams.map((stream) => <article key={stream.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="truncate text-sm font-black text-white">{stream.title || `${channel.displayName} live broadcast`}</p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-white/40"><span>{formatDate(stream.startedAt)}</span><span>{formatDuration(stream.durationSeconds)}</span></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-8 text-center"><Radio className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-bold text-white/60">No broadcast history yet</p><p className="mt-1 text-xs leading-relaxed text-white/35">Completed broadcasts will appear here after this creator goes live.</p></div>}</div></section>}

      {activeTab === 'watch' && <section className="mt-6"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Tv2 className="h-4 w-4" /><span className="text-xs font-semibold tracking-wide sm:text-[11px] sm:font-black sm:uppercase sm:tracking-[0.18em]">Creator library</span></div><h1 className="mt-2 text-2xl font-black text-white">Watch {channel.displayName}</h1>{watchTotal > watch.length && <p className="mt-2 text-sm leading-relaxed text-white/45">Showing the newest {watch.length.toLocaleString()} of {watchTotal.toLocaleString()} ready releases.</p>}</div><Link href={`/watch?channelId=${channel.id}`} className="inline-flex items-center gap-1.5 text-sm font-black text-primary hover:text-white">View all {watchTotal.toLocaleString()} releases <ArrowUpRight className="h-4 w-4" /></Link></div>{watch.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 lg:grid-cols-3 xl:grid-cols-4">{watch.map((video) => <VideoCard key={video.id} video={video} />)}</div> : <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-8 text-center sm:p-12"><Play className="mx-auto h-8 w-8 text-white/20" /><h2 className="mt-4 text-lg font-black text-white">No ready Watch uploads</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/40">This creator has not published a processed video to Watch yet. Only ready-to-play uploads appear here.</p></div>}</section>}

      {activeTab === 'cinema' && cinemaCredits.length > 0 && <section className="mt-6"><div className="mb-5"><div className="flex items-center gap-2 text-primary"><Clapperboard className="h-4 w-4" /><span className="text-xs font-semibold tracking-wide sm:text-[11px] sm:font-black sm:uppercase sm:tracking-[0.18em]">Curated filmography</span></div><h1 className="mt-2 text-2xl font-black text-white">Cinema credits</h1><p className="mt-2 text-sm text-white/45">Production titles where this creator has an owner-curated credit.</p></div><div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{cinemaCredits.map((credit) => <Link key={`${credit.id}-${credit.role}`} href={`/cinema/${credit.id}`} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] transition hover:-translate-y-1 hover:border-primary/45"><div className="relative aspect-[2/3] overflow-hidden bg-black/45">{credit.posterUrl ? <img src={credit.posterUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><Film className="h-9 w-9 text-white/20" /></div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4"><span className="inline-flex rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">{credit.role}</span></div></div><div className="p-4"><p className="truncate text-base font-black text-white">{credit.title}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">{credit.synopsis || 'Owner-curated Cinema production.'}</p></div></Link>)}</div></section>}
    </div>
  );
}
