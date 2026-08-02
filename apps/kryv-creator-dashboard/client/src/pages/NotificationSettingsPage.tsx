import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, CircleDollarSign, Radio, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageError, PageHeader, PageLoading } from "./creatorShared";

type Preferences = { streamAlerts: boolean; followerAlerts: boolean; revenueAlerts: boolean; weeklyDigest: boolean };
const preferenceRows: Array<{ key: keyof Preferences; title: string; description: string; icon: typeof Radio; tone: string }> = [
  { key: "streamAlerts", title: "Stream alerts", description: "Receive updates about your connected stream and broadcast status.", icon: Radio, tone: "text-rose-200 bg-rose-300/10" },
  { key: "followerAlerts", title: "Follower notifications", description: "Keep creator alerts on when new followers are recorded for your channel.", icon: Users, tone: "text-violet-200 bg-violet-300/10" },
  { key: "revenueAlerts", title: "Revenue updates", description: "Get a notification when recorded revenue or a payout status changes.", icon: CircleDollarSign, tone: "text-emerald-200 bg-emerald-300/10" },
  { key: "weeklyDigest", title: "Weekly digest", description: "Receive a weekly summary after analytics and notifications are connected.", icon: Bell, tone: "text-cyan-200 bg-cyan-300/10" },
];

export default function NotificationSettingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading, isError, error, refetch } = trpc.creator.dashboard.useQuery();
  const [preferences, setPreferences] = useState<Preferences>({ streamAlerts: true, followerAlerts: true, revenueAlerts: true, weeklyDigest: true });
  const update = trpc.creator.notifications.update.useMutation({ onSuccess: async () => { await utils.creator.dashboard.invalidate(); toast.success("Notification preferences saved."); }, onError: (issue) => toast.error(issue.message) });
  useEffect(() => { if (data) { setPreferences({ streamAlerts: data.notifications.streamAlerts, followerAlerts: data.notifications.followerAlerts, revenueAlerts: data.notifications.revenueAlerts, weeklyDigest: data.notifications.weeklyDigest }); } }, [data?.notifications.streamAlerts, data?.notifications.followerAlerts, data?.notifications.revenueAlerts, data?.notifications.weeklyDigest]);
  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError message={error?.message} onRetry={() => refetch()} />;
  return <div className="mx-auto max-w-5xl"><PageHeader eyebrow="Creator studio / notifications" title="Decide what reaches you." description="These preferences are stored with your authenticated creator account. Delivery channels can be connected as Kryv notification services are enabled." /><section className="kryv-card rounded-3xl p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Bell className="h-5 w-5" /></span><div><p className="kryv-label">Alert controls</p><h2 className="kryv-title text-xl font-bold text-white">Creator notifications</h2></div></div><div className="mt-6 divide-y divide-white/[0.07]">{preferenceRows.map((item) => { const Icon = item.icon; return <div className="flex gap-4 py-5 first:pt-0 last:pb-0" key={item.key}><span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.tone}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold text-white/88">{item.title}</p><p className="mt-1 max-w-xl text-sm leading-6 text-white/47">{item.description}</p></div><Switch checked={preferences[item.key]} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, [item.key]: checked }))} aria-label={`Toggle ${item.title}`} className="mt-2" /></div>; })}</div><div className="mt-7 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2 text-xs leading-5 text-white/40"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />Preferences apply to future delivery channels. Kryv will not send any notification until a corresponding delivery service is connected.</div><Button onClick={() => update.mutate(preferences)} disabled={update.isPending} className="kryv-action h-11 shrink-0 rounded-xl bg-violet-300 px-5 font-extrabold text-[#15111d] hover:bg-violet-200">{update.isPending ? "Saving…" : "Save preferences"}</Button></div></section></div>;
}
