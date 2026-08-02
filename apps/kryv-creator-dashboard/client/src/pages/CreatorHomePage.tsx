import { CreatorBadge, KryvLiveMark, KryvOrb } from "@/components/KryvBrand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowRight, CircleDollarSign, Eye, Radio, Users } from "lucide-react";
import { useLocation } from "wouter";
import { EmptyPanel, formatCount, formatCurrency, PageError, PageHeader, PageLoading } from "./creatorShared";

const activityIcon: Record<string, typeof Activity> = { stream_key_rotated: Radio, profile_updated: Users, stream_updated: Radio, notifications_updated: Activity };

export default function CreatorHomePage() {
  const { data, isLoading, isError, error, refetch } = trpc.creator.dashboard.useQuery();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError message={error?.message} onRetry={() => refetch()} />;

  const stats = [
    { label: "Live viewers", value: formatCount(data.stats.currentViewers), note: data.stream.isLive ? "Watching now" : "Offline", icon: Eye, tone: "text-cyan-300 bg-cyan-300/10" },
    { label: "Followers", value: formatCount(data.stats.followers), note: `${formatCount(data.stats.streamCount)} completed streams`, icon: Users, tone: "text-violet-300 bg-violet-300/10" },
    { label: "Creator revenue", value: formatCurrency(data.stats.revenueCents), note: "Recorded payouts & sessions", icon: CircleDollarSign, tone: "text-amber-300 bg-amber-300/10" },
  ];

  return <div className="mx-auto max-w-7xl">
    <PageHeader eyebrow="Creator studio" title={`Welcome back, ${data.profile.displayName.split(" ")[0] || "Creator"}.`} description="Monitor your live channel, manage stream access, and keep your audience experience on track." action={<Button onClick={() => setLocation("/stream")} className="kryv-action h-11 rounded-xl bg-violet-300 px-5 font-extrabold text-[#15111d] hover:bg-violet-200"><Radio className="mr-2 h-4 w-4" />Open stream setup</Button>} />

    <section className="kryv-card relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <KryvOrb />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2">{data.stream.isLive ? <KryvLiveMark /> : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.12em] text-white/45"><span className="h-1.5 w-1.5 rounded-full bg-white/35" />OFFLINE</span>}{user?.role === "admin" && <CreatorBadge kind="owner" />}</div><h2 className="kryv-title max-w-xl text-2xl font-bold text-white sm:text-3xl">{data.stream.streamTitle || "Your next broadcast is waiting."}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/52">{data.stream.rtmpServerUrl ? "Your RTMP endpoint is ready. Review your studio settings before you start sending a feed." : "Add a secure RTMP server endpoint before you can connect OBS or another streaming encoder."}</p></div>
        <div className="kryv-card-subtle flex min-w-[220px] flex-col rounded-2xl p-4 sm:p-5"><span className="kryv-label">Channel link</span><p className="mt-2 truncate font-mono text-sm text-violet-100">kryv.tv/{data.profile.channelSlug}</p><button onClick={() => setLocation("/channel")} className="kryv-action mt-4 inline-flex items-center gap-1 text-left text-xs font-bold text-violet-200 hover:text-violet-100">Manage channel <ArrowRight className="h-3.5 w-3.5" /></button></div>
      </div>
    </section>

    <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, note, icon: Icon, tone }) => <article key={label} className="kryv-card rounded-2xl p-5"><div className="flex items-start justify-between"><div><p className="kryv-label">{label}</p><p className="kryv-title mt-3 text-3xl font-bold text-white">{value}</p><p className="mt-2 text-xs text-white/42">{note}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span></div></article>)}
    </section>

    <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.28fr_.72fr]">
      <article className="kryv-card rounded-3xl p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="kryv-label">Recent activity</p><h2 className="kryv-title mt-1 text-xl font-bold text-white">Creator updates</h2></div><Activity className="h-5 w-5 text-violet-200" /></div>{data.recentActivity.length ? <div className="divide-y divide-white/[0.07]">{data.recentActivity.map((item) => { const Icon = activityIcon[item.type] ?? Activity; return <div className="flex gap-3 py-4 first:pt-0 last:pb-0" key={item.id}><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-300/10 text-violet-200"><Icon className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-white/86">{item.message}</p><p className="mt-1 text-xs text-white/38">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.occurredAt))}</p></div></div>; })}</div> : <EmptyPanel title="Your studio is ready" description="Profile updates, stream-key rotations, and preference changes will appear here." />}</article>
      <article className="kryv-card rounded-3xl p-5 sm:p-6"><p className="kryv-label">Quick start</p><h2 className="kryv-title mt-1 text-xl font-bold text-white">Take your channel live</h2><ol className="mt-5 space-y-4">{[["1","Configure your broadcast","Set a title and category."],["2","Create a stream key","Keep it private and secure."],["3","Connect your encoder","Use the recommended Kryv settings."]].map(([step, title, copy]) => <li className="flex gap-3" key={step}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-violet-300/25 bg-violet-300/10 text-xs font-extrabold text-violet-200">{step}</span><div><p className="text-sm font-bold text-white/85">{title}</p><p className="mt-0.5 text-xs leading-5 text-white/42">{copy}</p></div></li>)}</ol><Button variant="outline" onClick={() => setLocation("/stream")} className="kryv-action mt-6 w-full rounded-xl border-white/12 bg-white/[0.035] text-white hover:bg-white/[0.08] hover:text-white">Set up your stream <ArrowRight className="ml-2 h-4 w-4" /></Button></article>
    </section>
  </div>;
}
