import { useGetUserProfile } from '@workspace/api-client-react';
import { CalendarDays, CircleDot, Loader2, Radio, RefreshCw, Tv2, UserRound, Users } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { usePageMetadata } from '@/hooks/use-page-metadata';

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading, isError, refetch } = useGetUserProfile(username || '', { query: { enabled: Boolean(username) } as any });
  usePageMetadata({
    title: profile ? `${profile.username} on Kryv` : 'Kryv profile',
    description: profile ? `View ${profile.username}'s public Kryv account profile${profile.creatorChannel ? ', creator channel, and live status' : ''}.` : 'Explore public account identity on Kryv.',
    imageUrl: profile?.avatarUrl || profile?.creatorChannel?.avatarUrl,
    type: 'profile',
  });

  if (isLoading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (isError || !profile) return <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"><UserRound className="h-8 w-8 text-white/20" /><h1 className="mt-4 text-xl font-bold text-white">Profile unavailable</h1><p className="mt-2 max-w-md text-sm leading-relaxed text-white/45">This Kryv account may have changed its username or is no longer available.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-primary/45 hover:text-primary"><RefreshCw className="h-4 w-4" /> Retry</button><Link href="/live" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"><Radio className="h-4 w-4" /> Explore Live</Link></div></div>;

  const channel = profile.creatorChannel;
  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] sm:rounded-3xl">
        <div className="relative flex flex-col gap-5 px-4 py-6 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-11">
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-5">
            <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/[0.14] bg-primary/15 text-3xl font-semibold text-primary sm:h-24 sm:w-24">{profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.username} className="h-full w-full object-cover" /> : profile.username.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-3xl">{profile.username}</h1>{profile.role === 'owner' && <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Owner</span>}</div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-white/55"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" />On Kryv since {formatDate(profile.createdAt)}</span>{channel && <span className={`inline-flex items-center gap-1.5 ${channel.isLive ? 'text-primary' : 'text-white/45'}`}><CircleDot className={`h-3.5 w-3.5 ${channel.isLive ? 'text-primary' : 'text-white/35'}`} />{channel.isLive ? 'Live now' : 'Creator channel'}</span>}</div></div>
          </div>
          {channel && <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Link href={`/profile/${channel.slug}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 sm:px-4"><Tv2 className="h-4 w-4" /> <span className="truncate">Creator profile</span></Link><Link href={`/live/${channel.slug}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 text-center text-sm font-semibold text-white/75 transition hover:border-primary/45 hover:text-white sm:px-4"><Radio className="h-4 w-4" /> <span className="truncate">{channel.isLive ? 'Watch live' : 'Channel'}</span></Link></div>}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><div className="flex items-center gap-2 text-primary"><UserRound className="h-4 w-4" /><span className="text-xs font-semibold">Kryv account</span></div><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{channel ? 'Creator identity' : 'Public account profile'}</h2><p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/60">{channel ? `${profile.username} has a public creator channel on Kryv. Visit the creator profile for live broadcasts, ready Watch releases, and owner-curated Cinema credits.` : `${profile.username} has a public Kryv account. A creator channel, if they choose to launch one, will appear here without changing this account identity.`}</p>{channel && <div className="mt-7 rounded-2xl border border-white/[0.08] bg-black/20 p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.1] bg-primary/15 text-base font-semibold text-primary">{channel.avatarUrl ? <img src={channel.avatarUrl} alt={channel.displayName} className="h-full w-full object-cover" /> : channel.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{channel.displayName}</p><p className="mt-1 truncate text-xs text-white/45">{channel.isLive ? channel.streamTitle || 'Live on Kryv' : `${channel.followerCount.toLocaleString()} followers`}</p></div></div></div>}</article>
        <aside className="rounded-2xl border border-primary/18 bg-primary/[0.045] p-5"><div className="flex items-center gap-2 text-primary"><Users className="h-4 w-4" /><p className="text-xs font-semibold">Profile scope</p></div><p className="mt-3 text-sm font-semibold text-white">One account identity</p><p className="mt-2 text-xs leading-relaxed text-white/45">Kryv does not create a separate public account for creators. A creator channel is an optional public layer attached to the same signed-in identity.</p></aside>
      </section>
    </div>
  );
}
